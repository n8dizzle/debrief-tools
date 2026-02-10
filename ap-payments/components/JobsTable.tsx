'use client';

import { useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { APInstallJob, APContractor, APContractorRate } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/ap-utils';
import PaymentStatusBadge from './PaymentStatusBadge';
import AssignmentBadge from './AssignmentBadge';

// --- Column definitions ---

type SortKey =
  | 'job_number'
  | 'customer_name'
  | 'trade'
  | 'job_type_name'
  | 'date'
  | 'job_total'
  | 'assignment_type'
  | 'contractor'
  | 'payment_amount'
  | 'payment_status';

interface ColumnDef {
  key: SortKey;
  label: string;
  defaultWidth: number;
  minWidth: number;
}

const COLUMNS: ColumnDef[] = [
  { key: 'job_number', label: 'Job #', defaultWidth: 100, minWidth: 70 },
  { key: 'customer_name', label: 'Customer', defaultWidth: 180, minWidth: 120 },
  { key: 'trade', label: 'Trade', defaultWidth: 80, minWidth: 60 },
  { key: 'job_type_name', label: 'Type', defaultWidth: 140, minWidth: 80 },
  { key: 'date', label: 'Date', defaultWidth: 100, minWidth: 80 },
  { key: 'job_total', label: 'Job Total', defaultWidth: 100, minWidth: 80 },
  { key: 'assignment_type', label: 'Assignment', defaultWidth: 120, minWidth: 100 },
  { key: 'contractor', label: 'Contractor', defaultWidth: 140, minWidth: 100 },
  { key: 'payment_amount', label: 'Pay Amt', defaultWidth: 110, minWidth: 80 },
  { key: 'payment_status', label: 'Pay Status', defaultWidth: 110, minWidth: 80 },
];

const DEFAULT_ORDER = COLUMNS.map((_, i) => i);

// --- Sort helpers ---

const PAYMENT_STATUS_ORDER: Record<string, number> = {
  none: 0, requested: 1, approved: 2, paid: 3,
};

const ASSIGNMENT_ORDER: Record<string, number> = {
  unassigned: 0, in_house: 1, contractor: 2,
};

function getSortValue(job: APInstallJob, key: SortKey): string | number {
  switch (key) {
    case 'job_number': return job.job_number || '';
    case 'customer_name': return (job.customer_name || '').toLowerCase();
    case 'trade': return job.trade;
    case 'job_type_name': return (job.job_type_name || '').toLowerCase();
    case 'date': return job.scheduled_date || job.completed_date || '';
    case 'job_total': return job.job_total != null ? Number(job.job_total) : -1;
    case 'assignment_type': return ASSIGNMENT_ORDER[job.assignment_type] ?? 0;
    case 'contractor': return (job.contractor?.name || '').toLowerCase();
    case 'payment_amount': return job.payment_amount != null ? Number(job.payment_amount) : -1;
    case 'payment_status': return PAYMENT_STATUS_ORDER[job.payment_status] ?? 0;
  }
}

// --- Props ---

interface JobsTableProps {
  jobs: APInstallJob[];
  contractors: APContractor[];
  isLoading: boolean;
  canManageAssignments: boolean;
  canManagePayments: boolean;
  onAssign: (jobId: string, data: {
    assignment_type: 'unassigned' | 'in_house' | 'contractor';
    contractor_id?: string;
    payment_amount?: number;
  }) => Promise<void>;
  onPaymentStatusChange: (jobId: string, newStatus: string) => Promise<void>;
}

// --- Inline row component ---

function InlineAssignmentRow({
  job,
  contractors,
  canManageAssignments,
  canManagePayments,
  onAssign,
  onPaymentStatusChange,
  columnOrder,
}: {
  job: APInstallJob;
  contractors: APContractor[];
  canManageAssignments: boolean;
  canManagePayments: boolean;
  onAssign: JobsTableProps['onAssign'];
  onPaymentStatusChange: JobsTableProps['onPaymentStatusChange'];
  columnOrder: number[];
}) {
  const [assignmentType, setAssignmentType] = useState(job.assignment_type);
  const [contractorId, setContractorId] = useState(job.contractor_id || '');
  const [paymentAmount, setPaymentAmount] = useState(
    job.payment_amount != null ? String(job.payment_amount) : ''
  );
  const [saving, setSaving] = useState(false);
  const [rates, setRates] = useState<APContractorRate[]>([]);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAssignmentType(job.assignment_type);
    setContractorId(job.contractor_id || '');
    setPaymentAmount(job.payment_amount != null ? String(job.payment_amount) : '');
  }, [job.assignment_type, job.contractor_id, job.payment_amount]);

  useEffect(() => {
    if (!contractorId || assignmentType !== 'contractor') {
      setRates([]);
      return;
    }
    let cancelled = false;
    async function loadRates() {
      try {
        const res = await fetch(`/api/contractors/${contractorId}/rates`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setRates(data);
          const matchingRate = data.find((r: APContractorRate) =>
            r.trade === job.trade &&
            r.job_type_name.toLowerCase() === (job.job_type_name || '').toLowerCase()
          );
          if (matchingRate && !paymentAmount) {
            const amount = String(matchingRate.rate_amount);
            setPaymentAmount(amount);
            saveAssignment('contractor', contractorId, parseFloat(amount));
          }
        }
      } catch { /* ignore */ }
    }
    loadRates();
    return () => { cancelled = true; };
  }, [contractorId]);

  const saveAssignment = async (type: string, conId?: string, amount?: number) => {
    setSaving(true);
    try {
      await onAssign(job.id, {
        assignment_type: type as 'unassigned' | 'in_house' | 'contractor',
        contractor_id: type === 'contractor' ? conId : undefined,
        payment_amount: type === 'contractor' && amount ? amount : undefined,
      });
    } catch (err) {
      console.error('Failed to save assignment:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignmentChange = async (newType: string) => {
    setAssignmentType(newType as any);
    if (newType !== 'contractor') {
      setContractorId('');
      setPaymentAmount('');
      await saveAssignment(newType);
    }
  };

  const handleContractorChange = async (newContractorId: string) => {
    setContractorId(newContractorId);
    if (newContractorId) {
      setTimeout(async () => {
        if (!rates.length) {
          await saveAssignment('contractor', newContractorId, paymentAmount ? parseFloat(paymentAmount) : undefined);
        }
      }, 500);
    }
  };

  const handleAmountBlur = async () => {
    const amount = paymentAmount ? parseFloat(paymentAmount) : undefined;
    if (assignmentType === 'contractor' && contractorId) {
      await saveAssignment('contractor', contractorId, amount);
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') amountRef.current?.blur();
  };

  const handlePaymentChange = async (newStatus: string) => {
    await onPaymentStatusChange(job.id, newStatus);
  };

  // Build a cell map keyed by column key
  const cells: Record<SortKey, ReactNode> = {
    job_number: (
      <td key="job_number">
        <span className="font-mono text-sm" style={{ color: 'var(--christmas-green-light)' }}>
          {job.job_number}
        </span>
      </td>
    ),
    customer_name: (
      <td key="customer_name">
        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
          {job.customer_name || '—'}
        </div>
        {job.job_address && (
          <div className="text-xs truncate" style={{ color: 'var(--text-muted)', maxWidth: '100%' }}>
            {job.job_address}
          </div>
        )}
      </td>
    ),
    trade: (
      <td key="trade">
        <span
          className="badge"
          style={{
            backgroundColor: job.trade === 'hvac' ? 'rgba(93, 138, 102, 0.15)' : 'rgba(184, 149, 107, 0.15)',
            color: job.trade === 'hvac' ? 'var(--christmas-green-light)' : 'var(--christmas-gold)',
          }}
        >
          {job.trade.toUpperCase()}
        </span>
      </td>
    ),
    job_type_name: (
      <td key="job_type_name" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {job.job_type_name || '—'}
      </td>
    ),
    date: (
      <td key="date" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {formatDate(job.scheduled_date || job.completed_date)}
      </td>
    ),
    job_total: (
      <td key="job_total" className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {formatCurrency(job.job_total)}
      </td>
    ),
    assignment_type: (
      <td key="assignment_type" onClick={(e) => e.stopPropagation()}>
        {canManageAssignments ? (
          <select
            className="select text-xs py-1 px-2"
            style={{
              width: 'auto', minWidth: '110px',
              backgroundColor: assignmentType === 'in_house'
                ? 'rgba(59, 130, 246, 0.1)'
                : assignmentType === 'contractor' ? 'rgba(168, 85, 247, 0.1)' : undefined,
            }}
            value={assignmentType}
            onChange={(e) => handleAssignmentChange(e.target.value)}
          >
            <option value="unassigned">Unassigned</option>
            <option value="in_house">In-House</option>
            <option value="contractor">Contractor</option>
          </select>
        ) : (
          <AssignmentBadge type={job.assignment_type} />
        )}
      </td>
    ),
    contractor: (
      <td key="contractor" onClick={(e) => e.stopPropagation()}>
        {canManageAssignments && assignmentType === 'contractor' ? (
          <select
            className="select text-xs py-1 px-2"
            style={{ width: 'auto', minWidth: '120px' }}
            value={contractorId}
            onChange={(e) => handleContractorChange(e.target.value)}
          >
            <option value="">Select...</option>
            {contractors.filter(c => c.is_active).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {job.contractor?.name || '—'}
          </span>
        )}
      </td>
    ),
    payment_amount: (
      <td key="payment_amount" onClick={(e) => e.stopPropagation()}>
        {canManageAssignments && assignmentType === 'contractor' ? (
          <div className="relative" style={{ width: '100px' }}>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
            <input
              ref={amountRef}
              type="number"
              className="input text-xs py-1 pl-5 pr-2"
              style={{ width: '100px' }}
              placeholder="0.00"
              step="0.01"
              min="0"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              onBlur={handleAmountBlur}
              onKeyDown={handleAmountKeyDown}
            />
          </div>
        ) : (
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {job.payment_amount != null ? formatCurrency(job.payment_amount) : '—'}
          </span>
        )}
      </td>
    ),
    payment_status: (
      <td key="payment_status" onClick={(e) => e.stopPropagation()}>
        {canManagePayments && assignmentType === 'contractor' && job.payment_status !== 'paid' ? (
          <select
            className="select text-xs py-1 px-2"
            style={{ width: 'auto', minWidth: '100px' }}
            value={job.payment_status}
            onChange={(e) => handlePaymentChange(e.target.value)}
          >
            <option value="none">None</option>
            <option value="requested">Requested</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
          </select>
        ) : (
          <PaymentStatusBadge status={job.payment_status} />
        )}
      </td>
    ),
  };

  return (
    <tr style={{ opacity: saving ? 0.6 : 1, transition: 'opacity 0.2s' }}>
      {columnOrder.map(idx => cells[COLUMNS[idx].key])}
    </tr>
  );
}

// --- Sort indicator ---

function SortIndicator({ direction }: { direction: 'asc' | 'desc' | null }) {
  return (
    <span className="inline-flex flex-col ml-1" style={{ fontSize: '8px', lineHeight: '8px', verticalAlign: 'middle' }}>
      <span style={{ color: direction === 'asc' ? 'var(--christmas-green-light)' : 'var(--text-muted)', opacity: direction === 'asc' ? 1 : 0.3 }}>▲</span>
      <span style={{ color: direction === 'desc' ? 'var(--christmas-green-light)' : 'var(--text-muted)', opacity: direction === 'desc' ? 1 : 0.3 }}>▼</span>
    </span>
  );
}

// --- Main table ---

export default function JobsTable({
  jobs,
  contractors,
  isLoading,
  canManageAssignments,
  canManagePayments,
  onAssign,
  onPaymentStatusChange,
}: JobsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [colWidths, setColWidths] = useState<number[]>(() => COLUMNS.map(c => c.defaultWidth));
  const [columnOrder, setColumnOrder] = useState<number[]>(DEFAULT_ORDER);
  const [dragCol, setDragCol] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);

  // Resize state
  const resizingCol = useRef<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  const onResizeStart = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = colIndex;
    resizeStartX.current = e.clientX;
    resizeStartW.current = colWidths[colIndex];

    const onMouseMove = (ev: MouseEvent) => {
      if (resizingCol.current == null) return;
      const diff = ev.clientX - resizeStartX.current;
      const newWidth = Math.max(COLUMNS[resizingCol.current].minWidth, resizeStartW.current + diff);
      setColWidths(prev => {
        const next = [...prev];
        next[resizingCol.current!] = newWidth;
        return next;
      });
    };

    const onMouseUp = () => {
      resizingCol.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [colWidths]);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey]);

  // Drag-to-reorder handlers
  const handleDragStart = useCallback((orderPos: number, e: React.DragEvent) => {
    setDragCol(orderPos);
    e.dataTransfer.effectAllowed = 'move';
    // Use a transparent image so the default ghost is hidden
    const ghost = document.createElement('div');
    ghost.style.opacity = '0';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, []);

  const handleDragOver = useCallback((orderPos: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragCol !== null && dragCol !== orderPos) {
      setDragOverCol(orderPos);
    }
  }, [dragCol]);

  const handleDragLeave = useCallback(() => {
    setDragOverCol(null);
  }, []);

  const handleDrop = useCallback((orderPos: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragCol === null || dragCol === orderPos) {
      setDragCol(null);
      setDragOverCol(null);
      return;
    }

    setColumnOrder(prev => {
      const next = [...prev];
      // Remove the dragged item and insert at the drop position
      const [moved] = next.splice(dragCol, 1);
      next.splice(orderPos, 0, moved);
      return next;
    });

    // Also reorder widths to match
    setColWidths(prev => {
      const next = [...prev];
      const [movedW] = next.splice(dragCol, 1);
      next.splice(orderPos, 0, movedW);
      return next;
    });

    setDragCol(null);
    setDragOverCol(null);
  }, [dragCol]);

  const handleDragEnd = useCallback(() => {
    setDragCol(null);
    setDragOverCol(null);
  }, []);

  const sortedJobs = useMemo(() => {
    if (!sortKey) return jobs;
    return [...jobs].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [jobs, sortKey, sortDir]);

  const totalWidth = colWidths.reduce((s, w) => s + w, 0);

  if (isLoading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 rounded" style={{ background: 'var(--border-subtle)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="card text-center py-12">
        <div className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
          No jobs found
        </div>
        <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Try adjusting your filters or sync new data from ServiceTitan
        </div>
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="table-wrapper">
        <table className="ap-table" style={{ tableLayout: 'fixed', width: `${totalWidth}px`, minWidth: '100%' }}>
          <colgroup>
            {columnOrder.map((origIdx, i) => (
              <col key={origIdx} style={{ width: `${colWidths[i]}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columnOrder.map((origIdx, orderPos) => {
                const col = COLUMNS[origIdx];
                const isDragging = dragCol === orderPos;
                const isDragOver = dragOverCol === orderPos;
                return (
                  <th
                    key={col.key}
                    draggable
                    onDragStart={(e) => handleDragStart(orderPos, e)}
                    onDragOver={(e) => handleDragOver(orderPos, e)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(orderPos, e)}
                    onDragEnd={handleDragEnd}
                    style={{
                      position: 'relative',
                      cursor: 'grab',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      opacity: isDragging ? 0.4 : 1,
                      borderLeft: isDragOver ? '2px solid var(--christmas-green-light)' : '2px solid transparent',
                      transition: 'opacity 0.15s, border-color 0.15s',
                    }}
                    onClick={() => handleSort(col.key)}
                  >
                    {/* Drag grip icon */}
                    <span style={{ color: 'var(--text-muted)', marginRight: '4px', fontSize: '10px', opacity: 0.5 }}>⠿</span>
                    <span>{col.label}</span>
                    <SortIndicator direction={sortKey === col.key ? sortDir : null} />
                    {/* Resize handle */}
                    <span
                      onMouseDown={(e) => {
                        // Use the order position index into colWidths
                        onResizeStart(orderPos, e);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onDragStart={(e) => e.stopPropagation()}
                      draggable={false}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '6px',
                        cursor: 'col-resize',
                        zIndex: 1,
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.background = 'var(--christmas-green)';
                        (e.target as HTMLElement).style.opacity = '0.4';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.background = '';
                        (e.target as HTMLElement).style.opacity = '';
                      }}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedJobs.map((job) => (
              <InlineAssignmentRow
                key={job.id}
                job={job}
                contractors={contractors}
                canManageAssignments={canManageAssignments}
                canManagePayments={canManagePayments}
                onAssign={onAssign}
                onPaymentStatusChange={onPaymentStatusChange}
                columnOrder={columnOrder}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
