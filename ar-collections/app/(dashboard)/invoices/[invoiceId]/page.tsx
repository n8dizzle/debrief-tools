'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, formatDate, getAgingBucketLabel } from '@/lib/ar-utils';
import { ARInvoiceWithTracking, PortalUser, FinancingInvoice, PaymentSchedule as PaymentScheduleType } from '@/lib/supabase';
import { useARPermissions } from '@/hooks/useARPermissions';
import { useSession } from 'next-auth/react';
import QuickLogButtons from '@/components/QuickLogButtons';
import ActivityTimeline from '@/components/ActivityTimeline';
import PaymentHistory from '@/components/PaymentHistory';
import PaymentSchedule from '@/components/PaymentSchedule';
import { formatDueDay, getPaymentProgress } from '@/lib/financing-utils';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const invoiceId = params.invoiceId as string;

  const [invoice, setInvoice] = useState<ARInvoiceWithTracking | null>(null);
  const [owners, setOwners] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Financing state
  const [financingData, setFinancingData] = useState<FinancingInvoice | null>(null);
  const [financingSchedule, setFinancingSchedule] = useState<PaymentScheduleType | null>(null);
  const [financingEditing, setFinancingEditing] = useState(false);
  const [financingForm, setFinancingForm] = useState({
    monthly_amount: '',
    due_day: '',
    start_date: '',
    notes: '',
  });

  const {
    canUpdateWorkflow,
    canAssignOwner,
    canChangeControlBucket,
    canAddNotes,
    canMarkWrittenOff,
  } = useARPermissions();

  useEffect(() => {
    fetchInvoice();
    fetchOwners();
  }, [invoiceId]);

  // Fetch financing data when invoice is loaded and has in-house financing
  useEffect(() => {
    if (invoice?.has_inhouse_financing) {
      fetchFinancingData();
    }
  }, [invoice?.has_inhouse_financing, invoiceId]);

  async function fetchInvoice() {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch invoice');
      const data = await response.json();
      setInvoice(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function fetchFinancingData() {
    try {
      const response = await fetch(`/api/financing/${invoiceId}`, {
        credentials: 'include',
      });
      if (!response.ok) return;
      const data = await response.json();
      setFinancingData(data.invoice);
      setFinancingSchedule(data.schedule);

      // Initialize form with existing data
      if (data.invoice) {
        setFinancingForm({
          monthly_amount: data.invoice.financing_monthly_amount?.toString() || '',
          due_day: data.invoice.financing_due_day?.toString() || '',
          start_date: data.invoice.financing_start_date || '',
          notes: data.invoice.financing_notes || '',
        });
      }
    } catch (err) {
      console.error('Failed to fetch financing data:', err);
    }
  }

  async function saveFinancingSettings() {
    try {
      const response = await fetch(`/api/financing/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          financing_monthly_amount: financingForm.monthly_amount ? parseFloat(financingForm.monthly_amount) : null,
          financing_due_day: financingForm.due_day ? parseInt(financingForm.due_day) : null,
          financing_start_date: financingForm.start_date || null,
          financing_notes: financingForm.notes || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      setFinancingEditing(false);
      fetchFinancingData();
    } catch (err) {
      console.error('Failed to save financing settings:', err);
    }
  }

  async function fetchOwners() {
    try {
      const response = await fetch('/api/users', {
        credentials: 'include',
      });
      if (!response.ok) return;
      const data = await response.json();
      setOwners(data.users || []);
    } catch (err) {
      console.error('Failed to fetch owners:', err);
    }
  }

  async function updateTracking(field: string, value: any) {
    if (!invoice) return;
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/tracking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) throw new Error('Failed to update');
      const updated = await response.json();
      setInvoice(prev => prev ? { ...prev, tracking: updated.tracking } : null);
    } catch (err) {
      console.error('Update failed:', err);
    }
  }

  async function refreshNotes() {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/notes`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch notes');
      const data = await response.json();
      setInvoice(prev => prev ? { ...prev, notes: data.notes || [] } : null);
    } catch (err) {
      console.error('Failed to refresh notes:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ color: 'var(--text-muted)' }}>Loading invoice...</div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="card">
        <div className="text-center" style={{ color: 'var(--status-error)' }}>
          {error || 'Invoice not found'}
        </div>
        <div className="mt-4 text-center">
          <button onClick={() => router.back()} className="btn btn-secondary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const tracking = invoice.tracking;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--bg-card)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
                Invoice #{invoice.invoice_number}
              </h1>
              <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
                {invoice.customer_name}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge badge-${invoice.aging_bucket === '90+' ? '90' : invoice.aging_bucket}`}>
            {getAgingBucketLabel(invoice.aging_bucket)}
          </span>
          <span className={`badge ${invoice.customer_type === 'residential' ? 'badge-residential' : 'badge-commercial'}`}>
            {invoice.customer_type === 'residential' ? 'Residential' : 'Commercial'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Details */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              Invoice Details
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Balance</div>
                <div className="text-xl font-bold" style={{ color: 'var(--status-error)' }}>
                  {formatCurrency(invoice.balance)}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Original Total</div>
                <div className="text-lg font-medium" style={{ color: 'var(--christmas-cream)' }}>
                  {formatCurrency(invoice.invoice_total)}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Invoice Date</div>
                <div style={{ color: 'var(--text-secondary)' }}>{formatDate(invoice.invoice_date)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Days Outstanding</div>
                <div style={{ color: 'var(--text-secondary)' }}>{invoice.days_outstanding} days</div>
              </div>
            </div>
          </div>

          {/* Collection Workflow */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              Collection Workflow
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <input
                  type="checkbox"
                  checked={tracking?.day1_text_sent || false}
                  onChange={(e) => updateTracking('day1_text_sent', e.target.checked)}
                  disabled={!canUpdateWorkflow}
                  className="w-5 h-5"
                />
                <div>
                  <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>Day 1 - Text</div>
                  {tracking?.day1_text_date && (
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(tracking.day1_text_date)}
                    </div>
                  )}
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <input
                  type="checkbox"
                  checked={tracking?.day2_call_made || false}
                  onChange={(e) => updateTracking('day2_call_made', e.target.checked)}
                  disabled={!canUpdateWorkflow}
                  className="w-5 h-5"
                />
                <div>
                  <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>Day 2 - Call</div>
                  {tracking?.day2_call_date && (
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(tracking.day2_call_date)}
                    </div>
                  )}
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <input
                  type="checkbox"
                  checked={tracking?.day3_etc || false}
                  onChange={(e) => updateTracking('day3_etc', e.target.checked)}
                  disabled={!canUpdateWorkflow}
                  className="w-5 h-5"
                />
                <div>
                  <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>Day 3 - ETC</div>
                  {tracking?.day3_etc_date && (
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(tracking.day3_etc_date)}
                    </div>
                  )}
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <input
                  type="checkbox"
                  checked={tracking?.day7_etc || false}
                  onChange={(e) => updateTracking('day7_etc', e.target.checked)}
                  disabled={!canUpdateWorkflow}
                  className="w-5 h-5"
                />
                <div>
                  <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>Day 7 - ETC</div>
                  {tracking?.day7_etc_date && (
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(tracking.day7_etc_date)}
                    </div>
                  )}
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <input
                  type="checkbox"
                  checked={tracking?.certified_letter_sent || false}
                  onChange={(e) => updateTracking('certified_letter_sent', e.target.checked)}
                  disabled={!canUpdateWorkflow}
                  className="w-5 h-5"
                />
                <div>
                  <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>Certified Letter</div>
                  {tracking?.certified_letter_date && (
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(tracking.certified_letter_date)}
                    </div>
                  )}
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style={{ backgroundColor: tracking?.closed ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-secondary)' }}>
                <input
                  type="checkbox"
                  checked={tracking?.closed || false}
                  onChange={(e) => updateTracking('closed', e.target.checked)}
                  disabled={!canUpdateWorkflow}
                  className="w-5 h-5"
                />
                <div>
                  <div className="font-medium" style={{ color: tracking?.closed ? 'var(--status-success)' : 'var(--christmas-cream)' }}>
                    Closed
                  </div>
                  {tracking?.closed_date && (
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(tracking.closed_date)}
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* In-House Financing Section */}
          {invoice.has_inhouse_financing && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                  In-House Financing
                </h2>
                {canUpdateWorkflow && !financingEditing && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setFinancingEditing(true)}
                  >
                    Edit Plan
                  </button>
                )}
              </div>

              {financingEditing ? (
                // Edit mode
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                        Monthly Payment Amount
                      </label>
                      <input
                        type="number"
                        className="input"
                        placeholder="e.g., 500"
                        value={financingForm.monthly_amount}
                        onChange={(e) => setFinancingForm(prev => ({ ...prev, monthly_amount: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                        Due Day of Month (1-28)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="28"
                        className="input"
                        placeholder="e.g., 15"
                        value={financingForm.due_day}
                        onChange={(e) => setFinancingForm(prev => ({ ...prev, due_day: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                      Start Date
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={financingForm.start_date}
                      onChange={(e) => setFinancingForm(prev => ({ ...prev, start_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                      Notes
                    </label>
                    <textarea
                      className="input"
                      rows={2}
                      placeholder="Payment plan notes..."
                      value={financingForm.notes}
                      onChange={(e) => setFinancingForm(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={saveFinancingSettings}
                    >
                      Save
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setFinancingEditing(false);
                        // Reset form to saved values
                        if (financingData) {
                          setFinancingForm({
                            monthly_amount: financingData.financing_monthly_amount?.toString() || '',
                            due_day: financingData.financing_due_day?.toString() || '',
                            start_date: financingData.financing_start_date || '',
                            notes: financingData.financing_notes || '',
                          });
                        }
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : financingData ? (
                // View mode with data
                <div className="space-y-6">
                  {/* Plan Summary */}
                  <div
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Monthly Payment</div>
                        <div className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                          {financingData.financing_monthly_amount
                            ? formatCurrency(financingData.financing_monthly_amount)
                            : 'Not set'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Due Day</div>
                        <div className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                          {financingData.financing_due_day
                            ? formatDueDay(financingData.financing_due_day)
                            : 'Not set'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Payments Made</div>
                        <div className="text-lg font-semibold" style={{ color: 'var(--christmas-green)' }}>
                          {financingData.payments_made}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Projected Payoff</div>
                        <div className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                          {financingData.projected_payoff_date
                            ? formatDate(financingData.projected_payoff_date)
                            : 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: 'var(--text-muted)' }}>
                          {formatCurrency(invoice.amount_paid)} paid
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {formatCurrency(invoice.balance)} remaining
                        </span>
                      </div>
                      <div
                        className="h-3 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--bg-card)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${getPaymentProgress(invoice.invoice_total, invoice.balance)}%`,
                            backgroundColor: 'var(--christmas-green)',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Two columns: Payment History and Upcoming Schedule */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>
                        Payment History
                      </h3>
                      <PaymentHistory
                        payments={financingData.payments}
                        invoiceTotal={invoice.invoice_total}
                        dueDay={financingData.financing_due_day}
                      />
                    </div>
                    {financingSchedule && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>
                          Upcoming Payments
                        </h3>
                        <PaymentSchedule schedule={financingSchedule} />
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {financingData.financing_notes && (
                    <div className="pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--christmas-cream)' }}>
                        Notes
                      </h3>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {financingData.financing_notes}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                // No financing data yet
                <div className="text-center py-6">
                  <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                    This invoice is tagged for In-House Financing but no payment plan has been configured yet.
                  </p>
                  {canUpdateWorkflow && (
                    <button
                      className="btn btn-primary"
                      onClick={() => setFinancingEditing(true)}
                    >
                      Configure Payment Plan
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Activity Timeline */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                Activity Timeline
              </h2>
              {canAddNotes && (
                <QuickLogButtons
                  invoiceId={invoiceId}
                  onLogSaved={refreshNotes}
                />
              )}
            </div>

            <ActivityTimeline notes={invoice.notes} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Panel */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>
              Status & Assignment
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Owner
                </label>
                <select
                  className="select"
                  value={tracking?.owner_id || ''}
                  onChange={(e) => updateTracking('owner_id', e.target.value || null)}
                  disabled={!canAssignOwner}
                >
                  <option value="">Unassigned</option>
                  {owners.map(owner => (
                    <option key={owner.id} value={owner.id}>{owner.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Job Status
                </label>
                <select
                  className="select"
                  value={tracking?.job_status || ''}
                  onChange={(e) => updateTracking('job_status', e.target.value || null)}
                  disabled={!canUpdateWorkflow}
                >
                  <option value="">Not Set</option>
                  <option value="qc_booked">QC Booked</option>
                  <option value="qc_completed">QC Completed</option>
                  <option value="job_not_done">Job Not Done</option>
                  <option value="need_clarification">Need Clarification</option>
                  <option value="construction">Construction</option>
                  <option value="tech_question">Tech Question</option>
                  <option value="emailed_customer">Emailed Customer</option>
                  <option value="called_customer">Called Customer</option>
                  <option value="payment_promised">Payment Promised</option>
                  <option value="financing_pending">Financing Pending</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Control Bucket
                </label>
                <select
                  className="select"
                  value={tracking?.control_bucket || 'ar_collectible'}
                  onChange={(e) => updateTracking('control_bucket', e.target.value)}
                  disabled={!canChangeControlBucket}
                >
                  <option value="ar_collectible">AR Collectible</option>
                  <option value="ar_not_in_our_control">Not In Our Control</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tracking?.invoice_verified || false}
                    onChange={(e) => updateTracking('invoice_verified', e.target.checked)}
                    disabled={!canUpdateWorkflow}
                    className="w-4 h-4"
                  />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Invoice Verified
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>
              Payment Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Payment Type
                </label>
                <select
                  className="select"
                  value={tracking?.payment_type || ''}
                  onChange={(e) => updateTracking('payment_type', e.target.value || null)}
                  disabled={!canUpdateWorkflow}
                >
                  <option value="">Not Set</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="card">Card</option>
                  <option value="financing">Financing</option>
                </select>
              </div>
              {tracking?.payment_type === 'financing' && (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                      Financing Type
                    </label>
                    <select
                      className="select"
                      value={tracking?.financing_type || ''}
                      onChange={(e) => updateTracking('financing_type', e.target.value || null)}
                      disabled={!canUpdateWorkflow}
                    >
                      <option value="">Not Set</option>
                      <option value="synchrony">Synchrony</option>
                      <option value="wells_fargo">Wells Fargo</option>
                      <option value="wisetack">Wisetack</option>
                      <option value="ally">Ally</option>
                      <option value="in_house">In-House</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                      Financing Status
                    </label>
                    <select
                      className="select"
                      value={tracking?.financing_status || ''}
                      onChange={(e) => updateTracking('financing_status', e.target.value || null)}
                      disabled={!canUpdateWorkflow}
                    >
                      <option value="">Not Set</option>
                      <option value="submitted">Submitted</option>
                      <option value="needs_signature">Needs Signature</option>
                      <option value="approved">Approved</option>
                      <option value="funded">Funded</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Payment History */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>
              Payment History
            </h3>
            {invoice.payments.length === 0 ? (
              <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                No payments recorded
              </div>
            ) : (
              <div className="space-y-2">
                {invoice.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex justify-between items-center p-2 rounded"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <div>
                      <div className="text-sm" style={{ color: 'var(--christmas-cream)' }}>
                        {formatCurrency(payment.amount)}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {payment.payment_type}
                      </div>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(payment.payment_date)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
