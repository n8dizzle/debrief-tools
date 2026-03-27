'use client';

import { useState, useEffect, useCallback } from 'react';
import { APDashboardStats } from '@/lib/supabase';
import { formatTimestamp, formatCurrency, formatCurrencyCompact } from '@/lib/ap-utils';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import StatsCards from '@/components/StatsCards';
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

function getQuarterToDateRange(): DateRange {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3);
  const qStart = new Date(now.getFullYear(), quarter * 3, 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const startMonth = String(qStart.getMonth() + 1).padStart(2, '0');
  return { start: `${qStart.getFullYear()}-${startMonth}-01`, end: `${year}-${month}-${day}` };
}

export default function DashboardPage() {
  const { canSyncData } = useAPPermissions();
  const [stats, setStats] = useState<APDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(getQuarterToDateRange);
  const [trade, setTrade] = useState<'' | 'hvac' | 'plumbing'>('');

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ start: dateRange.start, end: dateRange.end });
      if (trade) params.set('trade', trade);
      const statsRes = await fetch(`/api/dashboard?${params}`);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, trade]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        await loadData();
      } else {
        console.error('Sync failed');
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Dashboard
          </h1>
          {stats?.last_sync && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Last sync: {formatTimestamp(stats.last_sync)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
        {canSyncData && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn btn-primary"
            style={{ opacity: syncing ? 0.6 : 1 }}
          >
            {syncing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </>
            )}
          </button>
        )}
        </div>
      </div>

      {/* Trade Filter Chips + Date Range */}
      <div className="flex items-center gap-2 mb-6">
        <DateRangePicker value={dateRange} onChange={setDateRange} defaultPreset="qtd" />
        <span className="mx-1" style={{ color: 'var(--border-subtle)' }}>|</span>
        <button
          onClick={() => setTrade(trade === 'hvac' ? '' : 'hvac')}
          className="px-3 py-1 rounded-full text-xs font-medium transition-all"
          style={{
            backgroundColor: trade === 'hvac' ? 'rgba(93, 138, 102, 0.2)' : 'var(--bg-secondary)',
            color: trade === 'hvac' ? 'var(--christmas-green-light)' : 'var(--text-secondary)',
            border: trade === 'hvac' ? '1px solid var(--christmas-green-light)' : '1px solid var(--border-subtle)',
          }}
        >
          HVAC
        </button>
        <button
          onClick={() => setTrade(trade === 'plumbing' ? '' : 'plumbing')}
          className="px-3 py-1 rounded-full text-xs font-medium transition-all"
          style={{
            backgroundColor: trade === 'plumbing' ? 'rgba(184, 149, 107, 0.2)' : 'var(--bg-secondary)',
            color: trade === 'plumbing' ? 'var(--christmas-gold)' : 'var(--text-secondary)',
            border: trade === 'plumbing' ? '1px solid var(--christmas-gold)' : '1px solid var(--border-subtle)',
          }}
        >
          Plumbing
        </button>
      </div>

      {/* Stats Cards */}
      <div className="mb-8">
        <StatsCards stats={stats} isLoading={loading} />
      </div>

      {/* Monthly Contractor % Trend */}
      {stats && stats.monthly_trend.length > 0 && (
        <div className="card mb-8 p-4">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Monthly Contractor Trends
          </h2>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.monthly_trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="dollars"
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatCurrencyCompact(v)}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--christmas-cream)',
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    const v = Number(value) || 0;
                    if (name === 'contractor_pct') return [`${v.toFixed(1)}%`, 'Cost %'];
                    if (name === 'contractor_usage_pct') return [`${v.toFixed(1)}%`, 'Usage %'];
                    return [formatCurrency(v), name === 'job_total' ? 'Job Total' : 'Contractor Pay'];
                  }}
                  labelStyle={{ color: 'var(--text-muted)', marginBottom: 4 }}
                />
                <Bar yAxisId="dollars" dataKey="job_total" fill="#346643" radius={[3, 3, 0, 0]} barSize={24} />
                <Bar yAxisId="dollars" dataKey="contractor_pay" fill="#B8956B" radius={[3, 3, 0, 0]} barSize={24} />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="contractor_pct"
                  stroke="#F5F0E1"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#F5F0E1', stroke: '#F5F0E1' }}
                />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="contractor_usage_pct"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#a78bfa', stroke: '#a78bfa' }}
                  strokeDasharray="5 3"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Paid by Contractor */}
      {stats && stats.contractor_breakdown.length > 0 && (
        <div className="card mb-8 p-4">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Paid by Contractor
          </h2>
          <div style={{ height: Math.max(200, stats.contractor_breakdown.length * 48) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.contractor_breakdown}
                layout="vertical"
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  tickLine={false}
                  tickFormatter={(v: number) => formatCurrencyCompact(v)}
                />
                <YAxis
                  type="category"
                  dataKey="contractor_name"
                  width={120}
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--christmas-cream)',
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    const v = Number(value) || 0;
                    const label = name === 'total_paid' ? 'Paid' : 'Outstanding';
                    return [formatCurrency(v), label];
                  }}
                  labelStyle={{ color: 'var(--text-muted)', marginBottom: 4 }}
                />
                <Bar dataKey="total_paid" stackId="a" fill="#346643" radius={[0, 0, 0, 0]} />
                <Bar dataKey="total_outstanding" stackId="a" fill="#B8956B" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
}
