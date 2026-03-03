'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePayrollPermissions } from '@/hooks/usePayrollPermissions';
import { formatCurrency, formatHours, formatCurrencyCompact, getCurrentPayWeekRange, getPayPeriodPresets, formatTimestamp } from '@/lib/payroll-utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DashboardStats {
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  total_pay: number;
  performance_pay: number;
  non_job_hours: number;
  avg_hourly_rate: number;
  employee_count: number;
  daily_hours: { date: string; regular: number; overtime: number; non_job: number }[];
  top_earners: { employee_id: string; employee_name: string; total_hours: number; total_pay: number; performance_pay: number }[];
  last_sync: string | null;
  can_view_pay: boolean;
}

export default function DashboardPage() {
  const { canSyncData, canViewPayAmounts, isLoading: permLoading } = usePayrollPermissions();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dateRange, setDateRange] = useState(getCurrentPayWeekRange);
  const [trade, setTrade] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: dateRange.start,
        end: dateRange.end,
      });
      if (trade) params.set('trade', trade);

      const res = await fetch(`/api/dashboard?${params}`);
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, trade]);

  useEffect(() => {
    if (!permLoading) loadData();
  }, [loadData, permLoading]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/cron/sync', { method: 'POST' });
      await loadData();
    } finally {
      setSyncing(false);
    }
  };

  const kpis = [
    { label: 'Total Hours', value: formatHours(stats?.total_hours || 0), sub: `${stats?.employee_count || 0} employees` },
    { label: 'Regular Hours', value: formatHours(stats?.regular_hours || 0) },
    { label: 'OT Hours', value: formatHours(stats?.overtime_hours || 0), highlight: (stats?.overtime_hours || 0) > 0 },
    { label: 'Non-Job Hours', value: formatHours(stats?.non_job_hours || 0) },
    ...(canViewPayAmounts ? [
      { label: 'Total Pay', value: formatCurrency(stats?.total_pay || 0) },
      { label: 'Perf. Pay', value: formatCurrency(stats?.performance_pay || 0) },
      { label: 'Avg $/hr', value: formatCurrency(stats?.avg_hourly_rate || 0) },
    ] : []),
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Payroll Dashboard
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
              className="btn btn-primary gap-2"
            >
              {syncing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync Now
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Pay Period Presets */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {getPayPeriodPresets().map(preset => {
          const isActive = dateRange.start === preset.start && dateRange.end === preset.end;
          return (
            <button
              key={preset.label}
              onClick={() => setDateRange({ start: preset.start, end: preset.end })}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                backgroundColor: isActive ? 'var(--christmas-green)' : 'var(--bg-card)',
                color: isActive ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                border: `1px solid ${isActive ? 'var(--christmas-green)' : 'var(--border-default)'}`,
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>From</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="input"
            style={{ width: 'auto' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>To</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="input"
            style={{ width: 'auto' }}
          />
        </div>
        <div className="flex gap-1">
          {['', 'hvac', 'plumbing'].map(t => (
            <button
              key={t}
              onClick={() => setTrade(t)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                backgroundColor: trade === t ? 'var(--christmas-green)' : 'var(--bg-card)',
                color: trade === t ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                border: `1px solid ${trade === t ? 'var(--christmas-green)' : 'var(--border-default)'}`,
              }}
            >
              {t === '' ? 'All' : t === 'hvac' ? 'HVAC' : 'Plumbing'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="w-8 h-8 animate-spin" style={{ color: 'var(--christmas-green)' }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            {kpis.map((kpi, i) => (
              <div key={i} className="card">
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                  {kpi.label}
                </div>
                <div
                  className="text-xl font-bold"
                  style={{ color: (kpi as any).highlight ? 'var(--status-warning)' : 'var(--christmas-cream)' }}
                >
                  {kpi.value}
                </div>
                {kpi.sub && (
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{kpi.sub}</div>
                )}
              </div>
            ))}
          </div>

          {/* Daily Hours Chart */}
          {stats?.daily_hours && stats.daily_hours.length > 0 && (
            <div className="card mb-6">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
                Daily Hours
              </h2>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.daily_hours}>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                      tickFormatter={(d) => {
                        const date = new Date(d + 'T00:00:00');
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                    />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                      }}
                      formatter={(value: any, name: any) => [
                        `${Number(value).toFixed(1)} hrs`,
                        name === 'regular' ? 'Regular' : name === 'overtime' ? 'Overtime' : 'Non-Job',
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="regular" stackId="a" fill="var(--christmas-green)" name="Regular" />
                    <Bar dataKey="overtime" stackId="a" fill="var(--status-warning)" name="Overtime" />
                    <Bar dataKey="non_job" stackId="a" fill="var(--text-muted)" name="Non-Job" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top Earners */}
          {stats?.top_earners && stats.top_earners.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
                Top 10 by {canViewPayAmounts ? 'Earnings' : 'Hours'}
              </h2>
              <div className="table-wrapper">
                <table className="pr-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Employee</th>
                      <th className="text-right">Hours</th>
                      {canViewPayAmounts && <th className="text-right">Pay</th>}
                      {canViewPayAmounts && <th className="text-right">Perf. Pay</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.top_earners.map((earner, i) => (
                      <tr key={earner.employee_id}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td>
                          <a href={`/employees/${earner.employee_id}`} style={{ color: 'var(--christmas-green-light)' }}>
                            {earner.employee_name}
                          </a>
                        </td>
                        <td className="text-right">{formatHours(earner.total_hours)}</td>
                        {canViewPayAmounts && <td className="text-right">{formatCurrency(earner.total_pay)}</td>}
                        {canViewPayAmounts && (
                          <td className="text-right" style={{ color: earner.performance_pay > 0 ? 'var(--status-success)' : 'var(--text-muted)' }}>
                            {earner.performance_pay > 0 ? formatCurrency(earner.performance_pay) : '-'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
