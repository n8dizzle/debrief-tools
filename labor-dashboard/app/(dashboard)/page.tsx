'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatCurrencyCompact, formatLocalDate, getMonthLabel, formatTimestamp } from '@/lib/labor-utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Line, ComposedChart,
} from 'recharts';

interface DashboardStats {
  totalPayroll: number;
  hourlyPay: number;
  overtimePay: number;
  commissions: number;
  nonJobTimeCost: number;
}

interface MonthlyData {
  month: string;
  hourly: number;
  overtime: number;
  commission: number;
  nonJob: number;
  total: number;
}

interface ActivityBreakdown {
  activity: string;
  cost: number;
}

interface DashboardData {
  stats: DashboardStats;
  monthlyTrend: MonthlyData[];
  nonJobBreakdown: ActivityBreakdown[];
  lastSync: string | null;
}

type TradeFilter = 'all' | 'hvac' | 'plumbing';

function getDefaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  // Default to past 3 months for a meaningful overview
  start.setMonth(start.getMonth() - 2);
  return {
    start: formatLocalDate(start),
    end: formatLocalDate(now),
  };
}

export default function OverviewPage() {
  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [trade, setTrade] = useState<TradeFilter>('all');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: startDate, end: endDate });
      if (trade !== 'all') params.set('trade', trade);

      const res = await fetch(`/api/dashboard?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, trade]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = data?.stats;
  const chartData = (data?.monthlyTrend || []).map(m => ({
    ...m,
    label: getMonthLabel(m.month),
  }));

  const maxActivityCost = Math.max(...(data?.nonJobBreakdown || []).map(a => a.cost), 1);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Labor Overview
          </h1>
          {data?.lastSync && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Last sync: {formatTimestamp(data.lastSync)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Trade filter */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
            {(['all', 'hvac', 'plumbing'] as TradeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTrade(t)}
                className="px-3 py-1.5 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: trade === t ? 'var(--christmas-green)' : 'var(--bg-card)',
                  color: trade === t ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                }}
              >
                {t === 'all' ? 'All' : t === 'hvac' ? 'HVAC' : 'Plumbing'}
              </button>
            ))}
          </div>

          {/* Date range */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input"
            style={{ width: 'auto' }}
          />
          <span style={{ color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input"
            style={{ width: 'auto' }}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" style={{ borderColor: 'var(--christmas-green)' }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading labor data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <StatCard label="Total Payroll" value={formatCurrencyCompact(stats?.totalPayroll)} />
            <StatCard label="Hourly Pay" value={formatCurrencyCompact(stats?.hourlyPay)} color="var(--christmas-green)" />
            <StatCard label="Overtime" value={formatCurrencyCompact(stats?.overtimePay)} color="var(--christmas-gold)" />
            <StatCard label="Commissions" value={formatCurrencyCompact(stats?.commissions)} color="var(--status-info)" />
            <StatCard label="Non-Job Time" value={formatCurrencyCompact(stats?.nonJobTimeCost)} color="var(--christmas-brown-light)" />
          </div>

          {/* Monthly Trend Chart */}
          {chartData.length > 0 && (
            <div className="card mb-6">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
                Monthly Payroll Trend
              </h2>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis
                      stroke="var(--text-muted)"
                      fontSize={12}
                      tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                      }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((value: any, name: any) => [
                        formatCurrencyCompact(value ?? 0),
                        name === 'hourly' ? 'Hourly' :
                        name === 'overtime' ? 'Overtime' :
                        name === 'commission' ? 'Commissions' :
                        name === 'total' ? 'Total' : name
                      ]) as any}
                    />
                    <Legend />
                    <Bar dataKey="hourly" stackId="a" fill="var(--christmas-green)" name="Hourly" />
                    <Bar dataKey="overtime" stackId="a" fill="var(--christmas-gold)" name="Overtime" />
                    <Bar dataKey="commission" stackId="a" fill="var(--status-info)" name="Commissions" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="total" stroke="var(--christmas-cream)" strokeWidth={2} dot={false} name="Total" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Non-Job Time Breakdown */}
          {(data?.nonJobBreakdown || []).length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
                Non-Job Time Breakdown
              </h2>
              <div className="space-y-3">
                {(data?.nonJobBreakdown || []).slice(0, 15).map((item) => (
                  <div key={item.activity} className="flex items-center gap-3">
                    <div className="w-32 text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                      {item.activity}
                    </div>
                    <div className="flex-1">
                      <div
                        className="h-6 rounded"
                        style={{
                          width: `${Math.max((item.cost / maxActivityCost) * 100, 2)}%`,
                          backgroundColor: 'var(--christmas-brown-light)',
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <div className="w-24 text-right text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {formatCurrencyCompact(item.cost)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!stats?.totalPayroll && (
            <div className="card text-center py-12">
              <p className="text-lg font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                No labor data for this period
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Run a sync from Settings to pull payroll data from ServiceTitan.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="text-xl lg:text-2xl font-bold" style={{ color: color || 'var(--christmas-cream)' }}>
        {value}
      </p>
    </div>
  );
}
