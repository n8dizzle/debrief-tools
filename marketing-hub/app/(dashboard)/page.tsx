'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BarColor = 'green' | 'gold' | 'red' | 'neutral';

interface KPICard {
  actual: number;
  target: number | null;
  pct: number | null;
  pacingLabel: string | null;
  barColor: BarColor;
}

interface ScorecardData {
  period: string;
  kpis: {
    revenue: KPICard;
    leads: KPICard;
    hvacReplacementLeads: KPICard;
    newCustomerRevenue: KPICard;
    spend: KPICard;
    reviews: KPICard;
  };
}

interface OverviewData {
  period: string;
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
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

// ---------------------------------------------------------------------------
// Pacing Card
// ---------------------------------------------------------------------------

const BAR_FILL: Record<BarColor, string> = {
  green: 'var(--christmas-green)',
  gold: 'var(--christmas-gold)',
  red: '#ef4444',
  neutral: 'var(--border-subtle)',
};

const BORDER_COLOR: Record<BarColor, string> = {
  green: 'rgba(52, 102, 67, 0.5)',
  gold: 'rgba(184, 149, 107, 0.5)',
  red: 'rgba(239, 68, 68, 0.4)',
  neutral: 'var(--border-subtle)',
};

const PACING_COLOR: Record<string, string> = {
  'ahead of pace': 'var(--christmas-green)',
  'on pace': 'var(--christmas-green)',
};

function getPacingColor(label: string | null): string {
  if (!label) return 'var(--text-muted)';
  if (label === 'ahead of pace' || label === 'on pace') return 'var(--christmas-green)';
  if (label.includes('behind')) return '#f59e0b';
  return 'var(--text-muted)';
}

function PacingCard({
  title,
  actual,
  target,
  pct,
  pacingLabel,
  barColor,
  isCurrency,
  isLoading,
}: {
  title: string;
  actual: number;
  target: number | null;
  pct: number | null;
  pacingLabel: string | null;
  barColor: BarColor;
  isCurrency?: boolean;
  isLoading?: boolean;
}) {
  const displayActual = isCurrency ? formatCurrency(actual) : formatNumber(actual);
  const displayTarget = target !== null
    ? (isCurrency ? formatCurrency(target) : formatNumber(target))
    : null;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${BORDER_COLOR[barColor]}`,
      }}
    >
      {/* Title */}
      <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {title}
      </div>

      {/* Actual / Target */}
      {isLoading ? (
        <div className="h-8 rounded animate-pulse" style={{ backgroundColor: 'var(--border-subtle)' }} />
      ) : (
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--christmas-cream)' }}>
            {displayActual}
          </span>
          {displayTarget && (
            <span className="text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>
              / {displayTarget}
            </span>
          )}
        </div>
      )}

      {/* Progress bar + pct */}
      {pct !== null && target !== null ? (
        <>
          <div className="relative h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(pct, 100)}%`,
                backgroundColor: BAR_FILL[barColor],
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tabular-nums" style={{ color: BAR_FILL[barColor] }}>
              {pct}%
            </span>
            {pacingLabel && (
              <span className="text-xs font-medium" style={{ color: getPacingColor(pacingLabel) }}>
                {pacingLabel}
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {target === null ? 'no target set' : ''}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Card (for detail rows)
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

function CollapsibleSection({
  title,
  color,
  children,
  defaultOpen = false,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 transition-colors"
        style={{
          backgroundColor: `${color}15`,
          borderBottom: open ? `2px solid ${color}` : 'none',
        }}
      >
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color }}>
          {title}
        </h2>
        <svg
          className="w-4 h-4 transition-transform"
          style={{ color, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Period Picker
// ---------------------------------------------------------------------------

function PeriodPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth(); // 0-indexed

  const quickPicks = [
    { val: String(currentMonth + 1), label: months[currentMonth] },
    { val: 'ytd', label: 'YTD' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {quickPicks.map(({ val, label }) => {
        const active = value === val;
        return (
          <button
            key={val}
            onClick={() => onChange(val)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              backgroundColor: active ? 'var(--christmas-green)' : 'var(--bg-card)',
              color: active ? 'var(--christmas-cream)' : 'var(--text-muted)',
              border: `1px solid ${active ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
            }}
          >
            {label}
          </button>
        );
      })}
      <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border-subtle)' }} />
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
  useSession();

  const currentMonth = new Date().getMonth() + 1;
  const [period, setPeriod] = useState(String(currentMonth));
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [leadsData, setLeadsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leadsView, setLeadsView] = useState<'category' | 'campaign'>('category');

  const fetchScorecard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [scorecardRes, overviewRes] = await Promise.all([
        fetch(`/api/dashboard/scorecard?period=${period}`, { credentials: 'include' }),
        fetch(`/api/dashboard/overview?period=${period}`, { credentials: 'include' }),
      ]);
      if (!scorecardRes.ok) throw new Error('Failed to load scorecard data');
      setScorecard(await scorecardRes.json());
      if (overviewRes.ok) setOverview(await overviewRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [period]);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/leads?days=30', { credentials: 'include' });
      if (res.ok) setLeadsData(await res.json());
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => {
    fetchScorecard();
  }, [fetchScorecard]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const k = scorecard?.kpis;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Marketing Dashboard
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {scorecard?.period || 'Loading...'}
        </p>
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
          <button
            onClick={fetchScorecard}
            className="text-sm px-3 py-1 rounded-lg"
            style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Pacing Scorecard — 3×2 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <PacingCard
          title="Revenue"
          actual={k?.revenue.actual ?? 0}
          target={k?.revenue.target ?? null}
          pct={k?.revenue.pct ?? null}
          pacingLabel={k?.revenue.pacingLabel ?? null}
          barColor={k?.revenue.barColor ?? 'neutral'}
          isCurrency
          isLoading={loading}
        />
        <PacingCard
          title="Total Leads"
          actual={k?.leads.actual ?? 0}
          target={k?.leads.target ?? null}
          pct={k?.leads.pct ?? null}
          pacingLabel={k?.leads.pacingLabel ?? null}
          barColor={k?.leads.barColor ?? 'neutral'}
          isLoading={loading}
        />
        <PacingCard
          title="HVAC Replacement Leads"
          actual={k?.hvacReplacementLeads.actual ?? 0}
          target={k?.hvacReplacementLeads.target ?? null}
          pct={k?.hvacReplacementLeads.pct ?? null}
          pacingLabel={k?.hvacReplacementLeads.pacingLabel ?? null}
          barColor={k?.hvacReplacementLeads.barColor ?? 'neutral'}
          isLoading={loading}
        />
        <PacingCard
          title="New Customer Revenue"
          actual={k?.newCustomerRevenue.actual ?? 0}
          target={k?.newCustomerRevenue.target ?? null}
          pct={k?.newCustomerRevenue.pct ?? null}
          pacingLabel={k?.newCustomerRevenue.pacingLabel ?? null}
          barColor={k?.newCustomerRevenue.barColor ?? 'neutral'}
          isCurrency
          isLoading={loading}
        />
        <PacingCard
          title="Spend"
          actual={k?.spend.actual ?? 0}
          target={k?.spend.target ?? null}
          pct={k?.spend.pct ?? null}
          pacingLabel={k?.spend.pacingLabel ?? null}
          barColor={k?.spend.barColor ?? 'neutral'}
          isCurrency
          isLoading={loading}
        />
        <PacingCard
          title="Reviews"
          actual={k?.reviews.actual ?? 0}
          target={k?.reviews.target ?? null}
          pct={k?.reviews.pct ?? null}
          pacingLabel={k?.reviews.pacingLabel ?? null}
          barColor={k?.reviews.barColor ?? 'neutral'}
          isLoading={loading}
        />
      </div>

      {/* Booked Jobs Chart */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            Booked Jobs by {leadsView === 'category' ? 'Channel' : 'Campaign'}
            <span className="text-sm font-normal ml-2" style={{ color: 'var(--text-muted)' }}>last 30 days</span>
          </h2>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            {(['category', 'campaign'] as const).map(v => (
              <button
                key={v}
                onClick={() => setLeadsView(v)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: leadsView === v ? 'var(--christmas-green)' : 'transparent',
                  color: leadsView === v ? 'var(--christmas-cream)' : 'var(--text-muted)',
                }}
              >
                {v === 'category' ? 'Channel' : 'Campaign'}
              </button>
            ))}
          </div>
        </div>

        {!leadsData ? (
          <div className="h-72 rounded animate-pulse" style={{ backgroundColor: 'var(--border-subtle)' }} />
        ) : (() => {
          const chartData = leadsView === 'category' ? leadsData.dailyByCategory : leadsData.dailyByCampaign;
          const keys = leadsView === 'category' ? leadsData.categories : leadsData.campaigns;
          const COLORS = [
            '#346643', '#B8956B', '#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B',
            '#10B981', '#6366F1', '#EC4899', '#14B8A6', '#F97316', '#06B6D4',
          ];
          let displayKeys = keys;
          if (leadsView === 'campaign' && keys.length > 10) {
            const totals = keys.map((k: string) => ({
              key: k,
              total: (chartData as any[]).reduce((sum: number, d: any) => sum + (d[k] || 0), 0),
            }));
            totals.sort((a: any, b: any) => b.total - a.total);
            displayKeys = totals.slice(0, 10).map((t: any) => t.key);
          }
          return (
            <div style={{ width: '100%', height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" strokeOpacity={0.5} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => { const p = d.split('-'); return `${p[1]}/${p[2]}`; }}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: 12 }}
                    labelFormatter={(label: any) => { const p = String(label).split('-'); return `${p[1]}/${p[2]}`; }}
                    itemStyle={{ color: 'var(--christmas-cream)' }}
                    labelStyle={{ color: 'var(--christmas-cream)', fontWeight: 'bold', marginBottom: 4 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} iconType="square" iconSize={10} />
                  {displayKeys.map((key: string, i: number) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="booked"
                      fill={COLORS[i % COLORS.length]}
                      radius={i === displayKeys.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
      </div>

      {/* Detail sections (collapsible) */}
      {overview && (
        <>
          <CollapsibleSection title="Growth Detail" color="var(--christmas-green)">
            <StatRow label="Total Leads" value={overview.growth.totalLeads} />
            <StatRow label="# of New Names in ST" value={overview.growth.newNamesInST} />
            <StatRow label="Total New Customers" value={overview.growth.totalNewCustomers} highlight />
            <StatRow label="% of leads → customers" value={overview.growth.leadsToCustomerPercent} isPercent muted />
            <StatRow label="New Customer Revenue" value={overview.growth.newCustomerRevenue} isCurrency highlight />
            <StatRow label="% of total revenue" value={overview.growth.revenuePercentOfTotal} isPercent muted />
            <StatRow label="Avg Revenue Per New Customer" value={overview.growth.avgRevenuePerNewCustomer} isCurrency />
            <StatRow label="Revenue Per Lead" value={overview.growth.revenuePerLead} isCurrency />
          </CollapsibleSection>

          <CollapsibleSection title="Calls Detail" color="#3B82F6">
            <StatRow label="Total Phone Calls" value={overview.calls.totalPhoneCalls} />
            <StatRow label="Inbound Phone Calls" value={overview.calls.inboundPhoneCalls} />
            <StatRow label="Outbound Calls" value={overview.calls.outboundCalls} />
            <StatRow label="Phone Leads" value={overview.calls.phoneLeads} highlight />
            <StatRow label="Booked Jobs from Inbound" value={overview.calls.bookedJobsFromInbound} />
            <StatRow label="Total Jobs Booked" value={overview.calls.totalJobsBooked} highlight />
            <StatRow label="Total Cancellations" value={overview.calls.totalCancellations} />
            <StatRow label="Net Bookings" value={overview.calls.netBookings} highlight />
          </CollapsibleSection>
        </>
      )}
    </div>
  );
}
