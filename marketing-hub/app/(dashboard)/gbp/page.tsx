'use client';

import { useState, useEffect, useCallback } from 'react';
import { LocationSummaryTable } from '@/components/LocationSummaryTable';
import type { LocationData } from '@/components/LocationSummaryTable';
import { DailyMetricsChart, DailyDataPoint } from '@/components/DailyMetricsChart';
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

interface DailyInsightsData {
  daily: DailyDataPoint[];
  totals: { views: number; clicks: number; calls: number; directions: number };
  avgPerDay: { views: number; clicks: number; calls: number; directions: number };
  dateRange: { start: string; end: string };
  daysCount: number;
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

function calcChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '--';
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

function StatCard({
  title,
  value,
  change,
  icon,
  isLoading,
}: {
  title: string;
  value: string;
  change?: string;
  changeLabel?: string;
  icon: React.ReactNode;
  isLoading?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 transition-colors"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'var(--christmas-green)', opacity: 0.9 }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium truncate" style={{ color: 'var(--text-muted)' }}>
            {title}
          </div>
          <div className="text-xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {isLoading ? (
              <span className="inline-block w-12 h-6 rounded animate-pulse" style={{ backgroundColor: 'var(--border-subtle)' }} />
            ) : (
              value
            )}
          </div>
        </div>
      </div>
      {change && !isLoading && change !== '--' && (
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: change.startsWith('+') ? 'rgba(93, 138, 102, 0.2)' : 'rgba(139, 45, 50, 0.2)',
              color: change.startsWith('+') ? 'var(--christmas-green-light)' : '#c97878',
            }}
          >
            {change}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            vs last year
          </span>
        </div>
      )}
    </div>
  );
}

export default function GBPPerformancePage() {
  // Initialize with MTD
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    end.setDate(end.getDate() - 3);
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });

  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const [dailyData, setDailyData] = useState<DailyInsightsData | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);

  const [isSyncing, setIsSyncing] = useState(false);
  const [cached, setCached] = useState(false);

  const fetchInsights = useCallback(async (refresh = false) => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      // Pass actual date range for YoY comparison
      const url = `/api/gbp/insights?start=${dateRange.start}&end=${dateRange.end}${refresh ? '&refresh=true' : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch insights');
      }
      const data = await res.json();
      setInsights(data.insights);
      setCached(data.cached || false);
    } catch (err) {
      console.error('Failed to fetch insights:', err);
      setInsightsError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setInsightsLoading(false);
    }
  }, [dateRange]);

  const fetchDailyData = useCallback(async () => {
    setDailyLoading(true);
    try {
      const url = `/api/gbp/insights/daily?start=${dateRange.start}&end=${dateRange.end}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch daily data');
      const data = await res.json();
      setDailyData(data);
    } catch (err) {
      console.error('Failed to fetch daily data:', err);
      setDailyData(null);
    } finally {
      setDailyLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchInsights();
    fetchDailyData();
  }, [fetchInsights, fetchDailyData]);

  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
      await fetchInsights(true);
      await fetchDailyData();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDateChange = (range: DateRange) => {
    setDateRange(range);
  };

  const gbpViewsChange = insights ? calcChange(insights.current.totalViews, insights.previous.totalViews) : '--';
  const mapsViewsChange = insights ? calcChange(insights.current.viewsMaps, insights.previous.viewsMaps) : '--';
  const searchViewsChange = insights ? calcChange(insights.current.viewsSearch, insights.previous.viewsSearch) : '--';
  const clicksChange = insights ? calcChange(insights.current.websiteClicks, insights.previous.websiteClicks) : '--';
  const callsChange = insights ? calcChange(insights.current.phoneCalls, insights.previous.phoneCalls) : '--';
  const directionsChange = insights ? calcChange(insights.current.directionRequests, insights.previous.directionRequests) : '--';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            GBP Performance
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Google Business Profile insights across all locations
            {cached && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                Cached
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker
            value={dateRange}
            onChange={handleDateChange}
            dataDelay={3}
          />
          <button
            onClick={handleSyncData}
            disabled={isSyncing}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            style={{
              backgroundColor: 'var(--christmas-green)',
              color: 'var(--christmas-cream)',
            }}
          >
            {isSyncing ? (
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
                Sync
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Grid - 3 columns on medium, 6 on large */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          title="Phone Calls"
          value={insights ? formatNumber(insights.current.phoneCalls) : '--'}
          change={callsChange}
          changeLabel="YoY"
          isLoading={insightsLoading}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          }
        />
        <StatCard
          title="Total Views"
          value={insights ? formatNumber(insights.current.totalViews) : '--'}
          change={gbpViewsChange}
          changeLabel="YoY"
          isLoading={insightsLoading}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />
        <StatCard
          title="Maps Views"
          value={insights ? formatNumber(insights.current.viewsMaps) : '--'}
          change={mapsViewsChange}
          changeLabel="YoY"
          isLoading={insightsLoading}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          title="Search Views"
          value={insights ? formatNumber(insights.current.viewsSearch) : '--'}
          change={searchViewsChange}
          changeLabel="YoY"
          isLoading={insightsLoading}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />
        <StatCard
          title="Website Clicks"
          value={insights ? formatNumber(insights.current.websiteClicks) : '--'}
          change={clicksChange}
          changeLabel="YoY"
          isLoading={insightsLoading}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          }
        />
        <StatCard
          title="Directions"
          value={insights ? formatNumber(insights.current.directionRequests) : '--'}
          change={directionsChange}
          changeLabel="YoY"
          isLoading={insightsLoading}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          }
        />
      </div>

      {/* Two-column layout for Chart and Table on large screens */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr,auto] gap-6 items-stretch">
        {/* Daily Metrics Chart */}
        <DailyMetricsChart
          data={dailyData?.daily || []}
          totals={dailyData?.totals || { views: 0, clicks: 0, calls: 0, directions: 0 }}
          avgPerDay={dailyData?.avgPerDay || { views: 0, clicks: 0, calls: 0, directions: 0 }}
          isLoading={dailyLoading}
          title="Daily Performance"
        />

        {/* Location Summary Table */}
        {insightsError ? (
          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              Location Summary
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
          <LocationSummaryTable
            data={insights?.byLocation || []}
            isLoading={insightsLoading}
          />
        )}
      </div>
    </div>
  );
}
