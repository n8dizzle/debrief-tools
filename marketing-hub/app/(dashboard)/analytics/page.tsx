'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { DateRangePicker, DateRange } from '@christmas-air/shared/components';

interface TrafficOverview {
  period: { start: string; end: string };
  previousPeriod: { start: string; end: string };
  current: {
    sessions: number;
    users: number;
    newUsers: number;
    pageviews: number;
    bounceRate: number;
    avgSessionDuration: number;
    engagementRate: number;
  };
  previous: {
    sessions: number;
    users: number;
    newUsers: number;
    pageviews: number;
    bounceRate: number;
    avgSessionDuration: number;
    engagementRate: number;
  };
}

interface DailyTraffic {
  date: string;
  sessions: number;
  users: number;
  newUsers: number;
  pageviews: number;
  engagementRate: number;
  avgSessionDuration: number;
}

interface TrafficSource {
  source: string;
  medium: string;
  sessions: number;
  users: number;
  newUsers: number;
  bounceRate: number;
  engagementRate: number;
}

interface TopPage {
  pagePath: string;
  pageTitle: string;
  pageviews: number;
  uniquePageviews: number;
  avgTimeOnPage: number;
  bounceRate: number;
}

interface ConversionEvent {
  eventName: string;
  eventCount: number;
  totalUsers: number;
}

// Format number with K/M suffix
function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

// Calculate percentage change
function calcChange(current: number, previous: number): string {
  if (previous === 0) {
    return current > 0 ? '+100%' : '--';
  }
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

// Format duration in seconds to readable string
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

// Format date for display
function formatDate(dateStr: string): string {
  // Handle YYYYMMDD format
  if (dateStr.length === 8 && !dateStr.includes('-')) {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    dateStr = `${year}-${month}-${day}`;
  }
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Stat card component - cleaner horizontal layout
function StatCard({
  title,
  value,
  change,
  isLoading,
  format = 'number',
}: {
  title: string;
  value: number;
  change?: string;
  isLoading?: boolean;
  format?: 'number' | 'percent' | 'duration';
}) {
  let displayValue = '--';
  if (!isLoading) {
    if (format === 'percent') {
      displayValue = `${(value * 100).toFixed(1)}%`;
    } else if (format === 'duration') {
      displayValue = formatDuration(value);
    } else {
      displayValue = formatNumber(value);
    }
  }

  const isPositive = change?.startsWith('+');
  const isNegative = change?.startsWith('-');

  return (
    <div
      className="rounded-xl p-3 lg:p-4"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="text-[10px] lg:text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
        {title}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-xl lg:text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          {isLoading ? (
            <span className="inline-block w-12 h-6 rounded animate-pulse" style={{ backgroundColor: 'var(--border-subtle)' }} />
          ) : (
            displayValue
          )}
        </div>
        {change && !isLoading && (
          <span
            className="text-xs font-medium"
            style={{
              color: isPositive ? 'var(--christmas-green-light)' : isNegative ? '#c97878' : 'var(--text-muted)',
            }}
          >
            {change}
          </span>
        )}
      </div>
      <div className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>
        vs last year
      </div>
    </div>
  );
}

// Source/Medium color palette
const SOURCE_COLORS = [
  'var(--christmas-green)',
  '#6B9DB8',
  '#B8956B',
  '#9B6BB8',
  '#6BB89B',
  '#B86B6B',
  '#B8B86B',
  '#6B6BB8',
];

// Metric configuration for daily traffic chart toggle
type MetricKey = 'sessions' | 'users' | 'newUsers' | 'pageviews' | 'engagementRate' | 'avgSessionDuration';

interface MetricConfig {
  key: MetricKey;
  label: string;
  color: string;
  formatValue: (value: number) => string;
}

const METRIC_CONFIG: MetricConfig[] = [
  {
    key: 'sessions',
    label: 'Sessions',
    color: 'var(--christmas-green)',
    formatValue: (v) => v.toLocaleString(),
  },
  {
    key: 'users',
    label: 'Users',
    color: '#6B9DB8',
    formatValue: (v) => v.toLocaleString(),
  },
  {
    key: 'newUsers',
    label: 'New Users',
    color: '#9B6BB8',
    formatValue: (v) => v.toLocaleString(),
  },
  {
    key: 'pageviews',
    label: 'Pageviews',
    color: '#B8956B',
    formatValue: (v) => v.toLocaleString(),
  },
  {
    key: 'engagementRate',
    label: 'Engagement Rate',
    color: '#6BB89B',
    formatValue: (v) => `${(v * 100).toFixed(1)}%`,
  },
  {
    key: 'avgSessionDuration',
    label: 'Avg Duration',
    color: '#B86B6B',
    formatValue: (v) => formatDuration(v),
  },
];

// Helper to get default date range (last 30 days)
function getDefaultDateRange(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('sessions');

  // Data states
  const [overview, setOverview] = useState<TrafficOverview | null>(null);
  const [dailyTraffic, setDailyTraffic] = useState<DailyTraffic[]>([]);
  const [sources, setSources] = useState<TrafficSource[]>([]);
  const [pages, setPages] = useState<TopPage[]>([]);
  const [conversions, setConversions] = useState<ConversionEvent[]>([]);

  // Get selected metric config
  const currentMetric = useMemo(
    () => METRIC_CONFIG.find((m) => m.key === selectedMetric) || METRIC_CONFIG[0],
    [selectedMetric]
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = `start=${dateRange.start}&end=${dateRange.end}`;

    try {
      const [trafficRes, sourcesRes, pagesRes, conversionsRes] = await Promise.all([
        fetch(`/api/analytics/traffic?${params}`, { credentials: 'include' }),
        fetch(`/api/analytics/sources?${params}`, { credentials: 'include' }),
        fetch(`/api/analytics/pages?${params}`, { credentials: 'include' }),
        fetch(`/api/analytics/conversions?${params}`, { credentials: 'include' }),
      ]);

      // Check for errors
      if (!trafficRes.ok) {
        const err = await trafficRes.json();
        throw new Error(err.error || 'Failed to fetch traffic data');
      }

      const trafficData = await trafficRes.json();
      setOverview(trafficData.overview);
      setDailyTraffic(trafficData.dailyTraffic || []);

      if (sourcesRes.ok) {
        const sourcesData = await sourcesRes.json();
        setSources(sourcesData.sources || []);
      }

      if (pagesRes.ok) {
        const pagesData = await pagesRes.json();
        setPages(pagesData.pages || []);
      }

      if (conversionsRes.ok) {
        const conversionsData = await conversionsRes.json();
        setConversions(conversionsData.conversions || []);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle date range change
  const handleDateChange = useCallback((range: DateRange) => {
    setDateRange(range);
  }, []);

  // Calculate days in range for display
  const daysInRange = useMemo(() => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [dateRange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Website Analytics
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            US traffic only &bull; Data from Google Analytics 4
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker
            value={dateRange}
            onChange={handleDateChange}
            dataDelay={0}
          />
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: 'var(--christmas-green)',
              color: 'var(--christmas-cream)',
            }}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          className="rounded-xl p-5"
          style={{
            backgroundColor: 'rgba(139, 45, 50, 0.2)',
            border: '1px solid #c97878',
          }}
        >
          <p className="text-sm" style={{ color: '#c97878' }}>{error}</p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Make sure GA4_REFRESH_TOKEN is configured in your environment variables.
          </p>
        </div>
      )}

      {/* Stats Grid - 6 columns on desktop, 3 on tablet, 2 on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title="Sessions"
          value={overview?.current.sessions || 0}
          change={overview ? calcChange(overview.current.sessions, overview.previous.sessions) : undefined}
          isLoading={isLoading}
        />
        <StatCard
          title="Users"
          value={overview?.current.users || 0}
          change={overview ? calcChange(overview.current.users, overview.previous.users) : undefined}
          isLoading={isLoading}
        />
        <StatCard
          title="New Users"
          value={overview?.current.newUsers || 0}
          change={overview ? calcChange(overview.current.newUsers, overview.previous.newUsers) : undefined}
          isLoading={isLoading}
        />
        <StatCard
          title="Pageviews"
          value={overview?.current.pageviews || 0}
          change={overview ? calcChange(overview.current.pageviews, overview.previous.pageviews) : undefined}
          isLoading={isLoading}
        />
        <StatCard
          title="Engagement"
          value={overview?.current.engagementRate || 0}
          change={overview ? calcChange(overview.current.engagementRate, overview.previous.engagementRate) : undefined}
          isLoading={isLoading}
          format="percent"
        />
        <StatCard
          title="Avg Session"
          value={overview?.current.avgSessionDuration || 0}
          change={overview ? calcChange(overview.current.avgSessionDuration, overview.previous.avgSessionDuration) : undefined}
          isLoading={isLoading}
          format="duration"
        />
      </div>

      {/* Traffic Chart */}
      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            Daily Traffic
          </h2>
          {/* Metric Toggle Buttons */}
          <div className="flex flex-wrap gap-2">
            {METRIC_CONFIG.map((metric) => (
              <button
                key={metric.key}
                onClick={() => setSelectedMetric(metric.key)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                style={{
                  backgroundColor:
                    selectedMetric === metric.key
                      ? metric.color
                      : 'var(--bg-input)',
                  color:
                    selectedMetric === metric.key
                      ? '#fff'
                      : 'var(--text-muted)',
                  border: `1px solid ${
                    selectedMetric === metric.key
                      ? metric.color
                      : 'var(--border-subtle)'
                  }`,
                }}
              >
                {metric.label}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--christmas-green)', borderTopColor: 'transparent' }} />
          </div>
        ) : dailyTraffic.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-center" style={{ color: 'var(--text-muted)' }}>
            <p>No traffic data available for this period</p>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTraffic}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="var(--text-muted)"
                  fontSize={12}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={12}
                  tickFormatter={(value) => currentMetric.formatValue(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--christmas-cream)',
                  }}
                  labelFormatter={(label) => formatDate(String(label))}
                  formatter={(value) => [currentMetric.formatValue(Number(value) || 0), currentMetric.label]}
                />
                <Line
                  type="monotone"
                  dataKey={selectedMetric}
                  stroke={currentMetric.color}
                  strokeWidth={2}
                  dot={false}
                  name={currentMetric.label}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Two Column Layout: Sources + Conversions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic Sources */}
        <div
          className="rounded-xl p-5"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Traffic Sources
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 rounded animate-pulse" style={{ backgroundColor: 'var(--border-subtle)' }} />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              <p>No source data available</p>
            </div>
          ) : (
            <>
              <div className="h-48 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sources.slice(0, 6)} layout="vertical">
                    <XAxis type="number" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis
                      dataKey="source"
                      type="category"
                      stroke="var(--text-muted)"
                      fontSize={11}
                      width={80}
                      tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + '...' : v}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--christmas-cream)',
                      }}
                      formatter={(value) => value?.toLocaleString() ?? '0'}
                    />
                    <Bar dataKey="sessions" name="Sessions">
                      {sources.slice(0, 6).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sources.map((source, idx) => (
                  <div
                    key={`${source.source}-${source.medium}`}
                    className="flex items-center justify-between p-2 rounded"
                    style={{ backgroundColor: 'var(--bg-input)' }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: SOURCE_COLORS[idx % SOURCE_COLORS.length] }}
                      />
                      <span className="text-sm" style={{ color: 'var(--christmas-cream)' }}>
                        {source.source} / {source.medium}
                      </span>
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {source.sessions.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Conversions */}
        <div
          className="rounded-xl p-5"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Conversions
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded animate-pulse" style={{ backgroundColor: 'var(--border-subtle)' }} />
              ))}
            </div>
          ) : conversions.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm mb-2">No conversions tracked yet</p>
              <p className="text-xs">
                Mark events as conversions in GA4 Admin &gt; Events to see them here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {conversions.map((conv) => (
                <div
                  key={conv.eventName}
                  className="flex items-center justify-between p-4 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-input)' }}
                >
                  <div>
                    <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                      {conv.eventName.replace(/_/g, ' ')}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {conv.totalUsers.toLocaleString()} users
                    </div>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--christmas-green-light)' }}>
                    {conv.eventCount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Pages */}
      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Top Pages
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded animate-pulse" style={{ backgroundColor: 'var(--border-subtle)' }} />
            ))}
          </div>
        ) : pages.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            <p>No page data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-left py-3 px-2 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Page</th>
                  <th className="text-right py-3 px-2 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Views</th>
                  <th className="text-right py-3 px-2 text-sm font-medium hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Users</th>
                  <th className="text-right py-3 px-2 text-sm font-medium hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Avg Time</th>
                </tr>
              </thead>
              <tbody>
                {pages.slice(0, 15).map((page, idx) => (
                  <tr
                    key={page.pagePath}
                    style={{ borderBottom: idx < pages.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                  >
                    <td className="py-3 px-2">
                      <div className="text-sm truncate max-w-xs" style={{ color: 'var(--christmas-cream)' }} title={page.pageTitle}>
                        {page.pageTitle || page.pagePath}
                      </div>
                      <div className="text-xs truncate max-w-xs" style={{ color: 'var(--text-muted)' }} title={page.pagePath}>
                        {page.pagePath}
                      </div>
                    </td>
                    <td className="text-right py-3 px-2 text-sm" style={{ color: 'var(--christmas-cream)' }}>
                      {page.pageviews.toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-2 text-sm hidden sm:table-cell" style={{ color: 'var(--text-secondary)' }}>
                      {page.uniquePageviews.toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-2 text-sm hidden md:table-cell" style={{ color: 'var(--text-secondary)' }}>
                      {formatDuration(page.avgTimeOnPage)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
