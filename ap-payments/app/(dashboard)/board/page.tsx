'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { APInstallJob, APContractor } from '@/lib/supabase';
import { formatCurrency } from '@/lib/ap-utils';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import JobAssignmentModal from '@/components/JobAssignmentModal';
import ApproveModal from '@/components/ApproveModal';
import MarkPaidModal from '@/components/MarkPaidModal';

type QueueKey = 'needs_assignment' | 'pending_approval' | 'ready_to_pay' | 'paid';

const QUEUES: {
  key: QueueKey;
  label: string;
  color: string;
  muted?: boolean;
  collapsedByDefault?: boolean;
}[] = [
  { key: 'needs_assignment', label: 'Needs Assignment', color: '#a371f7' },
  { key: 'pending_approval', label: 'Pending Approval', color: '#fcd34d' },
  { key: 'ready_to_pay', label: 'Ready to Pay', color: '#60a5fa' },
  { key: 'paid', label: 'Paid', color: '#4ade80', muted: true, collapsedByDefault: true },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS));
}

function agingTone(days: number | null): { color: string; dot: string } {
  if (days === null) return { color: 'var(--text-muted)', dot: 'var(--text-muted)' };
  if (days > 14) return { color: '#f85149', dot: '#f85149' };
  if (days > 7) return { color: '#d29922', dot: '#d29922' };
  return { color: 'var(--text-muted)', dot: 'var(--text-muted)' };
}

function ageDateFor(job: APInstallJob, queue: QueueKey): string | null {
  switch (queue) {
    case 'needs_assignment': return job.completed_date || job.scheduled_date || null;
    case 'pending_approval': return job.payment_requested_at || job.completed_date || null;
    case 'ready_to_pay':     return job.payment_approved_at || job.completed_date || null;
    case 'paid':             return job.payment_paid_at || job.completed_date || null;
  }
}

export default function PaymentBoardPage() {
  const perms = useAPPermissions();
  const [jobs, setJobs] = useState<APInstallJob[]>([]);
  const [contractors, setContractors] = useState<APContractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<QueueKey, boolean>>({
    needs_assignment: false,
    pending_approval: false,
    ready_to_pay: false,
    paid: true,
  });
  const [assignmentJob, setAssignmentJob] = useState<APInstallJob | null>(null);
  const [approvalJob, setApprovalJob] = useState<APInstallJob | null>(null);
  const [markPaidJob, setMarkPaidJob] = useState<APInstallJob | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [unassignedRes, contractorRes, contractorsListRes] = await Promise.all([
        fetch('/api/jobs?paymentStatus=needs_assignment&limit=500'),
        fetch('/api/jobs?paymentStatus=pending_approval,ready_to_pay,paid&assignment=contractor&limit=500'),
        fetch('/api/contractors'),
      ]);
      const [unassigned, contractor, contractorsList] = await Promise.all([
        unassignedRes.ok ? unassignedRes.json() : { jobs: [] },
        contractorRes.ok ? contractorRes.json() : { jobs: [] },
        contractorsListRes.ok ? contractorsListRes.json() : [],
      ]);
      setJobs([...(unassigned.jobs || []), ...(contractor.jobs || [])]);
      setContractors(Array.isArray(contractorsList) ? contractorsList : contractorsList.contractors || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAssignmentSave = async (data: {
    assignment_type: 'in_house' | 'contractor';
    contractor_id?: string;
    payment_amount?: number;
  }) => {
    if (!assignmentJob) return;
    setActionError(null);
    const res = await fetch(`/api/jobs/${assignmentJob.id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setActionError(body?.error || 'Failed to assign job');
      throw new Error('Failed');
    }
    await loadData();
  };

  const handleApprove = async (data: { payment_notes?: string; payment_amount?: number }) => {
    if (!approvalJob) return;
    setActionError(null);
    const res = await fetch(`/api/jobs/${approvalJob.id}/payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status: 'ready_to_pay', ...data }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setActionError(body?.error || 'Failed to approve');
      throw new Error('Failed');
    }
    await loadData();
  };

  const handleMarkPaidConfirm = async (data: { payment_notes?: string }) => {
    if (!markPaidJob) return;
    setActionError(null);
    setMarkingPaid(markPaidJob.id);
    try {
      const res = await fetch(`/api/jobs/${markPaidJob.id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: 'paid', ...data }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = body?.error || 'Failed to mark paid';
        setActionError(msg);
        throw new Error(msg);
      }
      await loadData();
    } finally {
      setMarkingPaid(null);
    }
  };

  const grouped = QUEUES.map((q) => {
    const rows = jobs.filter((j) => j.payment_status === q.key);
    const total = rows.reduce(
      (s, j) => s + Number(j.payment_amount ?? j.job_total ?? 0),
      0
    );
    return { ...q, rows, total };
  });

  const activeContractorJobs = jobs.filter(
    (j) =>
      j.assignment_type === 'contractor' &&
      (j.payment_status === 'pending_approval' ||
       j.payment_status === 'ready_to_pay' ||
       j.payment_status === 'paid')
  );

  const pendingTotal = grouped.find((g) => g.key === 'pending_approval')?.total ?? 0;
  const readyTotal   = grouped.find((g) => g.key === 'ready_to_pay')?.total ?? 0;
  const outstanding  = pendingTotal + readyTotal;

  const awaitingAction = grouped
    .filter((g) => g.key === 'pending_approval' || g.key === 'ready_to_pay')
    .reduce((sum, g) => sum + g.rows.length, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Payment Board
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Contractor jobs grouped by stage
          </p>
        </div>
        <Link
          href="/jobs"
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          Open Table view →
        </Link>
      </div>

      {actionError && (
        <div
          className="mb-4 px-4 py-2 rounded-lg text-sm"
          style={{
            backgroundColor: 'rgba(248, 81, 73, 0.12)',
            border: '1px solid rgba(248, 81, 73, 0.3)',
            color: '#f85149',
          }}
        >
          {actionError}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <KpiCard
          label="Active contractor jobs"
          value={activeContractorJobs.length.toString()}
          detail="pending + ready + paid"
        />
        <KpiCard
          label="Outstanding"
          value={formatCurrency(outstanding)}
          detail={`${formatCurrency(pendingTotal)} pending · ${formatCurrency(readyTotal)} ready`}
        />
        <KpiCard
          label="Awaiting your action"
          value={awaitingAction.toString()}
          detail="approve + pay"
          actionable
        />
      </div>

      {/* Queues */}
      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          Loading queues…
        </div>
      ) : (
        grouped.map((q) => (
          <QueueSection
            key={q.key}
            queueKey={q.key}
            label={q.label}
            color={q.color}
            muted={q.muted}
            rows={q.rows}
            total={q.total}
            collapsed={collapsed[q.key]}
            onToggle={() =>
              setCollapsed((prev) => ({ ...prev, [q.key]: !prev[q.key] }))
            }
            onAssign={(job) => setAssignmentJob(job)}
            onApprove={(job) => setApprovalJob(job)}
            onMarkPaid={(job) => setMarkPaidJob(job)}
            markingPaidId={markingPaid}
            canManageAssignments={perms.canManageAssignments}
            canApprovePayments={perms.canApprovePayments}
            canIssuePayments={perms.canIssuePayments}
          />
        ))
      )}

      {/* Modals */}
      {assignmentJob && (
        <JobAssignmentModal
          job={assignmentJob}
          contractors={contractors}
          onClose={() => setAssignmentJob(null)}
          onSave={handleAssignmentSave}
        />
      )}
      {approvalJob && (
        <ApproveModal
          job={approvalJob}
          onClose={() => setApprovalJob(null)}
          onApprove={handleApprove}
        />
      )}
      {markPaidJob && (
        <MarkPaidModal
          job={markPaidJob}
          onClose={() => setMarkPaidJob(null)}
          onConfirm={handleMarkPaidConfirm}
        />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  actionable,
}: {
  label: string;
  value: string;
  detail: string;
  actionable?: boolean;
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: actionable
          ? '1px solid rgba(47, 129, 247, 0.4)'
          : '1px solid var(--border-subtle)',
      }}
    >
      <div
        className="text-xs uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </div>
      <div
        className="text-3xl font-semibold mt-1"
        style={{ color: actionable ? '#2f81f7' : 'var(--christmas-cream)' }}
      >
        {value}
      </div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
        {detail}
      </div>
    </div>
  );
}

function QueueSection({
  queueKey,
  label,
  color,
  muted,
  rows,
  total,
  collapsed,
  onToggle,
  onAssign,
  onApprove,
  onMarkPaid,
  markingPaidId,
  canManageAssignments,
  canApprovePayments,
  canIssuePayments,
}: {
  queueKey: QueueKey;
  label: string;
  color: string;
  muted?: boolean;
  rows: APInstallJob[];
  total: number;
  collapsed: boolean;
  onToggle: () => void;
  onAssign: (job: APInstallJob) => void;
  onApprove: (job: APInstallJob) => void;
  onMarkPaid: (job: APInstallJob) => void;
  markingPaidId: string | null;
  canManageAssignments: boolean;
  canApprovePayments: boolean;
  canIssuePayments: boolean;
}) {
  return (
    <div
      className="mb-3 rounded-lg overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        opacity: muted ? 0.7 : 1,
      }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: collapsed ? 'none' : '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-semibold text-sm" style={{ color: 'var(--christmas-cream)' }}>
            {label}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-muted)',
            }}
          >
            {rows.length}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span
            className="text-sm font-mono"
            style={{ color: 'var(--christmas-cream)' }}
          >
            {formatCurrency(total)}
          </span>
          <span
            className="text-sm"
            style={{
              color: 'var(--text-muted)',
              transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }}
          >
            ▾
          </span>
        </div>
      </button>

      {!collapsed && (
        <div>
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No jobs in this queue
            </div>
          ) : (
            rows.map((job) => (
              <BoardRow
                key={job.id}
                job={job}
                queueKey={queueKey}
                onAssign={onAssign}
                onApprove={onApprove}
                onMarkPaid={onMarkPaid}
                markingPaidId={markingPaidId}
                canManageAssignments={canManageAssignments}
                canApprovePayments={canApprovePayments}
                canIssuePayments={canIssuePayments}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function BoardRow({
  job,
  queueKey,
  onAssign,
  onApprove,
  onMarkPaid,
  markingPaidId,
  canManageAssignments,
  canApprovePayments,
  canIssuePayments,
}: {
  job: APInstallJob;
  queueKey: QueueKey;
  onAssign: (job: APInstallJob) => void;
  onApprove: (job: APInstallJob) => void;
  onMarkPaid: (job: APInstallJob) => void;
  markingPaidId: string | null;
  canManageAssignments: boolean;
  canApprovePayments: boolean;
  canIssuePayments: boolean;
}) {
  const age = daysSince(ageDateFor(job, queueKey));
  const tone = agingTone(age);
  const trade = job.trade?.toLowerCase();
  const tradeStyle =
    trade === 'plumbing'
      ? { color: '#d4a017', backgroundColor: 'rgba(212, 160, 23, 0.15)' }
      : { color: '#2ea043', backgroundColor: 'rgba(46, 160, 67, 0.15)' };

  const action = (() => {
    switch (queueKey) {
      case 'needs_assignment':
        return canManageAssignments ? (
          <button
            onClick={() => onAssign(job)}
            className="px-3 py-1.5 rounded text-xs font-medium text-white"
            style={{ backgroundColor: '#a371f7' }}
          >
            Assign
          </button>
        ) : null;
      case 'pending_approval':
        return canApprovePayments ? (
          <button
            onClick={() => onApprove(job)}
            className="px-3 py-1.5 rounded text-xs font-medium"
            style={{ backgroundColor: '#fcd34d', color: '#1a1500' }}
          >
            Approve
          </button>
        ) : null;
      case 'ready_to_pay':
        return canIssuePayments ? (
          <button
            onClick={() => onMarkPaid(job)}
            disabled={markingPaidId === job.id}
            className="px-3 py-1.5 rounded text-xs font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#2f81f7' }}
          >
            {markingPaidId === job.id ? 'Marking…' : 'Mark Paid'}
          </button>
        ) : null;
      case 'paid':
        return null;
    }
  })();

  return (
    <div
      className="grid items-center gap-3 px-4 py-3"
      style={{
        gridTemplateColumns: '1fr 200px 110px 70px 110px',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            #{job.job_number}
          </span>
          <span className="font-medium text-sm truncate" style={{ color: 'var(--christmas-cream)' }}>
            {job.customer_name || '—'}
          </span>
          {job.trade && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={tradeStyle}
            >
              {job.trade.toUpperCase()}
            </span>
          )}
        </div>
        <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {job.job_type_name || job.business_unit_name || 'Install'}
          {job.completed_date && ` · completed ${job.completed_date}`}
        </div>
      </div>

      <div className="text-sm truncate" style={{ color: job.contractor?.name ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {job.contractor?.name || (
          <em style={{ fontStyle: 'italic' }}>— not assigned —</em>
        )}
      </div>

      <div className="text-sm font-mono text-right" style={{ color: 'var(--christmas-cream)' }}>
        {formatCurrency(job.payment_amount ?? job.job_total ?? 0)}
      </div>

      <div className="flex items-center gap-1.5 text-xs" style={{ color: tone.color }}>
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: tone.dot }}
        />
        {age !== null ? `${age}d` : '—'}
      </div>

      <div className="flex justify-end">{action}</div>
    </div>
  );
}
