'use client';

import { useState, useEffect, useMemo } from 'react';

interface InvoiceItem {
  id: number;
  invoiceNumber: string;
  status: string;
  customerName: string;
  businessUnitName: string;
  total: number;
  balance: number;
  createdOn: string;
  invoiceDate: string;
  ageHours: number;
  jobId: number | null;
  jobNumber: string | null;
}

interface StatusBucket {
  count: number;
  total: number;
  avgAgeHours: number;
  estimated?: boolean;
}

interface Summary {
  pending: StatusBucket;
  posted: StatusBucket;
}

interface SnapshotRow {
  snapshot_date: string;
  pending_count: number;
  pending_total: number;
  posted_count: number;
  posted_total: number;
  avg_pending_age_hours: number;
  avg_posted_age_hours: number;
}

interface AuditData {
  invoices: InvoiceItem[];
  summary: Summary;
  history: SnapshotRow[];
  fetchedAt: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents);
}

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  const h = Math.round(hours - days * 24);
  return h > 0 ? `${days}d ${h}h` : `${days}d`;
}

function formatDate(isoString: string): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Simple inline SVG bar chart for history
function TrendChart({ history }: { history: SnapshotRow[] }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">No historical data yet.</p>
        <p className="text-xs mt-1">Snapshots are taken daily at 6am CT.</p>
      </div>
    );
  }

  const maxTotal = Math.max(
    ...history.map(h => h.pending_total + h.posted_total),
    1
  );

  const chartHeight = 200;
  const barWidth = Math.min(40, Math.max(12, (800 / history.length) - 4));
  const chartWidth = history.length * (barWidth + 4);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: Math.max(chartWidth, 300) }}>
        {/* Y-axis label */}
        <div className="flex items-end gap-1 mb-1">
          <span className="text-xs" style={{ color: 'var(--text-muted)', width: 60, textAlign: 'right' }}>
            {formatCurrency(maxTotal)}
          </span>
        </div>

        {/* Chart area */}
        <div className="flex items-end gap-1" style={{ height: chartHeight, marginLeft: 64 }}>
          {history.map((snap, i) => {
            const pendingHeight = maxTotal > 0 ? (snap.pending_total / maxTotal) * chartHeight : 0;
            const postedHeight = maxTotal > 0 ? (snap.posted_total / maxTotal) * chartHeight : 0;
            const totalHeight = pendingHeight + postedHeight;

            return (
              <div key={snap.snapshot_date} className="flex flex-col items-center" style={{ width: barWidth }}>
                <div className="relative group flex flex-col justify-end" style={{ height: chartHeight }}>
                  {/* Tooltip */}
                  <div
                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 rounded-lg px-3 py-2 text-xs whitespace-nowrap"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}
                  >
                    <p style={{ color: 'var(--christmas-cream)' }}>{formatShortDate(snap.snapshot_date)}</p>
                    <p style={{ color: '#fcd34d' }}>Pending: {formatCurrency(snap.pending_total)} ({snap.pending_count})</p>
                    <p style={{ color: '#60a5fa' }}>Posted: {formatCurrency(snap.posted_total)} ({snap.posted_count})</p>
                  </div>

                  {/* Stacked bar */}
                  <div
                    className="rounded-t"
                    style={{
                      width: barWidth,
                      height: Math.max(pendingHeight, totalHeight > 0 ? 2 : 0),
                      background: '#fcd34d',
                      opacity: 0.8,
                    }}
                  />
                  <div
                    className="rounded-b"
                    style={{
                      width: barWidth,
                      height: Math.max(postedHeight, totalHeight > 0 ? 2 : 0),
                      background: '#60a5fa',
                      opacity: 0.8,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex gap-1" style={{ marginLeft: 64 }}>
          {history.map((snap, i) => {
            // Show every Nth label to avoid overlap
            const showLabel = history.length <= 14 || i % Math.ceil(history.length / 14) === 0;
            return (
              <div key={snap.snapshot_date} className="text-center" style={{ width: barWidth }}>
                {showLabel && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatShortDate(snap.snapshot_date)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-3" style={{ marginLeft: 64 }}>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: '#fcd34d', opacity: 0.8 }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: '#60a5fa', opacity: 0.8 }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Posted</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Average age trend line
function AgeTrendChart({ history }: { history: SnapshotRow[] }) {
  if (history.length < 2) return null;

  const maxAge = Math.max(
    ...history.map(h => Math.max(h.avg_pending_age_hours, h.avg_posted_age_hours)),
    24
  );

  const chartHeight = 120;
  const chartWidth = Math.max(history.length * 20, 300);

  const pendingPoints = history.map((h, i) => {
    const x = (i / (history.length - 1)) * chartWidth;
    const y = chartHeight - (h.avg_pending_age_hours / maxAge) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  const postedPoints = history.map((h, i) => {
    const x = (i / (history.length - 1)) * chartWidth;
    const y = chartHeight - (h.avg_posted_age_hours / maxAge) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
        Average Age Trend (hours)
      </h3>
      <div className="overflow-x-auto">
        <svg width={chartWidth} height={chartHeight + 20} className="block">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(frac => (
            <line
              key={frac}
              x1={0} y1={chartHeight - frac * chartHeight}
              x2={chartWidth} y2={chartHeight - frac * chartHeight}
              stroke="var(--border-subtle)" strokeWidth={1}
            />
          ))}
          {/* Pending line */}
          <polyline
            points={pendingPoints}
            fill="none" stroke="#fcd34d" strokeWidth={2} strokeLinejoin="round"
          />
          {/* Posted line */}
          <polyline
            points={postedPoints}
            fill="none" stroke="#60a5fa" strokeWidth={2} strokeLinejoin="round"
          />
          {/* Y label */}
          <text x={0} y={12} fontSize={10} fill="var(--text-muted)">{formatDuration(maxAge)}</text>
          <text x={0} y={chartHeight + 12} fontSize={10} fill="var(--text-muted)">0h</text>
        </svg>
      </div>
    </div>
  );
}

export default function InvoiceStatusPage() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterBU, setFilterBU] = useState<string>('all');
  const [snapshotting, setSnapshotting] = useState(false);
  const [sortKey, setSortKey] = useState<string>('ageHours');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch('/api/audit/invoice-status')
      .then(res => res.json())
      .then(result => {
        if (result.error) {
          setError(result.error);
        } else {
          setData(result);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    try {
      const res = await fetch('/api/cron/invoice-snapshot');
      const result = await res.json();
      if (result.error) {
        alert(`Snapshot failed: ${result.error}`);
      } else {
        // Refresh data
        const refreshRes = await fetch('/api/audit/invoice-status');
        const refreshData = await refreshRes.json();
        if (!refreshData.error) setData(refreshData);
      }
    } catch (err) {
      alert('Snapshot failed');
    } finally {
      setSnapshotting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: 'var(--border-default)', borderTopColor: 'var(--christmas-green)' }}
          />
          <p style={{ color: 'var(--text-muted)' }}>Fetching invoice data from ServiceTitan...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
        <p className="font-medium" style={{ color: '#f87171' }}>Error loading invoice data</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { summary, invoices, history } = data;

  const businessUnits = [...new Set(invoices.map(i => i.businessUnitName))].sort();

  const filteredInvoices = invoices.filter(inv => {
    if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
    if (filterBU !== 'all' && inv.businessUnitName !== filterBU) return false;
    return true;
  });

  const sortedInvoices = useMemo(() => {
    return [...filteredInvoices].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sortKey) {
        case 'status': aVal = a.status; bVal = b.status; break;
        case 'invoiceNumber': aVal = a.invoiceNumber; bVal = b.invoiceNumber; break;
        case 'customerName': aVal = a.customerName; bVal = b.customerName; break;
        case 'businessUnitName': aVal = a.businessUnitName; bVal = b.businessUnitName; break;
        case 'jobNumber': aVal = a.jobNumber || ''; bVal = b.jobNumber || ''; break;
        case 'total': aVal = a.total; bVal = b.total; break;
        case 'invoiceDate': aVal = a.invoiceDate; bVal = b.invoiceDate; break;
        case 'ageHours': aVal = a.ageHours; bVal = b.ageHours; break;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredInvoices, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'ageHours' || key === 'total' ? 'desc' : 'asc');
    }
  };

  const SortHeader = ({ label, colKey, align }: { label: string; colKey: string; align?: string }) => (
    <th
      onClick={() => handleSort(colKey)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
      className={align === 'right' ? 'text-right' : ''}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === colKey && (
          <span style={{ fontSize: '0.6rem' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
        )}
      </span>
    </th>
  );

  const statusCards: { label: string; key: keyof Summary; color: string; bgColor: string }[] = [
    { label: 'Pending', key: 'pending', color: '#fcd34d', bgColor: 'rgba(234, 179, 8, 0.15)' },
    { label: 'Posted', key: 'posted', color: '#60a5fa', bgColor: 'rgba(59, 130, 246, 0.15)' },
  ];

  const totalCount = summary.pending.count + summary.posted.count;
  const totalDollar = summary.pending.total + summary.posted.total;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Invoice Status Audit
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Track pending and posted invoices needing attention
          </p>
        </div>
        <button
          onClick={handleSnapshot}
          disabled={snapshotting}
          className="btn btn-secondary text-sm"
        >
          {snapshotting ? 'Saving...' : 'Save Snapshot'}
        </button>
      </div>

      {/* Alert banner if there's money waiting */}
      {totalCount > 0 && (
        <div
          className="card mb-6 flex items-center gap-4"
          style={{ borderColor: 'rgba(234, 179, 8, 0.3)', background: 'rgba(234, 179, 8, 0.05)' }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(234, 179, 8, 0.15)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="#fcd34d" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <p className="font-medium" style={{ color: '#fcd34d' }}>
              {formatCurrency(totalDollar)} across {totalCount} invoices need attention
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {summary.pending.count} pending (avg {formatDuration(summary.pending.avgAgeHours)}) + {summary.posted.count} posted (avg {formatDuration(summary.posted.avgAgeHours)})
            </p>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {statusCards.map(({ label, key, color, bgColor }) => {
          const bucket = summary[key];
          return (
            <div key={key} className="card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </span>
                <span
                  className="badge"
                  style={{ background: bgColor, color }}
                >
                  {bucket.count} invoices
                </span>
              </div>
              <p className="text-2xl font-bold" style={{ color }}>
                {formatCurrency(bucket.total)}
                {bucket.estimated && (
                  <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>est.</span>
                )}
              </p>
              {bucket.avgAgeHours > 0 && (
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Avg age: {formatDuration(bucket.avgAgeHours)} (sample)
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Historical Trend */}
      <div className="card mb-6">
        <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>
          Pending + Posted Invoice $ Over Time
        </h3>
        <TrendChart history={history} />
        <AgeTrendChart history={history} />
      </div>

      {/* BU Quick Filters */}
      {invoices.length > 0 && businessUnits.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Business Unit:</span>
          <button
            onClick={() => setFilterBU('all')}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              backgroundColor: filterBU === 'all' ? 'rgba(93, 138, 102, 0.2)' : 'var(--bg-secondary)',
              color: filterBU === 'all' ? 'var(--christmas-green-light)' : 'var(--text-secondary)',
              border: filterBU === 'all' ? '1px solid var(--christmas-green-light)' : '1px solid var(--border-subtle)',
            }}
          >
            All ({invoices.length})
          </button>
          {businessUnits.map(bu => {
            const count = invoices.filter(i => i.businessUnitName === bu).length;
            const active = filterBU === bu;
            return (
              <button
                key={bu}
                onClick={() => setFilterBU(active ? 'all' : bu)}
                className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                style={{
                  backgroundColor: active ? 'rgba(93, 138, 102, 0.2)' : 'var(--bg-secondary)',
                  color: active ? 'var(--christmas-green-light)' : 'var(--text-secondary)',
                  border: active ? '1px solid var(--christmas-green-light)' : '1px solid var(--border-subtle)',
                }}
              >
                {bu} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      {invoices.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="select"
            style={{ width: 'auto', minWidth: '140px' }}
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Posted">Posted</option>
          </select>

          <span className="self-center text-sm" style={{ color: 'var(--text-muted)' }}>
            {sortedInvoices.length} invoice{sortedInvoices.length !== 1 ? 's' : ''}
            {' '}totaling {formatCurrency(sortedInvoices.reduce((s, i) => s + i.total, 0))}
          </span>
        </div>
      )}

      {/* Invoice Table */}
      {invoices.length === 0 ? (
        <div className="card text-center py-12">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(34, 197, 94, 0.15)' }}
          >
            <svg className="w-8 h-8" fill="none" stroke="#4ade80" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-medium" style={{ color: 'var(--christmas-cream)' }}>
            All clear
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            No pending or posted invoices with balances found.
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <SortHeader label="Status" colKey="status" />
                  <SortHeader label="Invoice #" colKey="invoiceNumber" />
                  <SortHeader label="Customer" colKey="customerName" />
                  <SortHeader label="Business Unit" colKey="businessUnitName" />
                  <SortHeader label="Job #" colKey="jobNumber" />
                  <SortHeader label="Total" colKey="total" align="right" />
                  <SortHeader label="Invoice Date" colKey="invoiceDate" />
                  <SortHeader label="Age" colKey="ageHours" />
                </tr>
              </thead>
              <tbody>
                {sortedInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td>
                      <span className={`badge ${inv.status === 'Pending' ? 'badge-warning' : 'badge-info'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{inv.invoiceNumber}</span>
                        <a
                          href={`https://go.servicetitan.com/#/Invoice/${inv.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-400 transition-colors flex-shrink-0"
                          title="Open in ServiceTitan"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{inv.customerName}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{inv.businessUnitName}</td>
                    <td>
                      {inv.jobNumber ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{inv.jobNumber}</span>
                          <a
                            href={`https://go.servicetitan.com/#/Job/Index/${inv.jobId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-blue-400 transition-colors flex-shrink-0"
                            title="Open Job in ServiceTitan"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td className="text-right font-medium" style={{ color: 'var(--christmas-cream)' }}>
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(inv.invoiceDate)}
                    </td>
                    <td>
                      <span
                        className="font-medium"
                        style={{ color: inv.ageHours >= 72 ? '#f87171' : inv.ageHours >= 24 ? '#fcd34d' : 'var(--text-secondary)' }}
                      >
                        {formatDuration(inv.ageHours)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
        Counts from ServiceTitan. Table shows invoices from last 90 days. Fetched at {data.fetchedAt}.
      </p>
    </div>
  );
}
