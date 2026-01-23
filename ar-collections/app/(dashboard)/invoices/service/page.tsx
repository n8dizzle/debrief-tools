'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate, getAgingBucketLabel } from '@/lib/ar-utils';
import { ARInvoice, ARInvoiceTracking, PortalUser } from '@/lib/supabase';
import { useARPermissions } from '@/hooks/useARPermissions';

interface InvoiceWithTracking extends ARInvoice {
  tracking: ARInvoiceTracking | null;
}

type FilterState = {
  search: string;
  owner: string;
  controlBucket: string;
  jobStatus: string;
  agingBucket: string;
  customerType: string;
};

export default function ServiceInvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceWithTracking[]>([]);
  const [owners, setOwners] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    owner: '',
    controlBucket: '',
    jobStatus: '',
    agingBucket: '',
    customerType: '',
  });
  const { canUpdateWorkflow, canAssignOwner } = useARPermissions();

  useEffect(() => {
    fetchInvoices();
    fetchOwners();
  }, []);

  async function fetchInvoices() {
    try {
      const response = await fetch('/api/invoices?job_type=service', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch invoices');
      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
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

  async function updateTracking(invoiceId: string, field: string, value: any) {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/tracking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) throw new Error('Failed to update');
      const updated = await response.json();
      setInvoices(prev => prev.map(inv =>
        inv.id === invoiceId ? { ...inv, tracking: updated.tracking } : inv
      ));
    } catch (err) {
      console.error('Update failed:', err);
    }
  }

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (
        !inv.customer_name.toLowerCase().includes(search) &&
        !inv.invoice_number.toLowerCase().includes(search)
      ) {
        return false;
      }
    }
    if (filters.owner && inv.tracking?.owner_id !== filters.owner) return false;
    if (filters.controlBucket && inv.tracking?.control_bucket !== filters.controlBucket) return false;
    if (filters.jobStatus && inv.tracking?.job_status !== filters.jobStatus) return false;
    if (filters.agingBucket && inv.aging_bucket !== filters.agingBucket) return false;
    if (filters.customerType && inv.customer_type !== filters.customerType) return false;
    return true;
  });

  // Calculate totals
  const totalBalance = filteredInvoices.reduce((sum, inv) => sum + Number(inv.balance), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ color: 'var(--text-muted)' }}>Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Service Jobs AR
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            {filteredInvoices.length} invoices · {formatCurrency(totalBalance)} outstanding
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/invoices/install" className="btn btn-secondary">
            View Install AR
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Search
            </label>
            <input
              type="text"
              className="input"
              placeholder="Customer or Invoice #"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Owner
            </label>
            <select
              className="select"
              value={filters.owner}
              onChange={(e) => setFilters(prev => ({ ...prev, owner: e.target.value }))}
            >
              <option value="">All Owners</option>
              {owners.map(owner => (
                <option key={owner.id} value={owner.id}>{owner.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Control Bucket
            </label>
            <select
              className="select"
              value={filters.controlBucket}
              onChange={(e) => setFilters(prev => ({ ...prev, controlBucket: e.target.value }))}
            >
              <option value="">All</option>
              <option value="ar_collectible">AR Collectible</option>
              <option value="ar_not_in_our_control">Not In Control</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Job Status
            </label>
            <select
              className="select"
              value={filters.jobStatus}
              onChange={(e) => setFilters(prev => ({ ...prev, jobStatus: e.target.value }))}
            >
              <option value="">All</option>
              <option value="emailed_customer">Emailed Customer</option>
              <option value="called_customer">Called Customer</option>
              <option value="payment_promised">Payment Promised</option>
              <option value="job_not_done">Job Not Done</option>
              <option value="need_clarification">Need Clarification</option>
              <option value="tech_question">Tech Question</option>
              <option value="financing_pending">Financing Pending</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Aging
            </label>
            <select
              className="select"
              value={filters.agingBucket}
              onChange={(e) => setFilters(prev => ({ ...prev, agingBucket: e.target.value }))}
            >
              <option value="">All</option>
              <option value="current">Current</option>
              <option value="30">31-60 Days</option>
              <option value="60">61-90 Days</option>
              <option value="90+">90+ Days</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              R/C
            </label>
            <select
              className="select"
              value={filters.customerType}
              onChange={(e) => setFilters(prev => ({ ...prev, customerType: e.target.value }))}
            >
              <option value="">All</option>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ar-table">
            <thead>
              <tr>
                <th>Owner</th>
                <th>Date</th>
                <th>Inv #</th>
                <th>Customer</th>
                <th>R/C</th>
                <th>Balance</th>
                <th>Job Status</th>
                <th>Day 1</th>
                <th>Day 2</th>
                <th>Day 3</th>
                <th>Day 7</th>
                <th>Closed</th>
                <th>DSO</th>
                <th>Bucket</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                    No invoices found
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className={invoice.tracking?.closed ? 'row-closed' : ''}
                  >
                    <td>
                      {canAssignOwner ? (
                        <select
                          className="select text-xs py-1"
                          value={invoice.tracking?.owner_id || ''}
                          onChange={(e) => updateTracking(invoice.id, 'owner_id', e.target.value || null)}
                        >
                          <option value="">-</option>
                          {owners.map(owner => (
                            <option key={owner.id} value={owner.id}>
                              {owner.name?.split(' ')[0]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs">
                          {owners.find(o => o.id === invoice.tracking?.owner_id)?.name?.split(' ')[0] || '-'}
                        </span>
                      )}
                    </td>
                    <td className="text-xs">{formatDate(invoice.invoice_date)}</td>
                    <td>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-medium hover:underline"
                      >
                        {invoice.invoice_number}
                      </Link>
                    </td>
                    <td className="max-w-[150px] truncate" title={invoice.customer_name}>
                      {invoice.customer_name}
                    </td>
                    <td>
                      <span className={`badge ${invoice.customer_type === 'residential' ? 'badge-residential' : 'badge-commercial'}`}>
                        {invoice.customer_type === 'residential' ? 'R' : 'C'}
                      </span>
                    </td>
                    <td className="font-medium" style={{ color: 'var(--status-error)' }}>
                      {formatCurrency(invoice.balance)}
                    </td>
                    <td>
                      <select
                        className="select text-xs py-1"
                        value={invoice.tracking?.job_status || ''}
                        onChange={(e) => updateTracking(invoice.id, 'job_status', e.target.value || null)}
                        disabled={!canUpdateWorkflow}
                      >
                        <option value="">-</option>
                        <option value="emailed_customer">Emailed</option>
                        <option value="called_customer">Called</option>
                        <option value="payment_promised">Promised</option>
                        <option value="job_not_done">Not Done</option>
                        <option value="need_clarification">Clarify</option>
                        <option value="tech_question">Tech Q</option>
                        <option value="financing_pending">Financing</option>
                      </select>
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={invoice.tracking?.day1_text_sent || false}
                        onChange={(e) => updateTracking(invoice.id, 'day1_text_sent', e.target.checked)}
                        disabled={!canUpdateWorkflow}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={invoice.tracking?.day2_call_made || false}
                        onChange={(e) => updateTracking(invoice.id, 'day2_call_made', e.target.checked)}
                        disabled={!canUpdateWorkflow}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={invoice.tracking?.day3_etc || false}
                        onChange={(e) => updateTracking(invoice.id, 'day3_etc', e.target.checked)}
                        disabled={!canUpdateWorkflow}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={invoice.tracking?.day7_etc || false}
                        onChange={(e) => updateTracking(invoice.id, 'day7_etc', e.target.checked)}
                        disabled={!canUpdateWorkflow}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={invoice.tracking?.closed || false}
                        onChange={(e) => updateTracking(invoice.id, 'closed', e.target.checked)}
                        disabled={!canUpdateWorkflow}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="text-xs">{invoice.days_outstanding}</td>
                    <td>
                      <span className={`badge badge-${invoice.aging_bucket === '90+' ? '90' : invoice.aging_bucket}`}>
                        {getAgingBucketLabel(invoice.aging_bucket)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
