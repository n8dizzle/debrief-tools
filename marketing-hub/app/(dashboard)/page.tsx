'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardData {
  period: string;
  revenueGoal: number;
  totals: {
    totalRevenue: number;
    totalSales: number;
    avgTicket: number;
    totalJobsRan: number;
  };
  memberships: {
    totalMembers: number;
    sold: number;
    renewed: number;
    expired: number;
    cancelled: number;
    activeAtEnd: number;
  };
  growth: {
    totalLeads: number;
    newNamesInST: number;
    totalNewCustomers: number;
    leadsToCustomerPercent: number;
    newCustomerRevenue: number;
    revenuePercentOfTotal: number;
    avgRevenuePerNewCustomer: number;
    revenuePerLead: number;
  };
  reviews: {
    count: number;
    jobsWithReviewPercent: number;
    grossRating: number;
    avgRating: number;
  };
  calls: {
    totalPhoneCalls: number;
    outboundCalls: number;
    inboundPhoneCalls: number;
    phoneLeads: number;
    bookedJobsFromInbound: number;
    totalJobsBooked: number;
    totalCancellations: number;
    netBookings: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

// ---------------------------------------------------------------------------
// Components
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
      className="flex items-center justify-between py-3.5 px-5"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <span
        className={`text-sm ${muted ? 'italic' : 'font-medium'}`}
        style={{ color: muted ? 'var(--text-muted)' : 'var(--text-secondary)' }}
      >
        {label}
      </span>
      <span
        className="text-lg font-bold tabular-nums"
        style={{ color: highlight ? 'var(--christmas-green)' : 'var(--christmas-cream)' }}
      >
        {displayValue}
      </span>
    </div>
  );
}

function SectionCard({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="px-5 py-3"
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
      <div>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Period Picker
// ---------------------------------------------------------------------------

function PeriodPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth(); // 0-indexed

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => onChange('ytd')}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        style={{
          backgroundColor: value === 'ytd' ? 'var(--christmas-green)' : 'var(--bg-card)',
          color: value === 'ytd' ? 'var(--christmas-cream)' : 'var(--text-muted)',
          border: `1px solid ${value === 'ytd' ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
        }}
      >
        YTD
      </button>
      {months.slice(0, currentMonth + 1).map((m, i) => {
        const val = String(i + 1);
        const active = value === val;
        return (
          <button
            key={m}
            onClick={() => onChange(val)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: active ? 'var(--christmas-green)' : 'var(--bg-card)',
              color: active ? 'var(--christmas-cream)' : 'var(--text-muted)',
              border: `1px solid ${active ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
            }}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MarketingDashboard() {
  const { data: session } = useSession();

  const [period, setPeriod] = useState('ytd');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/overview?period=${period}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load dashboard data');
      const json: DashboardData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const g = data?.growth;
  const r = data?.reviews;
  const t = data?.totals;
  const c = data?.calls;
  const m = data?.memberships;

  const revPct = data && data.revenueGoal > 0
    ? Math.round(((t?.totalRevenue || 0) / data.revenueGoal) * 100)
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Marketing Dashboard
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {data?.period || 'Loading...'}
          </p>
        </div>
      </div>

      {/* Period Picker */}
      <PeriodPicker value={period} onChange={setPeriod} />

      {/* Error */}
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

      {/* Loading */}
      {loading && !data && (
        <div className="space-y-4">
          <div className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border-subtle)' }} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-64 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.5 }} />
            ))}
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Revenue Progress Banner */}
          <div
            className="p-5 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(52, 102, 67, 0.15) 0%, var(--bg-secondary) 100%)',
              border: '1px solid rgba(52, 102, 67, 0.3)',
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Revenue vs Goal
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold" style={{ color: 'var(--christmas-cream)' }}>
                  {formatCurrency(t?.totalRevenue || 0)} / {formatCurrency(data.revenueGoal)}
                </span>
                <span
                  className="text-sm font-semibold px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: revPct >= 100 ? 'rgba(52,102,67,0.2)' : 'rgba(239,68,68,0.15)',
                    color: revPct >= 100 ? 'var(--christmas-green)' : '#ef4444',
                  }}
                >
                  {revPct}%
                </span>
              </div>
            </div>
            <div className="relative h-2.5 rounded-full" style={{ backgroundColor: 'var(--bg-card)' }}>
              <div
                className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(revPct, 100)}%`,
                  backgroundColor: revPct >= 100 ? 'var(--christmas-green)' : revPct >= 75 ? 'var(--christmas-gold)' : '#ef4444',
                }}
              />
            </div>
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Revenue</div>
                <div className="text-xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{formatCurrency(t?.totalRevenue || 0)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Sales</div>
                <div className="text-xl font-bold" style={{ color: 'var(--christmas-gold)' }}>{formatCurrency(t?.totalSales || 0)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Avg Ticket</div>
                <div className="text-xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{formatCurrency(t?.avgTicket || 0)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Jobs Ran</div>
                <div className="text-xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{formatNumber(t?.totalJobsRan || 0)}</div>
              </div>
            </div>
          </div>

          {/* Growth + Reviews */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="Growth" color="var(--christmas-green)">
              <StatRow label="Total Leads" value={g?.totalLeads || 0} />
              <StatRow label="# of New Names in ST" value={g?.newNamesInST || 0} />
              <StatRow label="Total New Customers" value={g?.totalNewCustomers || 0} highlight />
              <StatRow label="% of leads → customers" value={g?.leadsToCustomerPercent || 0} isPercent muted />
              <StatRow label="New Customer Revenue" value={g?.newCustomerRevenue || 0} isCurrency highlight />
              <StatRow label="% of total revenue" value={g?.revenuePercentOfTotal || 0} isPercent muted />
              <StatRow label="Avg Revenue Per New Customer" value={g?.avgRevenuePerNewCustomer || 0} isCurrency />
              <StatRow label="Revenue Per Lead" value={g?.revenuePerLead || 0} isCurrency />
            </SectionCard>

            <SectionCard title="Reviews" color="var(--christmas-green)">
              <StatRow label="# of Reviews" value={r?.count || 0} highlight />
              <StatRow label="% of jobs with review" value={r?.jobsWithReviewPercent || 0} isPercent muted />
              <StatRow label="Gross Rating" value={formatNumber(r?.grossRating || 0)} />
              <StatRow label="AVG Rating" value={r?.avgRating || 0} isRating highlight />
              <div className="px-5 py-4">
                <div className="flex items-center gap-2 justify-center">
                  {[1, 2, 3, 4, 5].map(star => {
                    const filled = (r?.avgRating || 0) >= star;
                    return (
                      <svg key={star} className="w-7 h-7" fill={filled ? 'var(--christmas-gold)' : 'none'} stroke={filled ? 'var(--christmas-gold)' : 'var(--text-muted)'} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    );
                  })}
                  <span className="text-xl font-bold ml-2" style={{ color: 'var(--christmas-cream)' }}>
                    {(r?.avgRating || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Calls + Memberships */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="Calls" color="#3B82F6">
              <StatRow label="Total Phone Calls" value={c?.totalPhoneCalls || 0} />
              <StatRow label="Inbound Phone Calls" value={c?.inboundPhoneCalls || 0} />
              <StatRow label="Outbound Calls" value={c?.outboundCalls || 0} />
              <StatRow label="Phone Leads" value={c?.phoneLeads || 0} highlight />
              <StatRow label="Booked Jobs from Inbound" value={c?.bookedJobsFromInbound || 0} />
              <StatRow label="Total Jobs Booked" value={c?.totalJobsBooked || 0} highlight />
              <StatRow label="Total Cancellations" value={c?.totalCancellations || 0} />
              <StatRow label="Net Bookings" value={c?.netBookings || 0} highlight />
            </SectionCard>

            <SectionCard title="Memberships" color="#8B5CF6">
              <StatRow label="Total Members" value={m?.totalMembers || 0} highlight />
              <StatRow label="Memberships Sold" value={m?.sold || 0} />
              <StatRow label="Renewed" value={m?.renewed || 0} />
              <StatRow label="Expired" value={m?.expired || 0} />
              <StatRow label="Cancelled" value={m?.cancelled || 0} />
              <StatRow label="Active at End" value={m?.activeAtEnd || 0} highlight />
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
