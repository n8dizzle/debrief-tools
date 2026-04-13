'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/ap-utils';
import { APContractor } from '@/lib/supabase';

interface ReportRow {
  job_number: string;
  customer_name: string;
  trade: string;
  job_type: string;
  job_total: number;
  contractor: string;
  payment_status: string;
  payment_amount: number;
  invoice_source: string;
  payment_notes: string;
  completed_on: string;
  approved_by: string;
  approved_at: string;
  paid_by: string;
  paid_at: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getDefaultRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const startMonth = String(start.getMonth() + 1).padStart(2, '0');
  return {
    start: `${year}-${startMonth}-01`,
    end: `${year}-${month}-${day}`,
  };
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'ready_to_pay', label: 'Ready to Pay' },
  { value: 'paid', label: 'Paid' },
];

const TRADE_OPTIONS = [
  { value: '', label: 'All Trades' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'plumbing', label: 'Plumbing' },
];

export default function ReportsPage() {
  const defaultRange = getDefaultRange();
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [contractorId, setContractorId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [trade, setTrade] = useState('');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [contractors, setContractors] = useState<APContractor[]>([]);

  useEffect(() => {
    fetch('/api/contractors')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setContractors(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, contractorId, paymentStatus, trade]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
      if (contractorId) params.set('contractor_id', contractorId);
      if (paymentStatus) params.set('payment_status', paymentStatus);
      if (trade) params.set('trade', trade);

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows || []);
      }
    } catch (err) {
      console.error('Report fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    if (contractorId) params.set('contractor_id', contractorId);
    if (paymentStatus) params.set('payment_status', paymentStatus);
    if (trade) params.set('trade', trade);
    params.set('format', 'csv');
    window.open(`/api/reports?${params.toString()}`, '_blank');
  };

  const totalAmount = rows.reduce((sum, r) => sum + (r.payment_amount || 0), 0);
  const totalJobValue = rows.reduce((sum, r) => sum + (r.job_total || 0), 0);
  const paidCount = rows.filter(r => r.payment_status === 'paid').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Payment Reports
        </h1>
        <button
          onClick={handleExportCSV}
          disabled={rows.length === 0}
          className="btn btn-primary gap-2"
          style={{ opacity: rows.length === 0 ? 0.5 : 1 }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Status</label>
            <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="select w-full">
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Contractor</label>
            <select value={contractorId} onChange={e => setContractorId(e.target.value)} className="select w-full">
              <option value="">All Contractors</option>
              {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Trade</label>
            <select value={trade} onChange={e => setTrade(e.target.value)} className="select w-full">
              {TRADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="card">
          <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Total Payments</p>
          <p className="text-xl font-bold mt-1" style={{ color: 'var(--christmas-cream)' }}>{rows.length}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Total Amount</p>
          <p className="text-xl font-bold mt-1" style={{ color: 'var(--christmas-cream)' }}>{formatCurrency(totalAmount)}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Job Value</p>
          <p className="text-xl font-bold mt-1" style={{ color: 'var(--christmas-cream)' }}>{formatCurrency(totalJobValue)}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Paid</p>
          <p className="text-xl font-bold mt-1" style={{ color: '#4ade80' }}>{paidCount} of {rows.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['Job #', 'Customer', 'Contractor', 'Trade', 'Amount', 'Status', 'Approved By', 'Approved', 'Paid By', 'Paid', 'Notes'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>No payments found for this period.</td></tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{row.job_number}</td>
                  <td className="px-3 py-2 text-xs truncate max-w-[120px]" style={{ color: 'var(--text-secondary)' }}>{row.customer_name}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-primary)' }}>{row.contractor}</td>
                  <td className="px-3 py-2 text-xs uppercase" style={{ color: 'var(--text-muted)' }}>{row.trade}</td>
                  <td className="px-3 py-2 text-xs font-medium" style={{ color: 'var(--christmas-cream)' }}>{formatCurrency(row.payment_amount)}</td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{
                        backgroundColor: row.payment_status === 'paid' ? 'rgba(74,222,128,0.15)' :
                          row.payment_status === 'ready_to_pay' ? 'rgba(96,165,250,0.15)' :
                          'rgba(252,211,77,0.15)',
                        color: row.payment_status === 'paid' ? '#4ade80' :
                          row.payment_status === 'ready_to_pay' ? '#60a5fa' : '#fcd34d',
                      }}
                    >
                      {row.payment_status === 'paid' ? 'Paid' :
                       row.payment_status === 'ready_to_pay' ? 'Ready to Pay' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{row.approved_by}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(row.approved_at)}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{row.paid_by}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(row.paid_at)}</td>
                  <td className="px-3 py-2 text-xs truncate max-w-[150px]" style={{ color: 'var(--text-muted)' }} title={row.payment_notes}>{row.payment_notes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
