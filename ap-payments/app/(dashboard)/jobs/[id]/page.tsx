'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { APInstallJob, APContractor, APActivityLog, APContractorRate } from '@/lib/supabase';
import { formatDate, formatTimestamp, formatCurrency, getAssignmentLabel, getPaymentStatusLabel } from '@/lib/ap-utils';
import { useAPPermissions } from '@/hooks/useAPPermissions';

interface STDetails {
  jobSummary: string | null;
  technician: string | null;
  soldBy: string | null;
  invoiceId: number | null;
  invoiceTotal: number | null;
  lineItems: { id: number; description: string; quantity: number; unitPrice: number; total: number; type: string | null }[];
  customerTags: { id: number; name: string }[];
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { canManageAssignments, canManagePayments } = useAPPermissions();

  const [job, setJob] = useState<APInstallJob | null>(null);
  const [activities, setActivities] = useState<APActivityLog[]>([]);
  const [contractors, setContractors] = useState<APContractor[]>([]);
  const [stDetails, setStDetails] = useState<STDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [stLoading, setStLoading] = useState(true);

  // Editable fields
  const [assignmentType, setAssignmentType] = useState<string>('unassigned');
  const [contractorId, setContractorId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<string>('none');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [rates, setRates] = useState<APContractorRate[]>([]);

  const loadJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${id}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data.job);
        setActivities(data.activities || []);
        // Populate editable fields
        setAssignmentType(data.job.assignment_type || 'unassigned');
        setContractorId(data.job.contractor_id || '');
        setPaymentAmount(data.job.payment_amount != null ? String(data.job.payment_amount) : '');
        setPaymentStatus(data.job.payment_status || 'none');
        setPaymentNotes(data.job.payment_notes || '');
      }
    } catch (err) {
      console.error('Failed to load job:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadStDetails = useCallback(async () => {
    setStLoading(true);
    try {
      const res = await fetch(`/api/jobs/${id}/st-details`);
      if (res.ok) {
        setStDetails(await res.json());
      }
    } catch (err) {
      console.error('Failed to load ST details:', err);
    } finally {
      setStLoading(false);
    }
  }, [id]);

  const loadContractors = useCallback(async () => {
    try {
      const res = await fetch('/api/contractors');
      if (res.ok) setContractors(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    loadJob();
    loadStDetails();
    loadContractors();
  }, [loadJob, loadStDetails, loadContractors]);

  // Load rates when contractor changes
  useEffect(() => {
    if (!contractorId) { setRates([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/contractors/${contractorId}/rates`);
        if (res.ok && !cancelled) setRates(await res.json());
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [contractorId]);

  const handleSaveAssignment = async () => {
    setSaving(true);
    try {
      await fetch(`/api/jobs/${id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_type: assignmentType,
          contractor_id: assignmentType === 'contractor' ? contractorId : undefined,
          payment_amount: assignmentType === 'contractor' && paymentAmount ? parseFloat(paymentAmount) : undefined,
        }),
      });
      await loadJob();
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayment = async () => {
    setSaving(true);
    try {
      await fetch(`/api/jobs/${id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_status: paymentStatus,
          payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
          payment_notes: paymentNotes || undefined,
        }),
      });
      await loadJob();
    } finally {
      setSaving(false);
    }
  };

  // Auto-fill rate when contractor + job type match
  useEffect(() => {
    if (!job || !contractorId || rates.length === 0) return;
    const match = rates.find(r =>
      r.trade === job.trade &&
      r.job_type_name.toLowerCase() === (job.job_type_name || '').toLowerCase()
    );
    if (match && !paymentAmount) {
      setPaymentAmount(String(match.rate_amount));
    }
  }, [rates, contractorId, job, paymentAmount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
        <svg className="animate-spin h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading...
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p style={{ color: 'var(--text-muted)' }}>Job not found</p>
        <button onClick={() => router.push('/jobs')} className="btn btn-secondary">Back to Jobs</button>
      </div>
    );
  }

  const isPlumbing = job.trade === 'plumbing';
  const statusColor = job.job_status === 'Completed' ? 'var(--status-success)'
    : job.job_status === 'Scheduled' ? 'var(--status-info)'
    : job.job_status === 'InProgress' ? 'var(--status-warning)'
    : 'var(--text-muted)';

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button
          onClick={() => router.push('/jobs')}
          className="mt-1 p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Back to jobs"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              Job #{job.job_number}
            </h1>
            <a
              href={`https://go.servicetitan.com/#/Job/Index/${job.st_job_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded flex items-center gap-1"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
            >
              Open in ST
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <span className="badge" style={{
              backgroundColor: isPlumbing ? 'rgba(184, 149, 107, 0.15)' : 'rgba(93, 138, 102, 0.15)',
              color: isPlumbing ? 'var(--christmas-gold)' : 'var(--christmas-green-light)',
            }}>
              {job.business_unit_name || job.trade.toUpperCase()}
            </span>
            <span className="badge" style={{
              backgroundColor: `${statusColor}20`,
              color: statusColor,
            }}>
              {job.job_status || 'Unknown'}
            </span>
          </div>
          {job.customer_name && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg" style={{ color: 'var(--text-secondary)' }}>{job.customer_name}</span>
              {job.st_customer_id && (
                <a
                  href={`https://go.servicetitan.com/#/Customer/${job.st_customer_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View customer in ST"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Main content (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Details Card */}
          <div className="card">
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>Job Details</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <DetailItem label="Job Total" value={formatCurrency(job.job_total)} valueStyle={{ color: 'var(--christmas-cream)', fontWeight: 600, fontSize: '1.125rem' }} />
              <DetailItem label="Job Type" value={job.job_type_name || '—'} />
              <DetailItem label="Scheduled" value={formatDate(job.scheduled_date)} />
              <DetailItem label="Completed" value={formatDate(job.completed_date)} />
            </div>
          </div>

          {/* Customer & Location Card */}
          <div className="card">
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>Customer & Location</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem label="Customer" value={job.customer_name || '—'} />
              <DetailItem label="Phone" value={job.customer_phone || '—'} />
              <DetailItem label="Email" value={job.customer_email || '—'} />
              <div>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Location</div>
                <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {job.job_address || '—'}
                  {job.st_location_id && (
                    <a
                      href={`https://go.servicetitan.com/#/Location/${job.st_location_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1.5 inline-flex align-middle"
                      title="View location in ST"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Job Summary */}
          {(job.summary || stDetails?.jobSummary) && (
            <div className="card">
              <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>Job Summary</h2>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                {stDetails?.jobSummary || job.summary}
              </p>
            </div>
          )}

          {/* Invoice Line Items */}
          {stLoading ? (
            <div className="card">
              <div className="flex items-center gap-2 py-4" style={{ color: 'var(--text-muted)' }}>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading ServiceTitan details...
              </div>
            </div>
          ) : stDetails?.lineItems && stDetails.lineItems.length > 0 ? (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold" style={{ color: 'var(--christmas-cream)' }}>Invoice Line Items</h2>
                {stDetails.invoiceId && (
                  <a
                    href={`https://go.servicetitan.com/#/Invoice/${stDetails.invoiceId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs flex items-center gap-1"
                    style={{ color: 'var(--christmas-green-light)' }}
                  >
                    View Invoice in ST
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
              <div className="table-wrapper">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Unit Price</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stDetails.lineItems.map((item) => (
                      <tr key={item.id}>
                        <td className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {item.description}
                          {item.type && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-muted)',
                            }}>
                              {item.type}
                            </span>
                          )}
                        </td>
                        <td className="text-sm" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{item.quantity}</td>
                        <td className="text-sm" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(item.unitPrice)}</td>
                        <td className="text-sm font-medium" style={{ textAlign: 'right', color: 'var(--text-primary)' }}>{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="text-sm font-semibold" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>Total</td>
                      <td className="text-sm font-bold" style={{ textAlign: 'right', color: 'var(--christmas-cream)' }}>
                        {formatCurrency(stDetails.invoiceTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : null}

          {/* Activity Log */}
          <div className="card">
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>Activity</h2>
            {activities.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No activity yet</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {activities.map((a) => (
                  <div key={a.id} className="flex gap-3 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: 'var(--christmas-green)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{a.description}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {a.performer?.name || 'System'} &middot; {formatTimestamp(a.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right - Sidebar (1 col) */}
        <div className="space-y-6">
          {/* Assignment Card */}
          <div className="card">
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>Assignment</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Type</label>
                <select
                  className="select"
                  value={assignmentType}
                  onChange={(e) => setAssignmentType(e.target.value)}
                  disabled={!canManageAssignments}
                >
                  <option value="unassigned">Unassigned</option>
                  <option value="in_house">In-House</option>
                  <option value="contractor">Contractor</option>
                </select>
              </div>

              {assignmentType === 'contractor' && (
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Contractor</label>
                  <select
                    className="select"
                    value={contractorId}
                    onChange={(e) => setContractorId(e.target.value)}
                    disabled={!canManageAssignments}
                  >
                    <option value="">Select...</option>
                    {contractors.filter(c => c.is_active).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {canManageAssignments && assignmentType !== job.assignment_type && (
                <button onClick={handleSaveAssignment} disabled={saving} className="btn btn-primary w-full" style={{ opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving...' : 'Save Assignment'}
                </button>
              )}
              {canManageAssignments && assignmentType === 'contractor' && contractorId && contractorId !== job.contractor_id && (
                <button onClick={handleSaveAssignment} disabled={saving} className="btn btn-primary w-full" style={{ opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving...' : 'Save Assignment'}
                </button>
              )}
            </div>
          </div>

          {/* Payment Card */}
          <div className="card">
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>Payment</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Status</label>
                <select
                  className="select"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  disabled={!canManagePayments}
                >
                  <option value="none">None</option>
                  <option value="requested">Requested</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>$</span>
                  <input
                    type="number"
                    className="input pl-7"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={!canManagePayments}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Notes</label>
                <textarea
                  className="input"
                  rows={3}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Payment notes..."
                  disabled={!canManagePayments}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Payment timestamps */}
              {job.payment_requested_at && (
                <DetailItem label="Requested" value={formatTimestamp(job.payment_requested_at)} small />
              )}
              {job.payment_approved_at && (
                <DetailItem label="Approved" value={formatTimestamp(job.payment_approved_at)} small />
              )}
              {job.payment_paid_at && (
                <DetailItem label="Paid" value={formatTimestamp(job.payment_paid_at)} small />
              )}

              {canManagePayments && (
                <button onClick={handleSavePayment} disabled={saving} className="btn btn-primary w-full" style={{ opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving...' : 'Save Payment'}
                </button>
              )}
            </div>
          </div>

          {/* Contractor Info Card */}
          {job.contractor && (
            <div className="card">
              <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>Contractor Info</h2>
              <div className="space-y-2">
                <DetailItem label="Name" value={job.contractor.name} small />
                {job.contractor.contact_name && <DetailItem label="Contact" value={job.contractor.contact_name} small />}
                {job.contractor.phone && <DetailItem label="Phone" value={job.contractor.phone} small />}
                {job.contractor.email && <DetailItem label="Email" value={job.contractor.email} small />}
                {job.contractor.payment_method && <DetailItem label="Payment Method" value={job.contractor.payment_method} small />}
                {job.contractor.payment_notes && <DetailItem label="Payment Notes" value={job.contractor.payment_notes} small />}
              </div>
            </div>
          )}

          {/* ST Extra Info */}
          {stDetails?.soldBy && (
            <div className="card">
              <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>Additional Info</h2>
              <div className="space-y-2">
                {stDetails.soldBy && <DetailItem label="Sold By" value={stDetails.soldBy} small />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, valueStyle, small }: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
  small?: boolean;
}) {
  return (
    <div>
      <div className={`font-medium uppercase tracking-wider mb-0.5 ${small ? 'text-[10px]' : 'text-xs'}`} style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className={small ? 'text-xs' : 'text-sm'} style={{ color: 'var(--text-primary)', ...valueStyle }}>{value}</div>
    </div>
  );
}
