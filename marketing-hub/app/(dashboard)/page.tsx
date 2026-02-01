'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { LocationComparisonChart, LocationData } from '@/components/LocationComparisonChart';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';

interface InsightsData {
  period: { start: string; end: string };
  previousPeriod: { start: string; end: string };
  current: {
    totalViews: number;
    viewsMaps: number;
    viewsSearch: number;
    websiteClicks: number;
    phoneCalls: number;
    directionRequests: number;
  };
  previous: {
    totalViews: number;
    viewsMaps: number;
    viewsSearch: number;
    websiteClicks: number;
    phoneCalls: number;
    directionRequests: number;
  };
  byLocation: LocationData[];
}

interface TaskDue {
  id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  status: string;
}

interface RecentActivity {
  id: string;
  type: 'post' | 'review' | 'task';
  description: string;
  time: string;
}

// Format number with K/M suffix
function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
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

// Stat card component
function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  href,
  isLoading,
}: {
  title: string;
  value: string;
  change?: string;
  changeLabel?: string;
  icon: React.ReactNode;
  href?: string;
  isLoading?: boolean;
}) {
  const content = (
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
          value
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

  if (href) {
    return (
      <Link href={href} className="block hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}

// Category badge colors
const CATEGORY_COLORS: Record<string, string> = {
  social: '#6B9DB8',
  gbp: 'var(--christmas-green)',
  reviews: '#B8956B',
  reporting: '#9B6BB8',
  other: 'var(--text-muted)',
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [tasksDue, setTasksDue] = useState<TaskDue[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    // Default to Month to Date
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch GBP insights
  const fetchInsights = useCallback(async (refresh = false) => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const url = `/api/gbp/insights?startDate=${dateRange.start}&endDate=${dateRange.end}${refresh ? '&refresh=true' : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch insights');
      }
      const data = await res.json();
      setInsights(data.insights);
    } catch (err) {
      console.error('Failed to fetch insights:', err);
      setInsightsError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setInsightsLoading(false);
    }
  }, [dateRange]);

  // Fetch tasks due today
  const fetchTasksDue = useCallback(async () => {
    setTasksLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/tasks?due_date=${today}&status=pending`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setTasksDue(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  // Fetch recent activity (posts published)
  const fetchRecentActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/gbp/posts?limit=5', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const activities: RecentActivity[] = (data.posts || [])
          .filter((p: { status: string }) => p.status === 'published')
          .slice(0, 3)
          .map((p: { id: string; summary: string; updated_at: string }) => ({
            id: p.id,
            type: 'post' as const,
            description: `Post published: "${p.summary.slice(0, 40)}${p.summary.length > 40 ? '...' : ''}"`,
            time: formatRelativeTime(new Date(p.updated_at)),
          }));
        setRecentActivity(activities);
      }
    } catch (err) {
      console.error('Failed to fetch recent activity:', err);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchInsights();
    fetchTasksDue();
    fetchRecentActivity();
  }, [fetchInsights, fetchTasksDue, fetchRecentActivity]);

  // Refetch insights when date range changes
  useEffect(() => {
    fetchInsights();
  }, [dateRange, fetchInsights]);

  // Sync all data
  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
      await fetchInsights(true);
      await fetchTasksDue();
      await fetchRecentActivity();
    } finally {
      setIsSyncing(false);
    }
  };

  // Format relative time
  function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  // Calculate changes for stat cards
  const gbpViewsChange = insights
    ? calcChange(insights.current.totalViews, insights.previous.totalViews)
    : '--';
  const clicksChange = insights
    ? calcChange(insights.current.websiteClicks, insights.previous.websiteClicks)
    : '--';
  const callsChange = insights
    ? calcChange(insights.current.phoneCalls, insights.previous.phoneCalls)
    : '--';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Marketing Hub
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Welcome back, {session?.user?.name?.split(' ')[0] || 'there'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            dataDelay={3}
          />
          <button
            onClick={handleSyncData}
            disabled={isSyncing}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: 'var(--christmas-green)',
              color: 'var(--christmas-cream)',
            }}
          >
            {isSyncing ? (
              <>
                <svg className="inline w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing...
              </>
            ) : (
              'Sync Data'
            )}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="GBP Views"
          value={insights ? formatNumber(insights.current.totalViews) : '--'}
          change={gbpViewsChange}
          changeLabel="vs previous period"
          isLoading={insightsLoading}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          title="Website Clicks"
          value={insights ? formatNumber(insights.current.websiteClicks) : '--'}
          change={clicksChange}
          changeLabel="From GBP profiles"
          isLoading={insightsLoading}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          }
        />
        <StatCard
          title="Phone Calls"
          value={insights ? formatNumber(insights.current.phoneCalls) : '--'}
          change={callsChange}
          changeLabel="From GBP profiles"
          isLoading={insightsLoading}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          }
        />
        <StatCard
          title="Tasks Due Today"
          value={tasksLoading ? '--' : tasksDue.length.toString()}
          changeLabel={tasksDue.length === 0 ? 'All caught up!' : 'Click to view'}
          isLoading={tasksLoading}
          href="/tasks"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
        />
      </div>

      {/* Location Performance Chart */}
      {insightsError ? (
        <div
          className="rounded-xl p-5"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Location Performance
          </h2>
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="#c97878" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm" style={{ color: '#c97878' }}>{insightsError}</p>
            <button
              onClick={() => fetchInsights(true)}
              className="mt-3 px-4 py-2 text-sm rounded-lg"
              style={{
                backgroundColor: 'var(--christmas-green)',
                color: 'var(--christmas-cream)',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <LocationComparisonChart
          data={insights?.byLocation || []}
          isLoading={insightsLoading}
        />
      )}

      {/* Bottom Grid: Recent Activity + Tasks Due */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div
          className="rounded-xl p-5"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Recent Activity
          </h2>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">No recent activity</p>
              <Link
                href="/posts/new"
                className="text-xs mt-1 inline-block"
                style={{ color: 'var(--christmas-green-light)' }}
              >
                Create a GBP post
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-input)' }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: 'var(--christmas-green)', opacity: 0.9 }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: 'var(--christmas-cream)' }}>
                      {activity.description}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks Due */}
        <div
          className="rounded-xl p-5"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              Tasks Due Today
            </h2>
            <Link
              href="/tasks"
              className="text-sm"
              style={{ color: 'var(--christmas-green-light)' }}
            >
              View all
            </Link>
          </div>
          {tasksLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 rounded-lg animate-pulse"
                  style={{ backgroundColor: 'var(--border-subtle)' }}
                />
              ))}
            </div>
          ) : tasksDue.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">No tasks due today</p>
              <Link
                href="/tasks"
                className="text-xs mt-1 inline-block"
                style={{ color: 'var(--christmas-green-light)' }}
              >
                View all tasks
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {tasksDue.slice(0, 5).map((task) => (
                <Link
                  key={task.id}
                  href="/tasks"
                  className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:opacity-90"
                  style={{ backgroundColor: 'var(--bg-input)' }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[task.category || 'other'] }}
                  />
                  <span className="text-sm flex-1 truncate" style={{ color: 'var(--christmas-cream)' }}>
                    {task.title}
                  </span>
                  {task.category && (
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: `${CATEGORY_COLORS[task.category]}20`,
                        color: CATEGORY_COLORS[task.category],
                      }}
                    >
                      {task.category}
                    </span>
                  )}
                </Link>
              ))}
              {tasksDue.length > 5 && (
                <Link
                  href="/tasks"
                  className="block text-center text-xs py-2"
                  style={{ color: 'var(--christmas-green-light)' }}
                >
                  +{tasksDue.length - 5} more tasks
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
