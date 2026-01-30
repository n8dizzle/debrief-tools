'use client';

import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export type DailyMetricType = 'calls' | 'views' | 'clicks' | 'directions';

export interface LocationBreakdown {
  name: string;
  views: number;
  clicks: number;
  calls: number;
  directions: number;
}

export interface DailyDataPoint {
  date: string;
  views: number;
  viewsMaps: number;
  viewsSearch: number;
  clicks: number;
  calls: number;
  directions: number;
  byLocation?: LocationBreakdown[];
}

interface DailyMetricsChartProps {
  data: DailyDataPoint[];
  totals: { views: number; clicks: number; calls: number; directions: number };
  avgPerDay: { views: number; clicks: number; calls: number; directions: number };
  isLoading?: boolean;
  title?: string;
}

// Order matters for button rendering - Calls first
const METRIC_CONFIG: Record<DailyMetricType, { label: string; key: keyof DailyDataPoint; color: string }> = {
  calls: { label: 'Calls', key: 'calls', color: '#B8956B' },
  views: { label: 'Views', key: 'views', color: '#5d8a66' },
  clicks: { label: 'Clicks', key: 'clicks', color: '#6B9DB8' },
  directions: { label: 'Directions', key: 'directions', color: '#9B6BB8' },
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
function aggregateToMonthly(data: DailyDataPoint[]): DailyDataPoint[] {
  const byMonth = new Map<string, DailyDataPoint>();

  for (const day of data) {
    const date = new Date(day.date + 'T00:00:00');
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

    const existing = byMonth.get(monthKey) || {
      date: monthKey,
      views: 0,
      viewsMaps: 0,
      viewsSearch: 0,
      clicks: 0,
      calls: 0,
      directions: 0,
      byLocation: [] as LocationBreakdown[],
    };

    existing.views += day.views;
    existing.viewsMaps += day.viewsMaps;
    existing.viewsSearch += day.viewsSearch;
    existing.clicks += day.clicks;
    existing.calls += day.calls;
    existing.directions += day.directions;

    // Aggregate location data
    if (day.byLocation) {
      for (const loc of day.byLocation) {
        const existingLoc = existing.byLocation?.find(l => l.name === loc.name);
        if (existingLoc) {
          existingLoc.views += loc.views;
          existingLoc.clicks += loc.clicks;
          existingLoc.calls += loc.calls;
          existingLoc.directions += loc.directions;
        } else {
          existing.byLocation?.push({ ...loc });
        }
      }
    }

    byMonth.set(monthKey, existing);
  }

  return Array.from(byMonth.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function DailyMetricsChart({
  data,
  totals,
  avgPerDay,
  isLoading = false,
  title = 'Daily Performance',
}: DailyMetricsChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<DailyMetricType>('calls');

  // Determine if we should aggregate to monthly (7+ months = ~210 days)
  const useMonthlyView = data.length > 210;

  const processedData = useMemo(() => {
    return useMonthlyView ? aggregateToMonthly(data) : data;
  }, [data, useMonthlyView]);

  const chartData = useMemo(() => {
    const config = METRIC_CONFIG[selectedMetric];
    return processedData.map(d => ({
      date: d.date,
      dateLabel: useMonthlyView ? formatMonthLabel(d.date) : formatDateLabel(d.date),
      value: d[config.key] as number,
      byLocation: d.byLocation?.map(loc => ({
        name: loc.name,
        value: loc[selectedMetric] as number,
      })).filter(loc => loc.value > 0).sort((a, b) => b.value - a.value) || [],
    }));
  }, [processedData, selectedMetric, useMonthlyView]);

  const maxValue = useMemo(() => {
    return Math.max(...chartData.map(d => d.value), 1);
  }, [chartData]);

  const formatValue = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const currentTotal = totals[selectedMetric];
  const currentAvg = avgPerDay[selectedMetric];

  // Calculate monthly average if in monthly view
  const monthlyAvg = useMonthlyView && processedData.length > 0
    ? currentTotal / processedData.length
    : 0;

  const displayTitle = useMonthlyView ? 'Monthly Performance' : title;

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
            {formatValue(currentTotal)} total &middot;{' '}
            {useMonthlyView
              ? `${formatValue(Math.round(monthlyAvg))} avg/month`
              : `${currentAvg.toFixed(1)} avg/day`
            }
          </p>
        </div>

        {/* Metric Toggle */}
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--border-subtle)' }}
        >
          {(Object.keys(METRIC_CONFIG) as DailyMetricType[]).map((metric) => (
            <button
              key={metric}
              onClick={() => setSelectedMetric(metric)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: selectedMetric === metric ? METRIC_CONFIG[metric].color : 'transparent',
                color: selectedMetric === metric ? 'var(--christmas-cream)' : 'var(--text-secondary)',
              }}
            >
              {METRIC_CONFIG[metric].label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-64">
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
                    className="rounded-lg px-3 py-2 shadow-xl min-w-[180px]"
                    style={{
                      backgroundColor: '#1a1f1a',
                      border: '1px solid #3a453a',
                    }}
                  >
                    <p className="text-xs mb-1" style={{ color: '#8a9a8a' }}>
                      {useMonthlyView
                        ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                        : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                      }
                    </p>
                    <p className="text-lg font-bold mb-2" style={{ color: METRIC_CONFIG[selectedMetric].color }}>
                      {formatValue(item.value)}
                      <span className="text-xs font-normal ml-1" style={{ color: '#8a9a8a' }}>
                        {METRIC_CONFIG[selectedMetric].label.toLowerCase()}
                      </span>
                    </p>
                    {locations.length > 0 && (
                      <div className="border-t pt-2 mt-1" style={{ borderColor: '#3a453a' }}>
                        <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: '#6a7a6a' }}>
                          By Location
                        </p>
                        <div className="space-y-1">
                          {locations.map((loc: { name: string; value: number }, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                              <span className="capitalize" style={{ color: '#aabaa0' }}>
                                {loc.name}
                              </span>
                              <span className="font-medium" style={{ color: METRIC_CONFIG[selectedMetric].color }}>
                                {formatValue(loc.value)}
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
            <Bar
              dataKey="value"
              radius={[2, 2, 0, 0]}
              maxBarSize={useMonthlyView ? 40 : 24}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={METRIC_CONFIG[selectedMetric].color}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default DailyMetricsChart;
