'use client';

import { useState, useEffect, useCallback } from 'react';
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
  pageviews: number;
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

// Stat card component
function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  isLoading,
  format = 'number',
}: {
  title: string;
  value: number;
  change?: string;
  changeLabel?: string;
  icon: React.ReactNode;
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

  return (
    <div
      className="rounded-xl p-5 transition-colors"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'var(--christmas-green)', opacity: 0.9 }}
        >
          {icon}
        </div>
        {change && !isLoading && (
          <span
            className="text-xs font-medium px-2 py-1 rounded-full"
            style={{
              backgroundColor: change.startsWith('+') ? 'rgba(93, 138, 102, 0.2)' : 'rgba(139, 45, 50, 0.2)',
              color: change.startsWith('+') ? 'var(--christmas-green-light)' : '#c97878',
            }}
          >
            {change}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold mb-1" style={{ color: 'var(--christmas-cream)' }}>
        {isLoading ? (
          <span className="inline-block w-16 h-7 rounded animate-pulse" style={{ backgroundColor: 'var(--border-subtle)' }} />
        ) : (
          displayValue
        )}
      </div>
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {title}
      </div>
      {changeLabel && (
        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          {changeLabel}
        </div>
      )}
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

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [period, setPeriod] = useState('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [overview, setOverview] = useState<TrafficOverview | null>(null);
  const [dailyTraffic, setDailyTraffic] = useState<DailyTraffic[]>([]);
  const [sources, setSources] = useState<TrafficSource[]>([]);
  const [pages, setPages] = useState<TopPage[]>([]);
  const [conversions, setConversions] = useState<ConversionEvent[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [trafficRes, sourcesRes, pagesRes, conversionsRes] = await Promise.all([
        fetch(`/api/analytics/traffic?period=${period}`, { credentials: 'include' }),
        fetch(`/api/analytics/sources?period=${period}`, { credentials: 'include' }),
        fetch(`/api/analytics/pages?period=${period}`, { credentials: 'include' }),
        fetch(`/api/analytics/conversions?period=${period}`, { credentials: 'include' }),
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
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const periodLabel = period === '7d' ? '7 days' : period === '30d' ? '30 days' : '90 days';

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
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--christmas-cream)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Sessions"
          value={overview?.current.sessions || 0}
          change={overview ? calcChange(overview.current.sessions, overview.previous.sessions) : undefined}
          changeLabel={`Last ${periodLabel}`}
          isLoading={isLoading}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          }
        />
        <StatCard
          title="Users"
          value={overview?.current.users || 0}
          change={overview ? calcChange(overview.current.users, overview.previous.users) : undefined}
          changeLabel="Unique visitors"
          isLoading={isLoading}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          }
        />
        <StatCard
          title="New Users"
          value={overview?.current.newUsers || 0}
          change={overview ? calcChange(overview.current.newUsers, overview.previous.newUsers) : undefined}
          changeLabel="First-time visitors"
          isLoading={isLoading}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          }
        />
        <StatCard
          title="Pageviews"
          value={overview?.current.pageviews || 0}
          change={overview ? calcChange(overview.current.pageviews, overview.previous.pageviews) : undefined}
          changeLabel="Total page loads"
          isLoading={isLoading}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          title="Engagement Rate"
          value={overview?.current.engagementRate || 0}
          change={overview ? calcChange(overview.current.engagementRate, overview.previous.engagementRate) : undefined}
          changeLabel="Engaged sessions"
          isLoading={isLoading}
          format="percent"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          }
        />
        <StatCard
          title="Avg Session"
          value={overview?.current.avgSessionDuration || 0}
          change={overview ? calcChange(overview.current.avgSessionDuration, overview.previous.avgSessionDuration) : undefined}
          changeLabel="Time on site"
          isLoading={isLoading}
          format="duration"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
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
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Daily Traffic
        </h2>
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
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--christmas-cream)',
                  }}
                  labelFormatter={(label) => formatDate(String(label))}
                />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  stroke="var(--christmas-green)"
                  strokeWidth={2}
                  dot={false}
                  name="Sessions"
                />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="#6B9DB8"
                  strokeWidth={2}
                  dot={false}
                  name="Users"
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
