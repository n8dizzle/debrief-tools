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

export type MetricType = 'views' | 'calls' | 'clicks' | 'directions';

export interface LocationData {
  locationId: string;
  locationName: string;
  totalViews: number;
  viewsMaps: number;
  viewsSearch: number;
  websiteClicks: number;
  phoneCalls: number;
  directionRequests: number;
}

interface LocationComparisonChartProps {
  data: LocationData[];
  isLoading?: boolean;
  period?: string;
  onPeriodChange?: (period: string) => void;
}

const METRIC_CONFIG: Record<MetricType, { label: string; key: keyof LocationData; color: string }> = {
  views: { label: 'Views', key: 'totalViews', color: 'var(--christmas-green)' },
  calls: { label: 'Calls', key: 'phoneCalls', color: '#B8956B' },
  clicks: { label: 'Website Clicks', key: 'websiteClicks', color: '#6B9DB8' },
  directions: { label: 'Directions', key: 'directionRequests', color: '#9B6BB8' },
};

const PERIODS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export function LocationComparisonChart({
  data,
  isLoading = false,
  period = '30d',
  onPeriodChange,
}: LocationComparisonChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('views');

  // Transform and sort data for the chart
  const chartData = useMemo(() => {
    const config = METRIC_CONFIG[selectedMetric];
    return [...data]
      .map(loc => ({
        name: loc.locationName,
        value: loc[config.key] as number,
        locationId: loc.locationId,
      }))
      .sort((a, b) => b.value - a.value); // Sort by value descending
  }, [data, selectedMetric]);

  const maxValue = useMemo(() => {
    return Math.max(...chartData.map(d => d.value), 1);
  }, [chartData]);

  const formatValue = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            Location Performance
          </h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading insights...
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            Location Performance
          </h2>
        </div>
        <div className="h-80 flex items-center justify-center flex-col gap-2">
          <svg className="w-12 h-12 opacity-50" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No location data available</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Configure GBP locations in settings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
          Location Performance
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Toggle Buttons */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--border-subtle)' }}
          >
            {(Object.keys(METRIC_CONFIG) as MetricType[]).map((metric) => (
              <button
                key={metric}
                onClick={() => setSelectedMetric(metric)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: selectedMetric === metric ? 'var(--christmas-green)' : 'transparent',
                  color: selectedMetric === metric ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                }}
              >
                {METRIC_CONFIG[metric].label}
              </button>
            ))}
          </div>

          {/* Period Selector */}
          {onPeriodChange && (
            <select
              value={period}
              onChange={(e) => onPeriodChange(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              {PERIODS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis
              type="number"
              domain={[0, maxValue]}
              tickFormatter={formatValue}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--border-subtle)' }}
              tickLine={{ stroke: 'var(--border-subtle)' }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null;
                const item = payload[0].payload;
                return (
                  <div
                    className="rounded-lg px-3 py-2 shadow-lg"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <p className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
                      {item.name}
                    </p>
                    <p className="text-lg font-bold" style={{ color: METRIC_CONFIG[selectedMetric].color }}>
                      {formatValue(item.value)}
                      <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>
                        {METRIC_CONFIG[selectedMetric].label.toLowerCase()}
                      </span>
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              maxBarSize={32}
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

      {/* Legend / Summary */}
      <div
        className="mt-4 pt-4 flex items-center justify-between text-xs"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <span style={{ color: 'var(--text-muted)' }}>
          {data.length} locations &bull; Last {period === '7d' ? '7' : period === '30d' ? '30' : '90'} days
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          Total: {formatValue(chartData.reduce((sum, d) => sum + d.value, 0))} {METRIC_CONFIG[selectedMetric].label.toLowerCase()}
        </span>
      </div>
    </div>
  );
}

export default LocationComparisonChart;
