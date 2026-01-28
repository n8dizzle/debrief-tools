'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, getAgingBucketLabel } from '@/lib/ar-utils';
import { ARDashboardStats } from '@/lib/supabase';
import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<ARDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [excludeFinancing, setExcludeFinancing] = useState(true);
  const [topListView, setTopListView] = useState<'balances' | 'oldest' | '90plus' | 'recent'>('balances');

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
    avg_dso: 0,
    aging_buckets: { current: 0, bucket_30: 0, bucket_60: 0, bucket_90_plus: 0 },
    install_total: 0,
    service_total: 0,
    residential_total: 0,
    commercial_total: 0,
    inhouse_financing_total: 0,
    inhouse_financing_count: 0,
    inhouse_financing_delinquent: 0,
    business_unit_totals: [],
    top_balances: [],
    top_oldest: [],
    top_90_plus: [],
    top_recent: [],
    recent_activity: [],
  };

  // Cohesive color palette for all charts
  const COLORS = {
    // Pie chart / Business units - cool to warm gradient
    chart: [
      '#22c55e', // green
      '#14b8a6', // teal
      '#0ea5e9', // sky blue
      '#6366f1', // indigo
      '#a855f7', // purple
      '#f59e0b', // amber
      '#f97316', // orange
      '#ef4444', // red
    ],
    // Aging buckets - green to red severity scale
    aging: {
      current: '#22c55e',    // green - good
      days30: '#f59e0b',     // amber - warning
      days60: '#f97316',     // orange - concern
      days90: '#ef4444',     // red - critical
    },
    // Residential vs Commercial
    residential: '#0ea5e9',  // sky blue
    commercial: '#a855f7',   // purple
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
          <button
            onClick={() => window.location.reload()}
            className="btn btn-secondary"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Total Outstanding
          </div>
          <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {formatCurrency(displayStats.total_outstanding)}
          </div>
        </div>

        <div className="card">
          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            AR Collectible
          </div>
          <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--status-success)' }}>
            {formatCurrency(displayStats.ar_collectible)}
          </div>
        </div>

        <div className="card">
          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            AR Not In Control
          </div>
          <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--status-warning)' }}>
            {formatCurrency(displayStats.ar_not_in_control)}
          </div>
        </div>

        <div className="card">
          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Average DSO
          </div>
          <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {displayStats.avg_dso} days
          </div>
        </div>
      </div>

      {/* Residential vs Commercial */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Residential vs Commercial
        </h2>
        {(() => {
          const total = displayStats.residential_total + displayStats.commercial_total;
          const residentialPct = total > 0 ? (displayStats.residential_total / total) * 100 : 0;
          const commercialPct = total > 0 ? (displayStats.commercial_total / total) * 100 : 0;

          return (
            <div className="space-y-3">
              {/* Stacked Bar */}
              <div className="h-12 rounded-lg overflow-hidden flex" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                {residentialPct > 0 && (
                  <div
                    className="h-full flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ width: `${residentialPct}%`, backgroundColor: COLORS.residential }}
                    onClick={() => router.push('/invoices?customerType=residential')}
                  >
                    {residentialPct >= 15 && (
                      <span className="text-white text-sm font-medium px-2 truncate">
                        {formatCurrency(displayStats.residential_total)} ({residentialPct.toFixed(0)}%)
                      </span>
                    )}
                  </div>
                )}
                {commercialPct > 0 && (
                  <div
                    className="h-full flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ width: `${commercialPct}%`, backgroundColor: COLORS.commercial }}
                    onClick={() => router.push('/invoices?customerType=commercial')}
                  >
                    {commercialPct >= 15 && (
                      <span className="text-white text-sm font-medium px-2 truncate">
                        {formatCurrency(displayStats.commercial_total)} ({commercialPct.toFixed(0)}%)
                      </span>
                    )}
                  </div>
                )}
              </div>
              {/* Legend */}
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.residential }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Residential</span>
                  {residentialPct < 15 && (
                    <span style={{ color: 'var(--text-muted)' }}>
                      {formatCurrency(displayStats.residential_total)} ({residentialPct.toFixed(0)}%)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {commercialPct < 15 && (
                    <span style={{ color: 'var(--text-muted)' }}>
                      {formatCurrency(displayStats.commercial_total)} ({commercialPct.toFixed(0)}%)
                    </span>
                  )}
                  <span style={{ color: 'var(--text-secondary)' }}>Commercial</span>
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.commercial }} />
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Aging Buckets & Business Unit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aging Buckets */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Aging Breakdown
          </h2>
          <div className="space-y-4">
            {[
              { key: 'current' as const, filterValue: 'current', label: 'Current (0-30 days)', value: displayStats.aging_buckets.current, color: COLORS.aging.current },
              { key: 'bucket_30' as const, filterValue: '30', label: '31-60 days', value: displayStats.aging_buckets.bucket_30, color: COLORS.aging.days30 },
              { key: 'bucket_60' as const, filterValue: '60', label: '61-90 days', value: displayStats.aging_buckets.bucket_60, color: COLORS.aging.days60 },
              { key: 'bucket_90_plus' as const, filterValue: '90+', label: '90+ days', value: displayStats.aging_buckets.bucket_90_plus, color: COLORS.aging.days90 },
            ].map((bucket) => {
              const percent = displayStats.total_outstanding > 0
                ? (bucket.value / displayStats.total_outstanding) * 100
                : 0;
              return (
                <div
                  key={bucket.key}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => router.push(`/invoices?agingBucket=${encodeURIComponent(bucket.filterValue)}`)}
                >
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'var(--text-secondary)' }}>{bucket.label}</span>
                    <span style={{ color: bucket.color }}>{formatCurrency(bucket.value)}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${percent}%`, backgroundColor: bucket.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AR by Business Unit */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            AR by Business Unit
          </h2>
          {displayStats.business_unit_totals.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              No data available
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={displayStats.business_unit_totals}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={true}
                    style={{ cursor: 'pointer' }}
                    onClick={(data) => {
                      if (data && data.name) {
                        router.push(`/invoices?businessUnit=${encodeURIComponent(data.name)}`);
                      }
                    }}
                  >
                    {displayStats.business_unit_totals.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Balance']}
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #444',
                      borderRadius: '8px',
                      padding: '8px 12px',
                    }}
                    labelStyle={{ color: '#F5F0E1', fontWeight: 'bold', marginBottom: '4px' }}
                    itemStyle={{ color: '#F5F0E1' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* In-House Financing Summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
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
        <div className="card">
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>
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
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
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
