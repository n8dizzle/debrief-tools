'use client';

import { useState, useEffect, useCallback } from 'react';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { formatCurrency, formatCurrencyCompact, formatDate } from '@/lib/ap-utils';
import type { APLaborStats, APLaborOverhead, APInstallJob } from '@/lib/supabase';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts';

function getYearToDateRange(): DateRange {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return { start: `${year}-01-01`, end: `${year}-${month}-${day}` };
}

export default function LaborPage() {
  const { canManageAssignments } = useAPPermissions();
  const [stats, setStats] = useState<APLaborStats | null>(null);
  const [overheads, setOverheads] = useState<APLaborOverhead[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>(getYearToDateRange);
  const [trade, setTrade] = useState<'' | 'hvac' | 'plumbing'>('');

  // Job breakdown
  const [showJobBreakdown, setShowJobBreakdown] = useState(false);
  const [jobBreakdown, setJobBreakdown] = useState<APInstallJob[]>([]);
  const [jobBreakdownLoading, setJobBreakdownLoading] = useState(false);

  // Overhead form
  const [overheadMonth, setOverheadMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [overheadAmount, setOverheadAmount] = useState('');
  const [overheadNotes, setOverheadNotes] = useState('');
  const [savingOverhead, setSavingOverhead] = useState(false);

  // Scenario calculator
  const [scenario, setScenario] = useState({
    revenue: 0,
    contractorMixPct: 0,
    avgContractorRatePct: 0,
    inHouseHourlyRate: 0,
    avgHoursPerJob: 0,
    monthlyOverhead: 0,
  });
  const [scenarioInitialized, setScenarioInitialized] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ start: dateRange.start, end: dateRange.end });
      if (trade) params.set('trade', trade);

      const [statsRes, overheadsRes] = await Promise.all([
        fetch(`/api/labor?${params}`),
        fetch('/api/labor/overheads'),
      ]);

      if (statsRes.ok) {
        const data: APLaborStats = await statsRes.json();
        setStats(data);

        // Initialize scenario with actual data
        if (!scenarioInitialized && data.total_revenue > 0) {
          const totalJobs = data.monthly_breakdown.reduce((s, m) => s + m.job_count, 0);
          const contractorJobs = data.monthly_breakdown.reduce((s, m) => s + m.contractor_count, 0);
          const inHouseJobs = data.monthly_breakdown.reduce((s, m) => s + m.in_house_count, 0);
          const mixPct = totalJobs > 0 ? Math.round((contractorJobs / totalJobs) * 100) : 0;
          const avgContractorRate = data.total_revenue > 0 && contractorJobs > 0
            ? Math.round((data.contractor_labor_cost / (data.total_revenue * (contractorJobs / totalJobs))) * 1000) / 10
            : 0;
          const avgHours = inHouseJobs > 0 && data.in_house_labor_cost > 0
            ? 8 // default estimate
            : 8;
          const inHouseRate = data.in_house_labor_cost > 0 && inHouseJobs > 0
            ? Math.round(data.in_house_labor_cost / (inHouseJobs * avgHours) * 100) / 100
            : 35;
          const months = data.monthly_breakdown.length || 1;
          const monthlyOverhead = Math.round(data.overhead_cost / months);

          setScenario({
            revenue: Math.round(data.total_revenue),
            contractorMixPct: mixPct,
            avgContractorRatePct: avgContractorRate || 15,
            inHouseHourlyRate: inHouseRate || 35,
            avgHoursPerJob: avgHours,
            monthlyOverhead,
          });
          setScenarioInitialized(true);
        }
      }
      if (overheadsRes.ok) {
        setOverheads(await overheadsRes.json());
      }
    } catch (err) {
      console.error('Failed to load labor data:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, trade, scenarioInitialized]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadJobBreakdown = useCallback(async () => {
    setJobBreakdownLoading(true);
    try {
      const params = new URLSearchParams({
        start: dateRange.start,
        end: dateRange.end,
        limit: '500',
        offset: '0',
      });
      if (trade) params.set('trade', trade);
      // Fetch both in-house and contractor assigned jobs
      const [inHouseRes, contractorRes] = await Promise.all([
        fetch(`/api/jobs?${params}&assignment=in_house`),
        fetch(`/api/jobs?${params}&assignment=contractor`),
      ]);
      const allJobs: APInstallJob[] = [];
      if (inHouseRes.ok) {
        const data = await inHouseRes.json();
        allJobs.push(...(data.jobs || []));
      }
      if (contractorRes.ok) {
        const data = await contractorRes.json();
        allJobs.push(...(data.jobs || []));
      }
      // Sort by date desc
      allJobs.sort((a, b) => (b.completed_date || b.scheduled_date || '').localeCompare(a.completed_date || a.scheduled_date || ''));
      setJobBreakdown(allJobs);
    } catch (err) {
      console.error('Failed to load job breakdown:', err);
    } finally {
      setJobBreakdownLoading(false);
    }
  }, [dateRange, trade]);

  useEffect(() => {
    if (showJobBreakdown) {
      loadJobBreakdown();
    }
  }, [showJobBreakdown, loadJobBreakdown]);

  const handleSaveOverhead = async () => {
    if (!overheadMonth || !overheadAmount) return;
    setSavingOverhead(true);
    try {
      const res = await fetch('/api/labor/overheads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: overheadMonth,
          amount: Number(overheadAmount),
          notes: overheadNotes || null,
        }),
      });
      if (res.ok) {
        setOverheadAmount('');
        setOverheadNotes('');
        await loadData();
      }
    } catch (err) {
      console.error('Failed to save overhead:', err);
    } finally {
      setSavingOverhead(false);
    }
  };

  // Scenario calculations
  const projectedContractorCost = scenario.revenue * (scenario.contractorMixPct / 100) * (scenario.avgContractorRatePct / 100);
  const inHouseJobCount = Math.round((1 - scenario.contractorMixPct / 100) * (stats?.monthly_breakdown.reduce((s, m) => s + m.job_count, 0) || 0));
  const projectedInHouseCost = inHouseJobCount * scenario.avgHoursPerJob * scenario.inHouseHourlyRate;
  const months = stats?.monthly_breakdown.length || 1;
  const projectedOverhead = scenario.monthlyOverhead * months;
  const projectedTotalLabor = projectedContractorCost + projectedInHouseCost + projectedOverhead;
  const projectedLaborPct = scenario.revenue > 0 ? Math.round((projectedTotalLabor / scenario.revenue) * 1000) / 10 : 0;
  const deltaFromGoal = scenario.revenue > 0 ? projectedTotalLabor - (scenario.revenue * 0.095) : 0;

  const getLaborColor = (pct: number) => {
    if (pct <= 9.5) return 'var(--status-success)';
    if (pct <= 12) return 'var(--status-warning)';
    return 'var(--status-error)';
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Labor Calculator
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Track labor costs as % of revenue — goal is 9.5%
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
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
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 w-24 rounded" style={{ background: 'var(--border-subtle)' }} />
              <div className="h-8 w-16 rounded mt-2" style={{ background: 'var(--border-subtle)' }} />
            </div>
          ))}
        </div>
      ) : stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="card">
              <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Labor %
              </div>
              <div className="text-2xl font-bold mt-1" style={{ color: getLaborColor(stats.labor_pct) }}>
                {stats.labor_pct}%
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Goal: {stats.goal_pct}%
              </div>
            </div>
            <div className="card">
              <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Total Labor Cost
              </div>
              <div className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(stats.total_labor_cost)}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                of {formatCurrency(stats.total_revenue)} revenue
              </div>
            </div>
            <div className="card">
              <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Contractor Labor
              </div>
              <div className="text-2xl font-bold mt-1" style={{ color: 'var(--christmas-gold)' }}>
                {formatCurrency(stats.contractor_labor_cost)}
              </div>
            </div>
            <div className="card">
              <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                In-House Labor
              </div>
              <div className="text-2xl font-bold mt-1" style={{ color: 'var(--christmas-green-light)' }}>
                {formatCurrency(stats.in_house_labor_cost)}
              </div>
            </div>
            <div className="card">
              <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Overhead
              </div>
              <div className="text-2xl font-bold mt-1" style={{ color: 'var(--text-secondary)' }}>
                {formatCurrency(stats.overhead_cost)}
              </div>
            </div>
          </div>

          {/* Data quality warnings */}
          {(stats.jobs_missing_hours > 0 || stats.techs_missing_rates > 0) && (
            <div className="mb-6 space-y-2">
              {stats.jobs_missing_hours > 0 && (
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: 'var(--status-warning)' }}>
                  {stats.jobs_missing_hours} in-house job{stats.jobs_missing_hours !== 1 ? 's' : ''} missing labor hours — labor estimates may be incomplete
                </div>
              )}
              {stats.techs_missing_rates > 0 && (
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: 'var(--status-warning)' }}>
                  {stats.techs_missing_rates} active technician{stats.techs_missing_rates !== 1 ? 's' : ''} missing hourly rates —{' '}
                  <a href="/settings" style={{ textDecoration: 'underline' }}>set rates in Settings</a>
                </div>
              )}
            </div>
          )}

          {/* Monthly Trend Chart */}
          {stats.monthly_breakdown.length > 0 && (
            <div className="card mb-8 p-4">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
                Monthly Labor Breakdown
              </h2>
              <div className="h-48 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={stats.monthly_breakdown} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
                      domain={[0, 'auto']}
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
                        if (name === 'labor_pct') return [`${v.toFixed(1)}%`, 'Labor %'];
                        if (name === 'contractor_labor') return [formatCurrency(v), 'Contractor'];
                        if (name === 'in_house_labor') return [formatCurrency(v), 'In-House'];
                        if (name === 'overhead') return [formatCurrency(v), 'Overhead'];
                        return [formatCurrency(v), name];
                      }}
                      labelStyle={{ color: 'var(--text-muted)', marginBottom: 4 }}
                    />
                    <Bar yAxisId="dollars" dataKey="contractor_labor" fill="#B8956B" stackId="labor" radius={[0, 0, 0, 0]} barSize={28} />
                    <Bar yAxisId="dollars" dataKey="in_house_labor" fill="#346643" stackId="labor" radius={[0, 0, 0, 0]} barSize={28} />
                    <Bar yAxisId="dollars" dataKey="overhead" fill="#6b7280" stackId="labor" radius={[3, 3, 0, 0]} barSize={28} />
                    <Line
                      yAxisId="pct"
                      type="monotone"
                      dataKey="labor_pct"
                      stroke="#F5F0E1"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#F5F0E1', stroke: '#F5F0E1' }}
                    />
                    <ReferenceLine yAxisId="pct" y={9.5} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#B8956B' }} /> Contractor
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#346643' }} /> In-House
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#6b7280' }} /> Overhead
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1 inline-block" style={{ backgroundColor: '#F5F0E1' }} /> Labor %
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0 inline-block border-t border-dashed" style={{ borderColor: '#ef4444' }} /> 9.5% Goal
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Scenario Calculator + Overhead Entry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Scenario Calculator */}
        <div className="card p-4">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Scenario Calculator
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                Revenue Forecast
              </label>
              <input
                type="number"
                value={scenario.revenue}
                onChange={e => setScenario(s => ({ ...s, revenue: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--christmas-cream)',
                  border: '1px solid var(--border-subtle)',
                }}
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                Contractor Mix: {scenario.contractorMixPct}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={scenario.contractorMixPct}
                onChange={e => setScenario(s => ({ ...s, contractorMixPct: Number(e.target.value) }))}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                Avg Contractor Rate %
              </label>
              <input
                type="number"
                step="0.5"
                value={scenario.avgContractorRatePct}
                onChange={e => setScenario(s => ({ ...s, avgContractorRatePct: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--christmas-cream)',
                  border: '1px solid var(--border-subtle)',
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                  In-House $/hr
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={scenario.inHouseHourlyRate}
                  onChange={e => setScenario(s => ({ ...s, inHouseHourlyRate: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--christmas-cream)',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                  Avg Hrs/Job
                </label>
                <input
                  type="number"
                  step="0.25"
                  value={scenario.avgHoursPerJob}
                  onChange={e => setScenario(s => ({ ...s, avgHoursPerJob: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--christmas-cream)',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                Monthly Overhead
              </label>
              <input
                type="number"
                value={scenario.monthlyOverhead}
                onChange={e => setScenario(s => ({ ...s, monthlyOverhead: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--christmas-cream)',
                  border: '1px solid var(--border-subtle)',
                }}
              />
            </div>
          </div>

          {/* Scenario Output */}
          <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Projected Labor %
              </span>
              <span className="text-2xl font-bold" style={{ color: getLaborColor(projectedLaborPct) }}>
                {projectedLaborPct}%
              </span>
            </div>
            <div className="space-y-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex justify-between">
                <span>Contractor cost</span>
                <span>{formatCurrency(projectedContractorCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>In-house cost</span>
                <span>{formatCurrency(projectedInHouseCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Overhead</span>
                <span>{formatCurrency(projectedOverhead)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="font-medium">Total labor</span>
                <span className="font-medium">{formatCurrency(projectedTotalLabor)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Delta from 9.5% goal</span>
                <span style={{ color: deltaFromGoal <= 0 ? 'var(--status-success)' : 'var(--status-error)' }}>
                  {deltaFromGoal <= 0 ? '' : '+'}{formatCurrency(deltaFromGoal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Overhead Entry */}
        <div className="card p-4">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Monthly Overhead
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Non-job labor costs: training, drive time, shop time, etc.
          </p>

          {canManageAssignments && (
            <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
                    Month
                  </label>
                  <input
                    type="month"
                    value={overheadMonth}
                    onChange={e => setOverheadMonth(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--christmas-cream)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
                    Amount
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={overheadAmount}
                    onChange={e => setOverheadAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--christmas-cream)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
                  Notes (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Training days, extra drive time"
                  value={overheadNotes}
                  onChange={e => setOverheadNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--christmas-cream)',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
              </div>
              <button
                onClick={handleSaveOverhead}
                disabled={savingOverhead || !overheadAmount}
                className="btn btn-primary text-sm"
                style={{ opacity: savingOverhead || !overheadAmount ? 0.5 : 1 }}
              >
                {savingOverhead ? 'Saving...' : 'Save Overhead'}
              </button>
            </div>
          )}

          {/* Overhead History */}
          {overheads.length > 0 ? (
            <div className="table-wrapper">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Amount</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {overheads.map(o => (
                    <tr key={o.id}>
                      <td className="text-sm" style={{ color: 'var(--text-primary)' }}>{o.month}</td>
                      <td className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatCurrency(o.amount)}</td>
                      <td className="text-sm" style={{ color: 'var(--text-muted)' }}>{o.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 rounded-lg text-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No overhead entries yet
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Per-Job Breakdown */}
      {!loading && stats && (
        <div className="card mt-8 p-4">
          <button
            onClick={() => setShowJobBreakdown(!showJobBreakdown)}
            className="flex items-center gap-2 w-full text-left"
          >
            <svg
              className="w-4 h-4 transition-transform"
              style={{
                color: 'var(--text-muted)',
                transform: showJobBreakdown ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              Per-Job Labor Costs
            </h2>
            <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
              {showJobBreakdown ? 'Click to collapse' : 'Click to expand'}
            </span>
          </button>

          {showJobBreakdown && (
            <div className="mt-4">
              {jobBreakdownLoading ? (
                <div className="flex items-center gap-2 py-8 justify-center" style={{ color: 'var(--text-muted)' }}>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading jobs...
                </div>
              ) : jobBreakdown.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  No assigned jobs in this period
                </p>
              ) : (
                <div className="table-wrapper">
                  <table className="ap-table">
                    <thead>
                      <tr>
                        <th>Job #</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Type</th>
                        <th style={{ textAlign: 'right' }}>Job Total</th>
                        <th>Assignment</th>
                        <th>Details</th>
                        <th style={{ textAlign: 'right' }}>Labor Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobBreakdown.map(job => {
                        const isContractor = job.assignment_type === 'contractor';
                        const laborCost = isContractor
                          ? (job.payment_amount != null ? Number(job.payment_amount) : null)
                          : (job.labor_cost != null ? Number(job.labor_cost) : null);
                        const costColor = isContractor ? 'var(--christmas-gold)' : 'var(--christmas-green-light)';

                        return (
                          <tr
                            key={job.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => window.open(`/jobs/${job.id}`, '_blank')}
                          >
                            <td>
                              <span className="font-mono text-sm" style={{ color: 'var(--christmas-green-light)' }}>
                                {job.job_number}
                              </span>
                            </td>
                            <td className="text-sm" style={{ color: 'var(--text-primary)' }}>
                              {job.customer_name || '—'}
                            </td>
                            <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              {formatDate(job.completed_date || job.scheduled_date)}
                            </td>
                            <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              {job.job_type_name || '—'}
                            </td>
                            <td className="text-sm font-medium" style={{ textAlign: 'right', color: 'var(--text-primary)' }}>
                              {formatCurrency(job.job_total)}
                            </td>
                            <td>
                              <span
                                className="badge text-xs"
                                style={{
                                  backgroundColor: isContractor ? 'rgba(184, 149, 107, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                  color: isContractor ? 'var(--christmas-gold)' : 'var(--status-info)',
                                }}
                              >
                                {isContractor ? 'Contractor' : 'In-House'}
                              </span>
                            </td>
                            <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {isContractor ? (
                                job.contractor?.name || '—'
                              ) : (
                                job.labor_hours != null
                                  ? `${job.labor_hours} hrs${job.technician?.hourly_rate != null ? ` × ${formatCurrency(job.technician.hourly_rate)}/hr` : ''}`
                                  : 'No hours'
                              )}
                            </td>
                            <td className="text-sm font-medium" style={{ textAlign: 'right', color: laborCost != null ? costColor : 'var(--text-muted)' }}>
                              {laborCost != null ? formatCurrency(laborCost) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={7} className="text-sm font-semibold" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          Total
                        </td>
                        <td className="text-sm font-bold" style={{ textAlign: 'right', color: 'var(--christmas-cream)' }}>
                          {formatCurrency(
                            jobBreakdown.reduce((sum, j) => {
                              if (j.assignment_type === 'contractor' && j.payment_amount != null) return sum + Number(j.payment_amount);
                              if (j.assignment_type === 'in_house' && j.labor_cost != null) return sum + Number(j.labor_cost);
                              return sum;
                            }, 0)
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
