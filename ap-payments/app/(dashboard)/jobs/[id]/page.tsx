'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { APInstallJob, APContractor, APActivityLog, APContractorRate, APSmsLog, APInvoiceSource } from '@/lib/supabase';
import { formatDate, formatTimestamp, formatCurrency, formatRate, getAssignmentLabel, getPaymentStatusLabel } from '@/lib/ap-utils';
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

  // SMS state
  const [smsLog, setSmsLog] = useState<APSmsLog[]>([]);
  const [smsMessage, setSmsMessage] = useState('');
  const [smsPhone, setSmsPhone] = useState('');
  const [smsRecipientName, setSmsRecipientName] = useState('');
  const [sendingSms, setSendingSms] = useState(false);
  const [smsResult, setSmsResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showSmsForm, setShowSmsForm] = useState(false);

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

  const loadSmsLog = useCallback(async () => {
    try {
      const res = await fetch(`/api/sms/log?job_id=${id}`);
      if (res.ok) setSmsLog(await res.json());
    } catch {}
  }, [id]);

  useEffect(() => {
    loadJob();
    loadStDetails();
    loadContractors();
    loadSmsLog();
  }, [loadJob, loadStDetails, loadContractors, loadSmsLog]);

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

  const handleSavePayment = async (overrideStatus?: string, overrideSource?: string) => {
    setSaving(true);
    try {
      await fetch(`/api/jobs/${id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_status: overrideStatus || paymentStatus,
          payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
          payment_notes: paymentNotes || undefined,
          invoice_source: overrideSource || undefined,
        }),
      });
      await loadJob();
    } finally {
      setSaving(false);
    }
  };

  const handleSendSms = async () => {
    if (!smsPhone || !smsMessage) return;
    setSendingSms(true);
    setSmsResult(null);
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: id,
          contractor_id: job?.contractor_id || undefined,
          phone: smsPhone,
          recipient_name: smsRecipientName || undefined,
          message: smsMessage,
        }),
      });
      if (res.ok) {
        setSmsResult({ type: 'success', text: 'Message sent!' });
        setSmsMessage('');
        setShowSmsForm(false);
        await loadSmsLog();
        setTimeout(() => setSmsResult(null), 4000);
      } else {
        const data = await res.json();
        setSmsResult({ type: 'error', text: data.error || 'Failed to send' });
      }
    } catch {
      setSmsResult({ type: 'error', text: 'Failed to send message' });
    } finally {
      setSendingSms(false);
    }
  };

  const handlePrefillContractor = () => {
    if (job?.contractor?.phone) {
      setSmsPhone(job.contractor.phone);
      setSmsRecipientName(job.contractor.name);
    }
    setShowSmsForm(true);
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
              title="Open in ServiceTitan"
              className="p-1 rounded hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {/* Labor Cost Card */}
          <div className="card">
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>Labor Cost</h2>
            {job.assignment_type === 'contractor' ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Contractor Payment</span>
                  <span className="text-lg font-bold" style={{ color: 'var(--christmas-gold)' }}>
                    {job.payment_amount != null ? formatCurrency(job.payment_amount) : '—'}
                  </span>
                </div>
                {job.job_total != null && job.payment_amount != null && (
                  <div className="flex justify-between items-center text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>% of Job Total</span>
                    <span>{(Number(job.payment_amount) / Number(job.job_total) * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            ) : job.assignment_type === 'in_house' ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Estimated Cost</span>
                  <span className="text-lg font-bold" style={{ color: 'var(--christmas-green-light)' }}>
                    {job.labor_cost != null ? formatCurrency(job.labor_cost) : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-lg space-y-1.5" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>Hours</span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {job.labor_hours != null ? `${job.labor_hours} hrs` : <span style={{ color: 'var(--status-warning)' }}>Missing</span>}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>Technician</span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {job.technician?.name || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>Hourly Rate</span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {job.technician?.hourly_rate != null ? formatRate(job.technician.hourly_rate) : <span style={{ color: 'var(--status-warning)' }}>Not set</span>}
                    </span>
                  </div>
                  {job.labor_hours != null && job.technician?.hourly_rate != null && (
                    <div className="flex justify-between text-sm pt-1.5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Calculation</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {job.labor_hours} hrs &times; {formatRate(job.technician.hourly_rate)}
                      </span>
                    </div>
                  )}
                </div>
                {job.job_total != null && job.labor_cost != null && (
                  <div className="flex justify-between items-center text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>% of Job Total</span>
                    <span>{(Number(job.labor_cost) / Number(job.job_total) * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Assign this job to see labor cost
              </p>
            )}
          </div>

          {/* Payment Card */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: 'var(--christmas-cream)' }}>Payment</h2>
              {job.invoice_source && (
                <span className="text-xs px-2 py-0.5 rounded" style={{
                  backgroundColor: job.invoice_source === 'manager_text' ? 'rgba(93, 138, 102, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: job.invoice_source === 'manager_text' ? 'var(--christmas-green-light)' : '#60a5fa',
                }}>
                  {job.invoice_source === 'manager_text' ? 'Via Manager Text' : 'Via AP Email'}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {/* Status display */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Status</label>
                <div className="text-sm font-medium" style={{
                  color: paymentStatus === 'paid' ? 'var(--status-success)' :
                    paymentStatus === 'ready_to_pay' ? '#60a5fa' :
                    paymentStatus === 'pending_approval' ? '#fcd34d' :
                    paymentStatus === 'received' ? '#fb923c' :
                    'var(--text-secondary)',
                }}>
                  {paymentStatus === 'none' ? 'No Invoice' :
                   paymentStatus === 'received' ? 'Received' :
                   paymentStatus === 'pending_approval' ? 'Pending Approval' :
                   paymentStatus === 'ready_to_pay' ? 'Ready to Pay' :
                   'Paid'}
                </div>
              </div>

              {/* Amount field */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Amount</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>$</span>
                  <input
                    type="number"
                    className="input flex-1"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    disabled={!canManagePayments || paymentStatus === 'paid'}
                  />
                </div>
              </div>

              {/* Notes field */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Notes</label>
                <textarea
                  className="input"
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Payment notes..."
                  disabled={!canManagePayments || paymentStatus === 'paid'}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Payment timestamps */}
              {job.payment_received_at && (
                <DetailItem label="Received" value={formatTimestamp(job.payment_received_at)} small />
              )}
              {job.payment_approved_at && (
                <DetailItem label="Approved" value={formatTimestamp(job.payment_approved_at)} small />
              )}
              {job.payment_paid_at && (
                <DetailItem label="Paid" value={formatTimestamp(job.payment_paid_at)} small />
              )}

              {/* Workflow action buttons */}
              {canManagePayments && paymentStatus === 'none' && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Record invoice received:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleSavePayment('received', 'manager_text')}
                      disabled={saving || !paymentAmount}
                      className="btn btn-primary text-xs py-2"
                      style={{ opacity: saving || !paymentAmount ? 0.5 : 1 }}
                      title="Manager already approved via text"
                    >
                      {saving ? '...' : 'Manager Text'}
                    </button>
                    <button
                      onClick={() => handleSavePayment('received', 'ap_email')}
                      disabled={saving || !paymentAmount}
                      className="btn btn-secondary text-xs py-2"
                      style={{ opacity: saving || !paymentAmount ? 0.5 : 1 }}
                      title="Received via AP email, needs approval"
                    >
                      {saving ? '...' : 'AP Email'}
                    </button>
                  </div>
                  {!paymentAmount && (
                    <p className="text-[10px]" style={{ color: 'var(--status-warning)' }}>Enter amount first</p>
                  )}
                </div>
              )}

              {canManagePayments && paymentStatus === 'pending_approval' && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleSavePayment('ready_to_pay')}
                    disabled={saving}
                    className="btn btn-primary flex-1 text-sm"
                    style={{ opacity: saving ? 0.5 : 1 }}
                  >
                    {saving ? 'Saving...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleSavePayment('received')}
                    disabled={saving}
                    className="btn btn-secondary flex-1 text-sm"
                    style={{ opacity: saving ? 0.5 : 1 }}
                  >
                    {saving ? '...' : 'Reject'}
                  </button>
                </div>
              )}

              {canManagePayments && paymentStatus === 'ready_to_pay' && (
                <button
                  onClick={() => handleSavePayment('paid')}
                  disabled={saving}
                  className="btn btn-primary w-full"
                  style={{ opacity: saving ? 0.5 : 1 }}
                >
                  {saving ? 'Saving...' : 'Mark Paid'}
                </button>
              )}

              {canManagePayments && paymentStatus === 'received' && (
                <button
                  onClick={() => handleSavePayment()}
                  disabled={saving}
                  className="btn btn-secondary w-full text-sm"
                  style={{ opacity: saving ? 0.5 : 1 }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
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
              {canManagePayments && job.contractor.phone && (
                <button
                  onClick={handlePrefillContractor}
                  className="btn btn-secondary w-full mt-3 text-sm"
                >
                  <svg className="w-4 h-4 mr-1.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Send Text
                </button>
              )}
            </div>
          )}

          {/* Send SMS Form */}
          {canManagePayments && showSmsForm && (
            <div className="card">
              <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>Send Text Message</h2>

              {smsResult && (
                <div
                  className="mb-3 p-2 rounded-lg text-xs"
                  style={{
                    backgroundColor: smsResult.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: smsResult.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
                  }}
                >
                  {smsResult.text}
                </div>
              )}

              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wider mb-0.5 block" style={{ color: 'var(--text-muted)' }}>Recipient</label>
                  <input
                    type="text"
                    className="input text-sm"
                    value={smsRecipientName}
                    onChange={e => setSmsRecipientName(e.target.value)}
                    placeholder="Name"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wider mb-0.5 block" style={{ color: 'var(--text-muted)' }}>Phone</label>
                  <input
                    type="tel"
                    className="input text-sm"
                    value={smsPhone}
                    onChange={e => setSmsPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wider mb-0.5 block" style={{ color: 'var(--text-muted)' }}>Message</label>
                  <textarea
                    className="input text-sm"
                    rows={3}
                    value={smsMessage}
                    onChange={e => setSmsMessage(e.target.value)}
                    placeholder="Type your message..."
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSendSms}
                    disabled={sendingSms || !smsPhone || !smsMessage}
                    className="btn btn-primary flex-1 text-sm"
                    style={{ opacity: sendingSms || !smsPhone || !smsMessage ? 0.5 : 1 }}
                  >
                    {sendingSms ? 'Sending...' : 'Send'}
                  </button>
                  <button
                    onClick={() => { setShowSmsForm(false); setSmsResult(null); }}
                    className="btn btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SMS History */}
          {canManagePayments && smsLog.length > 0 && (
            <div className="card">
              <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>SMS History</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {smsLog.map(sms => (
                  <div key={sms.id} className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {sms.recipient_name || sms.recipient_phone}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: sms.status === 'sent' ? 'rgba(34, 197, 94, 0.15)' : sms.status === 'failed' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                          color: sms.status === 'sent' ? 'var(--status-success)' : sms.status === 'failed' ? 'var(--status-error)' : 'var(--text-muted)',
                        }}
                      >
                        {sms.status}
                      </span>
                    </div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{sms.message}</p>
                    <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      <span>{sms.event_type}</span>
                      <span>&middot;</span>
                      <span>{formatTimestamp(sms.created_at)}</span>
                    </div>
                  </div>
                ))}
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
