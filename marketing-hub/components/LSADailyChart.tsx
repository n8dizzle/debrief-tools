'use client';

import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export type LSAMetricType = 'total' | 'hvac' | 'plumbing' | 'charged';

export interface LSALocationBreakdown {
  name: string;
  total: number;
  hvac: number;
  plumbing: number;
  charged: number;
}

export interface LSADailyDataPoint {
  date: string;
  total: number;
  hvac: number;
  plumbing: number;
  other: number;
  charged: number;
  nonCharged: number;
  byLocation?: LSALocationBreakdown[];
}

interface LSADailyChartProps {
  data: LSADailyDataPoint[];
  totals: { total: number; hvac: number; plumbing: number; charged: number };
  avgPerDay: { total: number; hvac: number; plumbing: number; charged: number };
  isLoading?: boolean;
  title?: string;
}

const METRIC_CONFIG: Record<LSAMetricType, { label: string; color: string; secondaryColor?: string }> = {
  total: { label: 'All Leads', color: '#5d8a66' },
  hvac: { label: 'HVAC', color: '#5d8a66' },
  plumbing: { label: 'Plumbing', color: '#B8956B' },
  charged: { label: 'Charged', color: '#6B9DB8' },
};

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMonthLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

// Aggregate daily data into monthly buckets
function aggregateToMonthly(data: LSADailyDataPoint[]): LSADailyDataPoint[] {
  const byMonth = new Map<string, LSADailyDataPoint>();

  for (const day of data) {
    const date = new Date(day.date + 'T00:00:00');
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

    const existing = byMonth.get(monthKey) || {
      date: monthKey,
      total: 0,
      hvac: 0,
      plumbing: 0,
      other: 0,
      charged: 0,
      nonCharged: 0,
      byLocation: [] as LSALocationBreakdown[],
    };

    existing.total += day.total;
    existing.hvac += day.hvac;
    existing.plumbing += day.plumbing;
    existing.other += day.other;
    existing.charged += day.charged;
    existing.nonCharged += day.nonCharged;

    // Aggregate location data
    if (day.byLocation) {
      for (const loc of day.byLocation) {
        const existingLoc = existing.byLocation?.find(l => l.name === loc.name);
        if (existingLoc) {
          existingLoc.total += loc.total;
          existingLoc.hvac += loc.hvac;
          existingLoc.plumbing += loc.plumbing;
          existingLoc.charged += loc.charged;
        } else {
          existing.byLocation?.push({ ...loc });
        }
      }
    }

    byMonth.set(monthKey, existing);
  }

  return Array.from(byMonth.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function LSADailyChart({
  data,
  totals,
  avgPerDay,
  isLoading = false,
  title = 'Daily Leads',
}: LSADailyChartProps) {
  const [viewMode, setViewMode] = useState<'stacked' | 'total' | 'charged'>('stacked');

  // Determine if we should aggregate to monthly (7+ months = ~210 days)
  const useMonthlyView = data.length > 210;

  const processedData = useMemo(() => {
    return useMonthlyView ? aggregateToMonthly(data) : data;
  }, [data, useMonthlyView]);

  const chartData = useMemo(() => {
    return processedData.map(d => ({
      date: d.date,
      dateLabel: useMonthlyView ? formatMonthLabel(d.date) : formatDateLabel(d.date),
      total: d.total,
      hvac: d.hvac,
      plumbing: d.plumbing,
      charged: d.charged,
      byLocation: d.byLocation?.sort((a, b) => b.total - a.total) || [],
    }));
  }, [processedData, useMonthlyView]);

  const maxValue = useMemo(() => {
    if (viewMode === 'stacked') {
      return Math.max(...chartData.map(d => d.hvac + d.plumbing), 1);
    } else if (viewMode === 'charged') {
      return Math.max(...chartData.map(d => d.charged), 1);
    }
    return Math.max(...chartData.map(d => d.total), 1);
  }, [chartData, viewMode]);

  const formatValue = (value: number): string => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const displayTitle = useMonthlyView ? 'Monthly Leads' : title;

  // Calculate monthly average if in monthly view
  const monthlyAvg = useMonthlyView && processedData.length > 0
    ? totals.total / processedData.length
    : 0;

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-5 h-full flex flex-col"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            {displayTitle}
          </h2>
        </div>
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading data...
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className="rounded-xl p-5 h-full flex flex-col"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            {displayTitle}
          </h2>
        </div>
        <div className="h-64 flex items-center justify-center flex-col gap-2">
          <svg className="w-12 h-12 opacity-50" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-5 h-full flex flex-col"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            {displayTitle}
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {formatValue(totals.total)} total &middot;{' '}
            {useMonthlyView
              ? `${formatValue(Math.round(monthlyAvg))} avg/month`
              : `${avgPerDay.total.toFixed(1)} avg/day`
            }
          </p>
        </div>

        {/* View Toggle */}
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--border-subtle)' }}
        >
          <button
            onClick={() => setViewMode('stacked')}
            className="px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: viewMode === 'stacked' ? '#5d8a66' : 'transparent',
              color: viewMode === 'stacked' ? 'var(--christmas-cream)' : 'var(--text-secondary)',
            }}
          >
            HVAC/Plumbing
          </button>
          <button
            onClick={() => setViewMode('total')}
            className="px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: viewMode === 'total' ? '#5d8a66' : 'transparent',
              color: viewMode === 'total' ? 'var(--christmas-cream)' : 'var(--text-secondary)',
            }}
          >
            Total
          </button>
          <button
            onClick={() => setViewMode('charged')}
            className="px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: viewMode === 'charged' ? '#6B9DB8' : 'transparent',
              color: viewMode === 'charged' ? 'var(--christmas-cream)' : 'var(--text-secondary)',
            }}
          >
            Charged
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <XAxis
              dataKey="dateLabel"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--border-subtle)' }}
              tickLine={false}
              interval={useMonthlyView ? 0 : 'preserveStartEnd'}
              minTickGap={useMonthlyView ? 10 : 30}
              angle={useMonthlyView && chartData.length > 12 ? -45 : 0}
              textAnchor={useMonthlyView && chartData.length > 12 ? 'end' : 'middle'}
              height={useMonthlyView && chartData.length > 12 ? 50 : 30}
            />
            <YAxis
              domain={[0, maxValue]}
              tickFormatter={formatValue}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null;
                const item = payload[0].payload;
                const locations = item.byLocation || [];
                const date = new Date(item.date + 'T00:00:00');

                return (
                  <div
                    className="rounded-lg px-3 py-2 shadow-xl min-w-[200px]"
                    style={{
                      backgroundColor: '#1a1f1a',
                      border: '1px solid #3a453a',
                    }}
                  >
                    <p className="text-xs mb-2" style={{ color: '#8a9a8a' }}>
                      {useMonthlyView
                        ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                        : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                      }
                    </p>

                    <div className="space-y-1 mb-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm" style={{ color: '#aabaa0' }}>Total Leads</span>
                        <span className="text-sm font-bold" style={{ color: '#e5e0d6' }}>{item.total}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#5d8a66' }} />
                          <span style={{ color: '#8a9a8a' }}>HVAC</span>
                        </span>
                        <span className="text-xs font-medium" style={{ color: '#5d8a66' }}>{item.hvac}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#B8956B' }} />
                          <span style={{ color: '#8a9a8a' }}>Plumbing</span>
                        </span>
                        <span className="text-xs font-medium" style={{ color: '#B8956B' }}>{item.plumbing}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t" style={{ borderColor: '#3a453a' }}>
                        <span className="text-xs" style={{ color: '#8a9a8a' }}>Charged</span>
                        <span className="text-xs font-medium" style={{ color: '#6B9DB8' }}>{item.charged}</span>
                      </div>
                    </div>

                    {locations.length > 0 && (
                      <div className="border-t pt-2" style={{ borderColor: '#3a453a' }}>
                        <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: '#6a7a6a' }}>
                          By Location
                        </p>
                        <div className="space-y-1">
                          {locations.slice(0, 5).map((loc: LSALocationBreakdown, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                              <span className="truncate max-w-[120px]" style={{ color: '#aabaa0' }}>
                                {loc.name}
                              </span>
                              <span className="font-medium" style={{ color: '#e5e0d6' }}>
                                {loc.total}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {viewMode === 'stacked' ? (
              <>
                <Bar
                  dataKey="hvac"
                  stackId="a"
                  fill="#5d8a66"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={useMonthlyView ? 40 : 24}
                  name="HVAC"
                />
                <Bar
                  dataKey="plumbing"
                  stackId="a"
                  fill="#B8956B"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={useMonthlyView ? 40 : 24}
                  name="Plumbing"
                />
              </>
            ) : viewMode === 'charged' ? (
              <Bar
                dataKey="charged"
                fill="#6B9DB8"
                radius={[2, 2, 0, 0]}
                maxBarSize={useMonthlyView ? 40 : 24}
                fillOpacity={0.85}
              />
            ) : (
              <Bar
                dataKey="total"
                fill="#5d8a66"
                radius={[2, 2, 0, 0]}
                maxBarSize={useMonthlyView ? 40 : 24}
                fillOpacity={0.85}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend for stacked view */}
      {viewMode === 'stacked' && (
        <div className="flex items-center justify-center gap-6 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#5d8a66' }} />
            <span>HVAC ({formatValue(totals.hvac)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#B8956B' }} />
            <span>Plumbing ({formatValue(totals.plumbing)})</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default LSADailyChart;
