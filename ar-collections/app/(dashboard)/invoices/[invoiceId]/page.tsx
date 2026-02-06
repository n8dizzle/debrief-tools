'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, formatDate, getAgingBucketLabel } from '@/lib/ar-utils';
import { ARInvoiceWithTracking, PortalUser, FinancingInvoice, FinancingExpectedPayment, ARJobStatusOption } from '@/lib/supabase';
import { useARPermissions } from '@/hooks/useARPermissions';
import { useSession } from 'next-auth/react';
import QuickLogButtons from '@/components/QuickLogButtons';
import ActivityTimeline from '@/components/ActivityTimeline';
import ExpectedPaymentSchedule from '@/components/ExpectedPaymentSchedule';
import TaskList from '@/components/TaskList';
import { formatDueDay, getPaymentProgress } from '@/lib/financing-utils';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const invoiceId = params.invoiceId as string;

  const [invoice, setInvoice] = useState<ARInvoiceWithTracking | null>(null);
  const [owners, setOwners] = useState<PortalUser[]>([]);
  const [jobStatuses, setJobStatuses] = useState<ARJobStatusOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Financing state
  const [financingData, setFinancingData] = useState<FinancingInvoice | null>(null);
  const [expectedPayments, setExpectedPayments] = useState<FinancingExpectedPayment[]>([]);
  const [financingEditing, setFinancingEditing] = useState(false);
  const [financingForm, setFinancingForm] = useState({
    monthly_amount: '',
    due_day: '',
    start_date: '',
    notes: '',
  });

  // ServiceTitan details state
  const [stDetails, setStDetails] = useState<{
    jobSummary: string | null;
    invoiceSummary: string | null;
    lineItems: Array<{
      id: number;
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
      type?: string;
    }>;
    technician: string | null;
    soldBy: string | null;
    customerTags: Array<{ id: number; name: string }>;
  } | null>(null);
  const [stDetailsLoading, setStDetailsLoading] = useState(false);

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
    fetchJobStatuses();
  }, [invoiceId]);

  // Fetch financing data when invoice is loaded and has in-house financing
  useEffect(() => {
    if (invoice?.has_inhouse_financing) {
      fetchFinancingData();
      fetchExpectedPayments();
    }
  }, [invoice?.has_inhouse_financing, invoiceId]);

  // Fetch ServiceTitan details when invoice is loaded
  useEffect(() => {
    if (invoice) {
      fetchStDetails();
    }
  }, [invoice?.id]);

  async function fetchStDetails() {
    setStDetailsLoading(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/st-details`, {
        credentials: 'include',
      });
      if (!response.ok) return;
      const data = await response.json();
      setStDetails(data);
    } catch (err) {
      console.error('Failed to fetch ST details:', err);
    } finally {
      setStDetailsLoading(false);
    }
  }

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

  async function fetchExpectedPayments() {
    try {
      const response = await fetch(`/api/financing/${invoiceId}/schedule`, {
        credentials: 'include',
      });
      if (!response.ok) return;
      const data = await response.json();
      setExpectedPayments(data.payments || []);
    } catch (err) {
      console.error('Failed to fetch expected payments:', err);
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

  async function fetchJobStatuses() {
    try {
      const response = await fetch('/api/settings/job-statuses', {
        credentials: 'include',
      });
      if (!response.ok) return;
      const data = await response.json();
      setJobStatuses(data.statuses || []);
    } catch (err) {
      console.error('Failed to fetch job statuses:', err);
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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
                  Invoice #{invoice.invoice_number}
                </h1>
                <a
                  href={`https://go.servicetitan.com/#/Invoice/${invoice.st_invoice_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-50 hover:opacity-100 transition-opacity"
                  title="Open in ServiceTitan"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
              <p className="mt-1 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                {invoice.customer_name}
                {(invoice as any).st_customer_id > 0 && (
                  <a
                    href={`https://go.servicetitan.com/#/Customer/${(invoice as any).st_customer_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-50 hover:opacity-100 transition-opacity"
                    title="Open Customer in ServiceTitan"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
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
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                Invoice Details
              </h2>
              {/* Customer Tags */}
              {stDetails?.customerTags && stDetails.customerTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {stDetails.customerTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-2 py-0.5 rounded-full text-xs"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                      }}
                      title={`Tag ID: ${tag.id}`}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
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

          {/* Job Details */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              Job Details
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Job Number</div>
                <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  {invoice.job_number || '-'}
                  {invoice.job_number && (
                    <a
                      href={`https://go.servicetitan.com/#/Job/Index/${invoice.job_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-50 hover:opacity-100 transition-opacity"
                      title="Open Job in ServiceTitan"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Business Unit</div>
                <div style={{ color: 'var(--text-secondary)' }}>{invoice.business_unit_name || '-'}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Job Type</div>
                <div style={{ color: 'var(--text-secondary)' }}>{invoice.st_job_type_name || '-'}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Technician</div>
                <div style={{ color: 'var(--text-secondary)' }}>{stDetails?.technician || '-'}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Location</div>
                <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <span className="truncate">{(invoice as any).location_name || '-'}</span>
                  {(invoice as any).st_location_id > 0 && (
                    <a
                      href={`https://go.servicetitan.com/#/Location/${(invoice as any).st_location_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
                      title="Open Location in ServiceTitan"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Project</div>
                <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <span className="truncate">{(invoice as any).project_name || '-'}</span>
                  {(invoice as any).st_project_id > 0 && (
                    <a
                      href={`https://go.servicetitan.com/#/project/${(invoice as any).st_project_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
                      title="Open Project in ServiceTitan"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Booked Payment Type</div>
                <div style={{ color: 'var(--text-secondary)' }}>{(invoice as any).booking_payment_type || '-'}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Sold By</div>
                <div style={{ color: 'var(--text-secondary)' }}>{stDetails?.soldBy || '-'}</div>
              </div>
            </div>
            {/* Flags row */}
            <div className="flex items-center gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
              {invoice.has_inhouse_financing && (
                <span className="badge badge-financing flex items-center gap-1">
                  💳 In-House Financing
                </span>
              )}
              {invoice.has_membership && (
                <span className="badge flex items-center gap-1" style={{ backgroundColor: 'rgba(147, 51, 234, 0.2)', color: '#a78bfa' }}>
                  🎫 Membership
                </span>
              )}
              {!invoice.has_inhouse_financing && !invoice.has_membership && (
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>No special flags</span>
              )}
            </div>

            {/* Job Summary */}
            {stDetails?.jobSummary && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Job Summary</div>
                <div
                  className="text-sm p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                  dangerouslySetInnerHTML={{ __html: stDetails.jobSummary.replace(/<div>/g, '<br>').replace(/<\/div>/g, '') }}
                />
              </div>
            )}
          </div>

          {/* Invoice Line Items */}
          {stDetails && (stDetails.lineItems.length > 0 || stDetails.invoiceSummary) && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
                Invoice Items
              </h2>

              {/* Invoice Summary */}
              {stDetails.invoiceSummary && (
                <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Summary</div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {stDetails.invoiceSummary}
                  </div>
                </div>
              )}

              {/* Line Items Table */}
              {stDetails.lineItems.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Description</th>
                        <th className="text-right py-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Qty</th>
                        <th className="text-right py-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Unit Price</th>
                        <th className="text-right py-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stDetails.lineItems.map((item) => (
                        <tr key={item.id} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                          <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>
                            {item.description}
                            {item.type && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                                {item.type}
                              </span>
                            )}
                          </td>
                          <td className="text-right py-2 px-2" style={{ color: 'var(--text-secondary)' }}>{item.quantity}</td>
                          <td className="text-right py-2 px-2" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(item.unitPrice)}</td>
                          <td className="text-right py-2 px-2 font-medium" style={{ color: 'var(--christmas-cream)' }}>{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="text-right py-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Total:</td>
                        <td className="text-right py-2 px-2 font-bold" style={{ color: 'var(--christmas-cream)' }}>
                          {formatCurrency(stDetails.lineItems.reduce((sum, item) => sum + item.total, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {stDetailsLoading && (
                <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Loading invoice details...
                </div>
              )}
            </div>
          )}

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

                  {/* Payment Schedule Tracker */}
                  {(financingData.financing_monthly_amount && financingData.financing_due_day) && (
                    <div id="schedule">
                      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>
                        Payment Schedule
                      </h3>
                      <ExpectedPaymentSchedule
                        invoiceId={invoiceId}
                        payments={expectedPayments}
                        onUpdate={fetchExpectedPayments}
                      />
                    </div>
                  )}

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
                  AR Owner
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
                  {jobStatuses.map(status => (
                    <option key={status.key} value={status.key}>{status.label}</option>
                  ))}
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
                  <option value="ar_collectible">Actionable AR</option>
                  <option value="ar_not_in_our_control">Pending Closures</option>
                </select>
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

          {/* Activity */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                Activity
              </h3>
              {canAddNotes && (
                <QuickLogButtons
                  invoiceId={invoiceId}
                  onLogSaved={refreshNotes}
                />
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              <ActivityTimeline notes={invoice.notes} maxItems={5} />
            </div>
          </div>

          {/* Tasks */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
              Tasks
            </h3>
            <TaskList
              invoiceId={invoiceId}
              showFilters={false}
              showCreateButton={false}
              compact={true}
              maxItems={3}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
