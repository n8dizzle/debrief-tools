'use client';

import { useEffect, useState, Fragment } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/ar-utils';
import { FinancingInvoice, FinancingExpectedPayment } from '@/lib/supabase';
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

type SortColumn = 'invoice_number' | 'invoice_date' | 'customer_name' | 'balance' | 'invoice_total' | 'financing_monthly_amount' | 'payments_made' | 'status' | 'next_due_date' | 'progress';
type SortDirection = 'asc' | 'desc';

export default function FinancingPage() {
  const [invoices, setInvoices] = useState<FinancingInvoice[]>([]);
  const [summary, setSummary] = useState<FinancingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [expectedPayments, setExpectedPayments] = useState<Record<string, FinancingExpectedPayment[]>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('invoice_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const { canUpdateWorkflow } = useARPermissions();

  useEffect(() => {
    fetchInvoices();
  }, [filterStatus]);

  useEffect(() => {
    fetchLastSync();
  }, []);

  async function fetchLastSync() {
    try {
      const response = await fetch('/api/sync/last', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setLastSyncAt(data.last_sync_at);
      }
    } catch (err) {
      console.error('Failed to fetch last sync:', err);
    }
  }

  useEffect(() => {
    if (expandedInvoice) {
      fetchExpectedPayments(expandedInvoice);
    }
  }, [expandedInvoice]);

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

  async function fetchExpectedPayments(invoiceId: string) {
    try {
      const response = await fetch(`/api/financing/${invoiceId}/schedule`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setExpectedPayments((prev) => ({
          ...prev,
          [invoiceId]: data.payments || [],
        }));
      }
    } catch (err) {
      console.error('Error fetching expected payments:', err);
    }
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

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  function getSortValue(invoice: FinancingInvoice, column: SortColumn): string | number {
    switch (column) {
      case 'invoice_number':
        return invoice.invoice_number;
      case 'invoice_date':
        return invoice.invoice_date || '';
      case 'customer_name':
        return invoice.customer_name.toLowerCase();
      case 'balance':
        return invoice.balance;
      case 'invoice_total':
        return invoice.invoice_total;
      case 'financing_monthly_amount':
        return invoice.financing_monthly_amount || 0;
      case 'payments_made':
        return invoice.payments_made;
      case 'status':
        return invoice.schedule_status?.missed || 0;
      case 'next_due_date':
        return invoice.next_due_date || 'zzzz'; // Sort empty dates to end
      case 'progress':
        return getPaymentProgress(invoice.invoice_total, invoice.balance);
      default:
        return '';
    }
  }

  // Filter and sort invoices (client-side for responsiveness)
  const filteredInvoices = invoices
    .filter((inv) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        inv.invoice_number.toLowerCase().includes(search) ||
        inv.customer_name.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      const aVal = getSortValue(a, sortColumn);
      const bVal = getSortValue(b, sortColumn);

      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else {
        comparison = (aVal as number) - (bVal as number);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
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
            {lastSyncAt && (
              <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                • Last synced {new Date(lastSyncAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </span>
            )}
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
            <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: '#f97316' }}>
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

      {/* Delinquent Summary */}
      {(() => {
        const delinquentInvoices = filteredInvoices.filter(inv => inv.schedule_status?.missed && inv.schedule_status.missed > 0);
        const totalMissedPayments = delinquentInvoices.reduce((sum, inv) => sum + (inv.schedule_status?.missed || 0), 0);
        // Calculate delinquent amount: missed payments × monthly amount for each invoice
        const delinquentAmount = delinquentInvoices.reduce((sum, inv) => {
          const missedCount = inv.schedule_status?.missed || 0;
          const monthlyAmount = inv.financing_monthly_amount || 0;
          return sum + (missedCount * monthlyAmount);
        }, 0);

        if (delinquentInvoices.length === 0) return null;

        return (
          <div
            className="p-4 rounded-lg flex items-center justify-between"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="var(--status-error)" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold" style={{ color: 'var(--status-error)' }}>
                  {delinquentInvoices.length} Delinquent {delinquentInvoices.length === 1 ? 'Account' : 'Accounts'}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {totalMissedPayments} missed {totalMissedPayments === 1 ? 'payment' : 'payments'} totaling {formatCurrency(delinquentAmount)} delinquent
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Invoices Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ar-table">
            <thead>
              <tr>
                <th></th>
                <th
                  className="cursor-pointer hover:bg-opacity-80 select-none"
                  onClick={() => handleSort('invoice_number')}
                >
                  <div className="flex items-center gap-1">
                    Invoice #
                    {sortColumn === 'invoice_number' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        {sortDirection === 'asc' ? (
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        )}
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="cursor-pointer hover:bg-opacity-80 select-none"
                  onClick={() => handleSort('invoice_date')}
                >
                  <div className="flex items-center gap-1">
                    Invoice Date
                    {sortColumn === 'invoice_date' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        {sortDirection === 'asc' ? (
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        )}
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="cursor-pointer hover:bg-opacity-80 select-none"
                  onClick={() => handleSort('customer_name')}
                >
                  <div className="flex items-center gap-1">
                    Customer
                    {sortColumn === 'customer_name' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        {sortDirection === 'asc' ? (
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        )}
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="cursor-pointer hover:bg-opacity-80 select-none"
                  onClick={() => handleSort('balance')}
                >
                  <div className="flex items-center gap-1">
                    Balance
                    {sortColumn === 'balance' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        {sortDirection === 'asc' ? (
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        )}
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="cursor-pointer hover:bg-opacity-80 select-none"
                  onClick={() => handleSort('invoice_total')}
                >
                  <div className="flex items-center gap-1">
                    Original
                    {sortColumn === 'invoice_total' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        {sortDirection === 'asc' ? (
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        )}
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="cursor-pointer hover:bg-opacity-80 select-none"
                  onClick={() => handleSort('financing_monthly_amount')}
                >
                  <div className="flex items-center gap-1">
                    Monthly
                    {sortColumn === 'financing_monthly_amount' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        {sortDirection === 'asc' ? (
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        )}
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="cursor-pointer hover:bg-opacity-80 select-none"
                  onClick={() => handleSort('payments_made')}
                >
                  <div className="flex items-center gap-1">
                    Paid
                    {sortColumn === 'payments_made' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        {sortDirection === 'asc' ? (
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        )}
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="cursor-pointer hover:bg-opacity-80 select-none"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {sortColumn === 'status' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        {sortDirection === 'asc' ? (
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        )}
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="cursor-pointer hover:bg-opacity-80 select-none"
                  onClick={() => handleSort('next_due_date')}
                >
                  <div className="flex items-center gap-1">
                    Next Due
                    {sortColumn === 'next_due_date' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        {sortDirection === 'asc' ? (
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        )}
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="cursor-pointer hover:bg-opacity-80 select-none"
                  onClick={() => handleSort('progress')}
                >
                  <div className="flex items-center gap-1">
                    Progress
                    {sortColumn === 'progress' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        {sortDirection === 'asc' ? (
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        )}
                      </svg>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
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
                    <Fragment key={invoice.id}>
                      <tr
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
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {formatDate(invoice.invoice_date)}
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
                        <td className="font-medium tabular-nums" style={{ color: '#f97316' }}>
                          {formatCurrency(invoice.balance)}
                        </td>
                        <td className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {formatCurrency(invoice.invoice_total)}
                        </td>
                        <td className="tabular-nums">
                          {invoice.financing_monthly_amount
                            ? formatCurrency(invoice.financing_monthly_amount)
                            : (
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Not set
                              </span>
                            )}
                        </td>
                        <td>
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
                          {invoice.schedule_status ? (
                            invoice.schedule_status.missed > 0 ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                                style={{
                                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                  color: 'var(--status-error)',
                                }}
                                title={`${invoice.schedule_status.missed} missed payment(s)`}
                              >
                                Delinquent ({invoice.schedule_status.missed})
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                                style={{
                                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                  color: 'var(--christmas-green)',
                                }}
                              >
                                Current
                              </span>
                            )
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              —
                            </span>
                          )}
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
                                    backgroundColor: 'var(--christmas-green)',
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
                        <tr>
                          <td colSpan={11} style={{ backgroundColor: 'var(--bg-secondary)' }}>
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

                                {/* Payment History from ST */}
                                <div>
                                  <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>
                                    ServiceTitan Payments
                                  </h4>
                                  <PaymentHistory
                                    payments={invoice.payments}
                                    invoiceTotal={invoice.invoice_total}
                                    dueDay={invoice.financing_due_day}
                                    compact={true}
                                  />
                                </div>
                              </div>

                              {/* Payment Schedule Summary */}
                              {hasSettings && (
                                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                                      Payment Schedule
                                    </h4>
                                    <Link
                                      href={`/invoices/${invoice.id}#schedule`}
                                      className="btn btn-secondary btn-sm"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      View Full Schedule
                                    </Link>
                                  </div>
                                  {expectedPayments[invoice.id]?.length > 0 ? (
                                    <div className="flex gap-4 mt-2 text-sm">
                                      <span style={{ color: 'var(--christmas-green)' }}>
                                        {expectedPayments[invoice.id].filter(p => p.status === 'paid').length} Paid
                                      </span>
                                      {expectedPayments[invoice.id].filter(p => p.status === 'late').length > 0 && (
                                        <span style={{ color: 'var(--status-warning)' }}>
                                          {expectedPayments[invoice.id].filter(p => p.status === 'late').length} Late
                                        </span>
                                      )}
                                      {expectedPayments[invoice.id].filter(p => p.status === 'missed').length > 0 && (
                                        <span style={{ color: 'var(--status-error)' }}>
                                          {expectedPayments[invoice.id].filter(p => p.status === 'missed').length} Missed
                                        </span>
                                      )}
                                      <span style={{ color: 'var(--text-muted)' }}>
                                        {expectedPayments[invoice.id].filter(p => p.status === 'pending').length} Pending
                                      </span>
                                    </div>
                                  ) : (
                                    <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                                      No schedule generated yet. <Link href={`/invoices/${invoice.id}#schedule`} className="underline" onClick={(e) => e.stopPropagation()}>Generate schedule</Link>
                                    </p>
                                  )}
                                </div>
                              )}

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
                    </Fragment>
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
