'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/ar-utils';
import { FinancingInvoice } from '@/lib/supabase';
import { useARPermissions } from '@/hooks/useARPermissions';
import {
  getPaymentProgress,
  formatDueDay,
  getDaysUntilNextPayment,
  formatDaysUntil,
} from '@/lib/financing-utils';
import PaymentHistory from '@/components/PaymentHistory';

interface FinancingSummary {
  total_outstanding: number;
  total_original: number;
  total_paid: number;
  active_plans: number;
  plans_with_settings: number;
}

export default function FinancingPage() {
  const [invoices, setInvoices] = useState<FinancingInvoice[]>([]);
  const [summary, setSummary] = useState<FinancingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const { canUpdateWorkflow } = useARPermissions();

  useEffect(() => {
    fetchInvoices();
  }, [filterStatus]);

  async function fetchInvoices() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('status', filterStatus);
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`/api/financing?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setInvoices(data.invoices || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchInvoices();
  }

  async function syncPayments() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch('/api/financing/sync', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        const s = data.stats;
        let msg = `Found ${s.payments_found} payments across ${s.invoices_with_payments} invoices. `;
        msg += `Created ${s.payments_created} new, ${s.payments_already_synced} already synced.`;
        if (data.errors?.length > 0) {
          msg += ` Errors: ${data.errors.length}`;
        }
        setSyncResult(msg);
        // Refresh the list
        fetchInvoices();
      } else {
        setSyncResult(`Sync failed: ${data.error}`);
      }
    } catch (err) {
      setSyncResult('Sync failed: Network error');
    } finally {
      setSyncing(false);
      // Clear message after 5 seconds
      setTimeout(() => setSyncResult(null), 5000);
    }
  }

  function toggleExpand(invoiceId: string) {
    setExpandedInvoice(expandedInvoice === invoiceId ? null : invoiceId);
  }

  // Filter invoices by search term (client-side for responsiveness)
  const filteredInvoices = invoices.filter((inv) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      inv.invoice_number.toLowerCase().includes(search) ||
      inv.customer_name.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ color: 'var(--text-muted)' }}>Loading financing plans...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            In-House Financing
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            {summary?.active_plans || 0} active plans · {formatCurrency(summary?.total_outstanding || 0)} total outstanding
          </p>
        </div>
        <button
          className="btn btn-secondary flex items-center gap-2"
          onClick={syncPayments}
          disabled={syncing}
        >
          <svg
            className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {syncing ? 'Syncing...' : 'Sync Payments'}
        </button>
      </div>

      {/* Sync Result Message */}
      {syncResult && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{
            backgroundColor: syncResult.includes('failed')
              ? 'rgba(239, 68, 68, 0.15)'
              : 'rgba(34, 197, 94, 0.15)',
            color: syncResult.includes('failed')
              ? 'var(--status-error)'
              : 'var(--christmas-green)',
          }}
        >
          {syncResult}
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Search
            </label>
            <input
              type="text"
              className="input"
              placeholder="Invoice # or customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Status
            </label>
            <select
              className="select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="active">Active (Balance &gt; 0)</option>
              <option value="paid">Paid Off</option>
              <option value="all">All</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn btn-secondary">
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Stats Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Outstanding</div>
            <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--status-error)' }}>
              {formatCurrency(summary.total_outstanding)}
            </div>
          </div>
          <div className="card">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Paid</div>
            <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--christmas-green)' }}>
              {formatCurrency(summary.total_paid)}
            </div>
          </div>
          <div className="card">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Original Amount</div>
            <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {formatCurrency(summary.total_original)}
            </div>
          </div>
          <div className="card">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Active Plans</div>
            <div className="text-2xl font-bold mt-1" style={{ color: 'var(--christmas-cream)' }}>
              {summary.active_plans}
            </div>
          </div>
          <div className="card">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Plans Configured</div>
            <div className="text-2xl font-bold mt-1" style={{ color: 'var(--christmas-green)' }}>
              {summary.plans_with_settings}
              <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>
                / {summary.active_plans}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Invoices Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ar-table">
            <thead>
              <tr>
                <th></th>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Invoice Date</th>
                <th className="text-right">Balance</th>
                <th className="text-right">Original</th>
                <th className="text-right">Monthly</th>
                <th className="text-center">Paid</th>
                <th>Next Due</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                    No financing plans found
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => {
                  const isExpanded = expandedInvoice === invoice.id;
                  const progress = getPaymentProgress(invoice.invoice_total, invoice.balance);
                  const hasSettings = invoice.financing_monthly_amount && invoice.financing_due_day;
                  const daysUntil = invoice.next_due_date
                    ? getDaysUntilNextPayment(invoice.next_due_date)
                    : null;
                  const isOverdue = daysUntil !== null && daysUntil < 0;

                  return (
                    <>
                      <tr
                        key={invoice.id}
                        className="cursor-pointer hover:bg-opacity-50"
                        onClick={() => toggleExpand(invoice.id)}
                        style={{ backgroundColor: isExpanded ? 'var(--bg-secondary)' : undefined }}
                      >
                        <td className="w-8">
                          <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/invoices/${invoice.id}`}
                              className="font-medium hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {invoice.invoice_number}
                            </Link>
                            <a
                              href={`https://go.servicetitan.com/#/Invoice/${invoice.st_invoice_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="opacity-50 hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                              title="Open in ServiceTitan"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span>{invoice.customer_name}</span>
                            {invoice.st_customer_id && (
                              <a
                                href={`https://go.servicetitan.com/#/Customer/${invoice.st_customer_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opacity-50 hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                                title="Open customer in ServiceTitan"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {formatDate(invoice.invoice_date)}
                        </td>
                        <td className="text-right font-medium tabular-nums" style={{ color: 'var(--status-error)' }}>
                          {formatCurrency(invoice.balance)}
                        </td>
                        <td className="text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {formatCurrency(invoice.invoice_total)}
                        </td>
                        <td className="text-right tabular-nums">
                          {invoice.financing_monthly_amount
                            ? formatCurrency(invoice.financing_monthly_amount)
                            : (
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Not set
                              </span>
                            )}
                        </td>
                        <td className="text-center">
                          <span
                            className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-sm"
                            style={{
                              backgroundColor: invoice.payments_made > 0
                                ? 'rgba(34, 197, 94, 0.15)'
                                : 'var(--bg-secondary)',
                              color: invoice.payments_made > 0
                                ? 'var(--christmas-green)'
                                : 'var(--text-muted)',
                            }}
                          >
                            {invoice.payments_made}
                          </span>
                        </td>
                        <td>
                          {invoice.next_due_date ? (
                            <div>
                              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {formatDate(invoice.next_due_date)}
                              </div>
                              <div
                                className="text-xs"
                                style={{
                                  color: isOverdue ? 'var(--status-error)' : 'var(--text-muted)',
                                }}
                              >
                                {formatDaysUntil(daysUntil!)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {hasSettings ? 'N/A' : 'Configure plan'}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="w-24">
                            <div className="flex items-center gap-2">
                              <div
                                className="flex-1 h-2 rounded-full overflow-hidden"
                                style={{ backgroundColor: 'var(--bg-secondary)' }}
                              >
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${progress}%`,
                                    backgroundColor: progress === 100
                                      ? 'var(--christmas-green)'
                                      : 'var(--christmas-red)',
                                  }}
                                />
                              </div>
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {progress}%
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${invoice.id}-expanded`}>
                          <td colSpan={10} style={{ backgroundColor: 'var(--bg-secondary)' }}>
                            <div className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Payment Settings */}
                                <div>
                                  <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>
                                    Payment Plan Settings
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span style={{ color: 'var(--text-muted)' }}>Monthly Payment:</span>
                                      <span style={{ color: 'var(--christmas-cream)' }}>
                                        {invoice.financing_monthly_amount
                                          ? formatCurrency(invoice.financing_monthly_amount)
                                          : 'Not configured'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span style={{ color: 'var(--text-muted)' }}>Due Day:</span>
                                      <span style={{ color: 'var(--christmas-cream)' }}>
                                        {invoice.financing_due_day
                                          ? formatDueDay(invoice.financing_due_day)
                                          : 'Not set'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span style={{ color: 'var(--text-muted)' }}>Start Date:</span>
                                      <span style={{ color: 'var(--christmas-cream)' }}>
                                        {invoice.financing_start_date
                                          ? formatDate(invoice.financing_start_date)
                                          : 'Not set'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span style={{ color: 'var(--text-muted)' }}>Projected Payoff:</span>
                                      <span style={{ color: 'var(--christmas-green)' }}>
                                        {invoice.projected_payoff_date
                                          ? `${formatDate(invoice.projected_payoff_date)} (${invoice.payments_remaining} left)`
                                          : 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="mt-4">
                                    <Link
                                      href={`/invoices/${invoice.id}`}
                                      className="btn btn-secondary btn-sm"
                                    >
                                      {hasSettings ? 'Edit Settings' : 'Configure Plan'}
                                    </Link>
                                  </div>
                                </div>

                                {/* Payment History */}
                                <div>
                                  <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>
                                    Payment History
                                  </h4>
                                  <PaymentHistory
                                    payments={invoice.payments}
                                    invoiceTotal={invoice.invoice_total}
                                    dueDay={invoice.financing_due_day}
                                    compact={true}
                                  />
                                </div>
                              </div>

                              {/* Notes */}
                              {invoice.financing_notes && (
                                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                  <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--christmas-cream)' }}>
                                    Notes
                                  </h4>
                                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    {invoice.financing_notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
