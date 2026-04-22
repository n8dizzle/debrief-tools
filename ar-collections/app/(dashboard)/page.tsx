'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, getAgingBucketLabel } from '@/lib/ar-utils';
import { ARDashboardStats, ARJobStatusOption } from '@/lib/supabase';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis,
  LineChart, Line, AreaChart, Area, Legend, CartesianGrid,
} from 'recharts';

interface DailySnapshot {
  snapshot_date: string;
  total_outstanding: number | string;
  actionable_ar: number | string;
  pending_closures: number | string;
  bucket_current: number | string;
  bucket_30: number | string;
  bucket_60: number | string;
  bucket_90_plus: number | string;
  true_dso_total: number | string;
  true_dso_actionable: number | string;
  true_dso_pending: number | string;
}

interface GroupSnapshot {
  snapshot_date: string;
  group_id: string;
  total_outstanding: number | string;
}

interface GroupInfo {
  id: string;
  label: string;
  sort_order: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<ARDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [excludeFinancing, setExcludeFinancing] = useState(true);
  const [topListView, setTopListView] = useState<'balances' | 'oldest' | '90plus' | 'recent'>('balances');
  const [jobStatuses, setJobStatuses] = useState<ARJobStatusOption[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [groupSnapshots, setGroupSnapshots] = useState<GroupSnapshot[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupInfo[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/job-statuses', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setJobStatuses(data.statuses || []);
        }
      } catch (err) {
        console.error('Failed to fetch job statuses:', err);
      }
    })();
    (async () => {
      try {
        const res = await fetch('/api/dashboard/snapshots?days=90', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setSnapshots(data.snapshots || []);
          setGroupSnapshots(data.groupSnapshots || []);
          setGroupInfo(data.groups || []);
        }
      } catch (err) {
        console.error('Failed to fetch snapshots:', err);
      }
    })();
  }, []);

  const jobStatusColorByKey = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of jobStatuses) {
      if (s.category === 'work' && s.color) map[s.key] = s.color;
    }
    return map;
  }, [jobStatuses]);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (excludeFinancing) {
          params.set('excludeFinancing', 'true');
        }
        const response = await fetch(`/api/dashboard?${params.toString()}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard stats');
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [excludeFinancing]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center" style={{ color: 'var(--text-muted)' }}>
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="text-center" style={{ color: 'var(--status-error)' }}>
          {error}
        </div>
      </div>
    );
  }

  // Show placeholder data if no stats yet
  const displayStats = stats || {
    total_outstanding: 0,
    ar_collectible: 0,
    ar_not_in_control: 0,
    avg_invoice_age: 0,
    actionable_ar_avg_age: 0,
    pending_closures_avg_age: 0,
    true_dso: 0,
    true_dso_period_days: 30,
    true_dso_revenue: 0,
    aging_buckets: { current: 0, bucket_30: 0, bucket_60: 0, bucket_90_plus: 0 },
    install_total: 0,
    service_total: 0,
    residential_total: 0,
    commercial_total: 0,
    inhouse_financing_total: 0,
    inhouse_financing_count: 0,
    inhouse_financing_delinquent: 0,
    business_unit_totals: [],
    job_status_totals: [],
    top_balances: [],
    top_oldest: [],
    top_90_plus: [],
    top_recent: [],
    recent_activity: [],
    last_sync_at: null,
  };

  // Cohesive color palette for all charts - matches Daily Dash
  const COLORS = {
    // Pie chart / Business units - Christmas Air brand colors
    chart: [
      '#346643', // christmas green (HVAC)
      '#B8956B', // christmas gold (Plumbing)
      '#3B82F6', // blue
      '#8B5CF6', // purple
      '#14b8a6', // teal
      '#f59e0b', // amber
      '#f97316', // orange
      '#ef4444', // red
    ],
    // Aging buckets - green to red severity scale
    aging: {
      current: '#4ade80',    // green - good (matches Daily Dash)
      days30: '#fcd34d',     // yellow - warning
      days60: '#fb923c',     // orange - concern
      days90: '#f87171',     // red - critical
    },
    // Residential vs Commercial - matches pie chart colors
    residential: '#346643',  // christmas green
    commercial: '#B8956B',   // christmas gold/brown
  };
  const CHART_COLORS = COLORS.chart;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            AR Collections Dashboard
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Accounts Receivable Overview
            {displayStats.last_sync_at && (
              <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                • Last synced {new Date(displayStats.last_sync_at).toLocaleString('en-US', {
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
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Exclude In-House Financing
            </span>
            <button
              onClick={() => setExcludeFinancing(!excludeFinancing)}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{
                backgroundColor: excludeFinancing ? 'var(--christmas-green)' : 'var(--bg-secondary)',
              }}
            >
              <span
                className="absolute top-1 left-1 w-4 h-4 rounded-full transition-transform"
                style={{
                  backgroundColor: 'var(--christmas-cream)',
                  transform: excludeFinancing ? 'translateX(20px)' : 'translateX(0)',
                }}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className="p-4 sm:p-5 rounded-xl transition-all hover:scale-[1.01]"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid rgba(52, 102, 67, 0.3)',
          }}
        >
          <div className="text-xs sm:text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Total Outstanding
          </div>
          <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {formatCurrency(displayStats.total_outstanding)}
          </div>
        </div>

        <div
          className="p-4 sm:p-5 rounded-xl transition-all hover:scale-[1.01]"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}
        >
          <div className="text-xs sm:text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Actionable AR
          </div>
          <div className="mt-2 text-2xl font-bold" style={{ color: '#4ade80' }}>
            {formatCurrency(displayStats.ar_collectible)}
          </div>
        </div>

        <div
          className="p-4 sm:p-5 rounded-xl transition-all hover:scale-[1.01]"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid rgba(251, 146, 60, 0.3)',
          }}
        >
          <div className="text-xs sm:text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Pending Closures
          </div>
          <div className="mt-2 text-2xl font-bold" style={{ color: '#fb923c' }}>
            {formatCurrency(displayStats.ar_not_in_control)}
          </div>
        </div>

        <div
          className="p-4 sm:p-5 rounded-xl transition-all hover:scale-[1.01]"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
          }}
        >
          <div className="text-xs sm:text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Avg Invoice Age
          </div>
          <div className="mt-2 space-y-1">
            <div
              className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity rounded px-1 -mx-1"
              onClick={() => router.push('/invoices?controlBucket=ar_collectible')}
            >
              <span className="text-xs" style={{ color: '#4ade80' }}>Actionable</span>
              <span className="text-lg font-bold" style={{ color: '#4ade80' }}>
                {displayStats.actionable_ar_avg_age} days
              </span>
            </div>
            <div
              className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity rounded px-1 -mx-1"
              onClick={() => router.push('/invoices?controlBucket=ar_not_in_our_control')}
            >
              <span className="text-xs" style={{ color: '#fb923c' }}>Pending</span>
              <span className="text-lg font-bold" style={{ color: '#fb923c' }}>
                {displayStats.pending_closures_avg_age} days
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* True DSO */}
      <div
        className="p-4 sm:p-5 rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs sm:text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              True DSO ({displayStats.true_dso_period_days}-Day)
            </div>
            <div className="mt-1 text-3xl font-bold" style={{ color: '#a78bfa' }}>
              {displayStats.true_dso} days
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Formula: (AR ÷ Revenue) × {displayStats.true_dso_period_days}
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {formatCurrency(displayStats.total_outstanding)} ÷ {formatCurrency(displayStats.true_dso_revenue)}
            </div>
          </div>
        </div>
      </div>

      {/* AR by Job Status */}
      <div
        className="p-4 sm:p-5 rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
          AR by Job Status
        </h2>
        {displayStats.job_status_totals.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            No data available
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={displayStats.job_status_totals.slice(0, 8)}
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={(value) => formatCurrency(value)}
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  tickLine={{ stroke: 'var(--border-subtle)' }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  tickLine={false}
                  width={95}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value as number), 'Balance']}
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                  }}
                  labelStyle={{ color: 'var(--christmas-cream)', fontWeight: 'bold', marginBottom: '4px' }}
                  itemStyle={{ color: 'var(--christmas-cream)' }}
                />
                <Bar
                  dataKey="total"
                  radius={[0, 4, 4, 0]}
                  style={{ cursor: 'pointer' }}
                  onClick={(data) => {
                    if (data && data.key && data.key !== 'none') {
                      router.push(`/invoices?jobStatus=${encodeURIComponent(String(data.key))}`);
                    }
                  }}
                >
                  {displayStats.job_status_totals.slice(0, 8).map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={jobStatusColorByKey[entry.key] || '#346643'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Trend Charts (90 days) */}
      {snapshots.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Trends — Last 90 Days
          </h2>

          {/* Chart 1: AR $ Outstanding (Total / Actionable / Pending Closures) */}
          <div className="p-4 sm:p-5 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>AR Outstanding</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshots.map((s) => ({ date: s.snapshot_date, total: Number(s.total_outstanding), actionable: Number(s.actionable_ar), pending: Number(s.pending_closures) }))} margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} minTickGap={20} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8 }} labelStyle={{ color: 'var(--christmas-cream)' }} formatter={(v: unknown) => formatCurrency(Number(v) || 0)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="total" name="Total" stroke="#a78bfa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="actionable" name="Actionable" stroke="#4ade80" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pending" name="Pending Closures" stroke="#fb923c" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Aging Buckets (stacked area) */}
          <div className="p-4 sm:p-5 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>Aging Buckets</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={snapshots.map((s) => ({ date: s.snapshot_date, current: Number(s.bucket_current), d30: Number(s.bucket_30), d60: Number(s.bucket_60), d90: Number(s.bucket_90_plus) }))} margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} minTickGap={20} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8 }} labelStyle={{ color: 'var(--christmas-cream)' }} formatter={(v: unknown) => formatCurrency(Number(v) || 0)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="current" name="Current" stackId="a" stroke="#4ade80" fill="#4ade80" fillOpacity={0.5} />
                  <Area type="monotone" dataKey="d30" name="31-60" stackId="a" stroke="#fcd34d" fill="#fcd34d" fillOpacity={0.5} />
                  <Area type="monotone" dataKey="d60" name="61-90" stackId="a" stroke="#fb923c" fill="#fb923c" fillOpacity={0.5} />
                  <Area type="monotone" dataKey="d90" name="90+" stackId="a" stroke="#f87171" fill="#f87171" fillOpacity={0.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: True DSO */}
          <div className="p-4 sm:p-5 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>True DSO (days)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshots.map((s) => ({ date: s.snapshot_date, total: Number(s.true_dso_total), actionable: Number(s.true_dso_actionable), pending: Number(s.true_dso_pending) }))} margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} minTickGap={20} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} tickFormatter={(v) => `${v}d`} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8 }} labelStyle={{ color: 'var(--christmas-cream)' }} formatter={(v: unknown) => `${Number(v) || 0} days`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="total" name="Total" stroke="#a78bfa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="actionable" name="Actionable" stroke="#4ade80" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pending" name="Pending Closures" stroke="#fb923c" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: By BU Group */}
          {groupInfo.length > 0 && (() => {
            const groupLabel = new Map(groupInfo.map((g) => [g.id, g.label]));
            const byDate = new Map<string, Record<string, number>>();
            for (const s of snapshots) byDate.set(s.snapshot_date, { date: s.snapshot_date } as unknown as Record<string, number>);
            for (const gs of groupSnapshots) {
              const row = byDate.get(gs.snapshot_date) as Record<string, unknown> | undefined;
              if (!row) continue;
              const label = groupLabel.get(gs.group_id);
              if (!label) continue;
              row[label] = Number(gs.total_outstanding);
            }
            const chartData = Array.from(byDate.values());
            const palette = ['#4ade80', '#60a5fa', '#a78bfa', '#fb923c', '#f87171', '#fcd34d', '#14b8a6', '#8b5cf6'];
            return (
              <div className="p-4 sm:p-5 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>AR by Business Unit Group</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} minTickGap={20} tickFormatter={(d) => d.slice(5)} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8 }} labelStyle={{ color: 'var(--christmas-cream)' }} formatter={(v: unknown) => formatCurrency(Number(v) || 0)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {groupInfo.map((g, i) => (
                        <Line key={g.id} type="monotone" dataKey={g.label} stroke={palette[i % palette.length]} strokeWidth={2} dot={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Residential vs Commercial */}
      <div
        className="p-4 sm:p-5 rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
          Residential vs Commercial
        </h2>
        {(() => {
          const rvcSlices = [
            { filterValue: 'residential', name: 'Residential', value: displayStats.residential_total, color: COLORS.residential },
            { filterValue: 'commercial', name: 'Commercial', value: displayStats.commercial_total, color: COLORS.commercial },
          ].filter((s) => s.value > 0);

          if (rvcSlices.length === 0) {
            return (
              <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                No data available
              </div>
            );
          }

          return (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rvcSlices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    labelLine={true}
                    style={{ cursor: 'pointer' }}
                    onClick={(data) => {
                      const filterValue = (data as { filterValue?: string } | undefined)?.filterValue;
                      if (filterValue) router.push(`/invoices?customerType=${encodeURIComponent(filterValue)}`);
                    }}
                  >
                    {rvcSlices.map((s, i) => (
                      <Cell key={`cell-${i}`} fill={s.color} style={{ cursor: 'pointer' }} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [formatCurrency((value as number) ?? 0), 'Balance']}
                    contentStyle={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                    }}
                    labelStyle={{ color: 'var(--christmas-cream)', fontWeight: 'bold', marginBottom: '4px' }}
                    itemStyle={{ color: 'var(--christmas-cream)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
      </div>

      {/* Aging Buckets & Business Unit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aging Buckets */}
        <div
          className="p-4 sm:p-5 rounded-xl"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
            Aging Breakdown
          </h2>
          {(() => {
            const agingSlices = [
              { filterValue: 'current', name: 'Current (0-30)', value: displayStats.aging_buckets.current, color: COLORS.aging.current },
              { filterValue: '30', name: '31-60 days', value: displayStats.aging_buckets.bucket_30, color: COLORS.aging.days30 },
              { filterValue: '60', name: '61-90 days', value: displayStats.aging_buckets.bucket_60, color: COLORS.aging.days60 },
              { filterValue: '90+', name: '90+ days', value: displayStats.aging_buckets.bucket_90_plus, color: COLORS.aging.days90 },
            ].filter((s) => s.value > 0);

            if (agingSlices.length === 0) {
              return (
                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  No data available
                </div>
              );
            }

            return (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={agingSlices}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                      labelLine={true}
                      style={{ cursor: 'pointer' }}
                      onClick={(data) => {
                        const filterValue = (data as { filterValue?: string } | undefined)?.filterValue;
                        if (filterValue) router.push(`/invoices?agingBucket=${encodeURIComponent(filterValue)}`);
                      }}
                    >
                      {agingSlices.map((s, i) => (
                        <Cell key={`cell-${i}`} fill={s.color} style={{ cursor: 'pointer' }} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [formatCurrency((value as number) ?? 0), 'Balance']}
                      contentStyle={{
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                      }}
                      labelStyle={{ color: 'var(--christmas-cream)', fontWeight: 'bold', marginBottom: '4px' }}
                      itemStyle={{ color: 'var(--christmas-cream)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>

        {/* AR by Business Unit Group */}
        <div
          className="p-4 sm:p-5 rounded-xl"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
            AR by Business Unit Group
          </h2>
          {(() => {
            // Use most recent groupSnapshots row (today's) joined with groupInfo.
            if (groupSnapshots.length === 0 || groupInfo.length === 0) {
              return (
                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  {groupInfo.length === 0
                    ? 'No business unit groups configured. Set them up in Internal Portal → BU Groups.'
                    : 'No snapshot data yet. Run the backfill or wait for tomorrow’s cron.'}
                </div>
              );
            }
            let latestDate = '';
            for (const gs of groupSnapshots) if (gs.snapshot_date > latestDate) latestDate = gs.snapshot_date;
            const labelById = new Map(groupInfo.map((g) => [g.id, g.label]));
            const groupPieData = groupSnapshots
              .filter((gs) => gs.snapshot_date === latestDate)
              .map((gs) => ({
                name: labelById.get(gs.group_id) || 'Unknown',
                total: Number(gs.total_outstanding),
                group_id: gs.group_id,
              }))
              .filter((d) => d.total > 0)
              .sort((a, b) => b.total - a.total);

            if (groupPieData.length === 0) {
              return (
                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  No AR in any group as of {latestDate}.
                </div>
              );
            }

            return (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={groupPieData}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                      labelLine={true}
                      style={{ cursor: 'pointer' }}
                      onClick={(data) => {
                        if (data && data.group_id) {
                          router.push(`/invoices?buGroups=${encodeURIComponent(String(data.group_id))}`);
                        }
                      }}
                    >
                      {groupPieData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [formatCurrency(value as number ?? 0), 'Balance']}
                      contentStyle={{
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                      }}
                      labelStyle={{ color: 'var(--christmas-cream)', fontWeight: 'bold', marginBottom: '4px' }}
                      itemStyle={{ color: 'var(--christmas-cream)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>
      </div>

      {/* In-House Financing Summary */}
      <div
        className="p-4 sm:p-5 rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            In-House Financing
          </h2>
          <Link href="/financing" className="text-sm hover:underline" style={{ color: 'var(--christmas-green)' }}>
            View All →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {displayStats.inhouse_financing_count}
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Active Plans
            </div>
          </div>
          <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-2xl font-bold" style={{ color: '#f97316' }}>
              {formatCurrency(displayStats.inhouse_financing_total)}
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Outstanding
            </div>
          </div>
          <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-2xl font-bold" style={{ color: displayStats.inhouse_financing_delinquent > 0 ? 'var(--status-error)' : 'var(--status-success)' }}>
              {formatCurrency(displayStats.inhouse_financing_delinquent)}
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Delinquent
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 Lists & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Lists */}
        <div
          className="p-4 sm:p-5 rounded-xl"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Top 5 Invoices
            </h2>
            <select
              className="select w-full"
              value={topListView}
              onChange={(e) => setTopListView(e.target.value as typeof topListView)}
              style={{ fontSize: '1rem', padding: '0.625rem 0.75rem' }}
            >
              <option value="balances">Highest Balance</option>
              <option value="oldest">Oldest (Days Outstanding)</option>
              <option value="90plus">90+ Days Overdue</option>
              <option value="recent">Recently Updated</option>
            </select>
          </div>
          {(() => {
            const listMap = {
              balances: displayStats.top_balances,
              oldest: displayStats.top_oldest,
              '90plus': displayStats.top_90_plus,
              recent: displayStats.top_recent,
            };
            const currentList = listMap[topListView] || [];

            if (currentList.length === 0) {
              return (
                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  No invoices found
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {currentList.map((invoice, index) => (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                        style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                          {invoice.customer_name}
                        </div>
                        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          Invoice #{invoice.invoice_number}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold" style={{ color: 'var(--status-error)' }}>
                        {formatCurrency(invoice.balance)}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {invoice.days_outstanding} days
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Recent Activity */}
        <div
          className="p-4 sm:p-5 rounded-xl"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
            Recent Activity
          </h2>
          {displayStats.recent_activity.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              No recent activity
            </div>
          ) : (
            <div className="space-y-3">
              {displayStats.recent_activity.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--christmas-green-light)' }}>
                      {note.author_initials.toUpperCase()}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(note.note_date).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
