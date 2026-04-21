'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GrowthData {
  totalLeads: number;
  newNamesInST: number;
  totalNewCustomers: number;
  leadsToCustomerPercent: number;
  newCustomerRevenue: number;
  revenuePercentOfTotal: number;
  avgRevenuePerNewCustomer: number;
  revenuePerLead: number;
  totalJobsBooked: number;
  totalCompleted: number;
  totalCompletedRevenue: number;
  totalSales: number;
  totalRevenue: number;
}

interface ReviewData {
  count: number;
  jobsWithReviewPercent: number;
  grossRating: number;
  avgRating: number;
  totalCompletedJobs: number;
}

interface OverviewResponse {
  dateRange: { start: string; end: string };
  growth: GrowthData;
  reviews: ReviewData;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000).toLocaleString()}K`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

// ---------------------------------------------------------------------------
// Stat Row Component
// ---------------------------------------------------------------------------

function StatRow({
  label,
  value,
  isCurrency,
  isPercent,
  isRating,
  highlight,
  muted,
}: {
  label: string;
  value: number | string;
  isCurrency?: boolean;
  isPercent?: boolean;
  isRating?: boolean;
  highlight?: boolean;
  muted?: boolean;
}) {
  let displayValue: string;
  if (typeof value === 'string') {
    displayValue = value;
  } else if (isCurrency) {
    displayValue = formatCurrency(value);
  } else if (isPercent) {
    displayValue = `${value}%`;
  } else if (isRating) {
    displayValue = value.toFixed(2);
  } else {
    displayValue = formatNumber(value);
  }

  return (
    <div
      className="flex items-center justify-between py-3 px-4"
      style={{
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <span
        className={`text-sm ${muted ? 'italic' : 'font-medium'}`}
        style={{ color: muted ? 'var(--text-muted)' : 'var(--text-secondary)' }}
      >
        {label}
      </span>
      <span
        className={`text-lg font-bold tabular-nums ${highlight ? '' : ''}`}
        style={{ color: highlight ? 'var(--christmas-green)' : 'var(--christmas-cream)' }}
      >
        {displayValue}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <div
      className="px-4 py-3 rounded-t-xl"
      style={{
        backgroundColor: `${color}15`,
        borderBottom: `2px solid ${color}`,
      }}
    >
      <h2
        className="text-sm font-bold uppercase tracking-widest text-center"
        style={{ color }}
      >
        {title}
      </h2>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MarketingDashboard() {
  const { data: session } = useSession();

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return { start: formatLocalDate(start), end: formatLocalDate(end) };
  });

  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/dashboard/overview?startDate=${dateRange.start}&endDate=${dateRange.end}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to load dashboard data');
      const json: OverviewResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Sync ST calls and LSA leads
      await Promise.all([
        fetch('/api/leads/sync/st-calls', { method: 'POST', credentials: 'include' }).catch(() => {}),
        fetch('/api/lsa/sync', { method: 'POST', credentials: 'include' }).catch(() => {}),
      ]);
      await fetchData();
    } finally {
      setIsSyncing(false);
    }
  };

  const growth = data?.growth;
  const reviews = data?.reviews;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Marketing Dashboard
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Performance overview for Christmas Air
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--christmas-gold)', color: 'var(--bg-primary)' }}
          >
            {isSyncing && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {isSyncing ? 'Syncing...' : 'Sync Data'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          className="rounded-lg p-3 flex items-center justify-between"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
        >
          <span className="text-sm" style={{ color: '#ef4444' }}>{error}</span>
          <button onClick={fetchData} className="text-sm px-3 py-1 rounded-lg" style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="h-12 animate-pulse" style={{ backgroundColor: 'var(--border-subtle)' }} />
              {[1, 2, 3, 4, 5].map(j => (
                <div key={j} className="h-14 mx-4 my-1 rounded animate-pulse" style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.5 }} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      {data && (
        <>
          {/* Top-level revenue summary */}
          <div
            className="p-5 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(52, 102, 67, 0.15) 0%, var(--bg-secondary) 100%)',
              border: '1px solid rgba(52, 102, 67, 0.3)',
            }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total Revenue</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{formatCurrency(growth?.totalRevenue || 0)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Jobs Completed</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{formatNumber(growth?.totalCompleted || 0)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Jobs Booked</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{formatNumber(growth?.totalJobsBooked || 0)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total Sales</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--christmas-gold)' }}>{formatCurrency(growth?.totalSales || 0)}</div>
              </div>
            </div>
          </div>

          {/* Growth + Reviews side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GROWTH Card */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <SectionHeader title="Growth" color="var(--christmas-green)" />
              <div>
                <StatRow label="Total Leads" value={growth?.totalLeads || 0} />
                <StatRow label="# of New Names in ST" value={growth?.newNamesInST || 0} />
                <StatRow label="Total New Customers" value={growth?.totalNewCustomers || 0} highlight />
                <StatRow label="% of leads → customers" value={growth?.leadsToCustomerPercent || 0} isPercent muted />
                <StatRow label="New Customer Revenue" value={growth?.newCustomerRevenue || 0} isCurrency highlight />
                <StatRow label="% of total revenue" value={growth?.revenuePercentOfTotal || 0} isPercent muted />
                <StatRow label="Avg Revenue Per New Customer" value={growth?.avgRevenuePerNewCustomer || 0} isCurrency />
                <StatRow label="Revenue Per Lead" value={growth?.revenuePerLead || 0} isCurrency />
              </div>
            </div>

            {/* REVIEWS Card */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <SectionHeader title="Reviews" color="var(--christmas-green)" />
              <div>
                <StatRow label="# of Reviews" value={reviews?.count || 0} highlight />
                <StatRow label="% of jobs with review" value={reviews?.jobsWithReviewPercent || 0} isPercent muted />
                <StatRow label="Gross Rating" value={reviews?.grossRating || 0} />
                <StatRow label="AVG Rating" value={reviews?.avgRating || 0} isRating highlight />
              </div>

              {/* Star distribution placeholder */}
              <div className="px-4 py-5">
                <div className="flex items-center gap-3 justify-center">
                  {[5, 4, 3, 2, 1].map(star => {
                    const isActive = (reviews?.avgRating || 0) >= star;
                    return (
                      <svg
                        key={star}
                        className="w-6 h-6"
                        fill={isActive ? 'var(--christmas-gold)' : 'none'}
                        stroke={isActive ? 'var(--christmas-gold)' : 'var(--text-muted)'}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    );
                  })}
                  <span className="text-lg font-bold ml-1" style={{ color: 'var(--christmas-cream)' }}>
                    {(reviews?.avgRating || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
