'use client';

import { useState, useEffect } from 'react';
import SummaryCard from '@/components/dash/SummaryCard';
import PacingSection from '@/components/dash/PacingSection';

interface PacingData {
  todayRevenue: number;
  dailyTarget: number;
  wtdRevenue: number;
  weeklyTarget: number;
  mtdRevenue: number;
  monthlyTarget: number;
  pacingPercent: number;
  businessDaysRemaining: number;
  businessDaysElapsed: number;
  businessDaysInMonth: number;
}

interface SyncStatus {
  month: string;
  dataCompleteness: {
    expectedDays: number;
    actualDays: number;
    missingDays: number;
    completenessPercent: number;
    missingDates: string[];
    hasMoreMissing: boolean;
  };
  lastSync: {
    startedAt: string;
    completedAt: string;
    status: string;
    type: string;
  } | null;
  isDataComplete: boolean;
}

interface KPIData {
  slug: string;
  name: string;
  actual: number | null;
  target: number | null;
  percent_to_goal: number | null;
}

interface DepartmentData {
  name: string;
  slug: string;
  kpis: KPIData[];
}

interface DashboardData {
  date: string;
  pacing?: PacingData;
  departments?: DepartmentData[];
}

// Map department slugs to their primary revenue/metric KPI
const departmentConfig: Record<string, { revenueKpi: string; label: string }> = {
  'hvac-service': { revenueKpi: 'service-jobs-completed', label: 'HVAC Service' },
  'hvac-install': { revenueKpi: 'install-revenue', label: 'HVAC Install' },
  'plumbing': { revenueKpi: 'plumbing-revenue', label: 'Plumbing' },
  'call-center': { revenueKpi: 'calls-booked-inbound', label: 'Call Center' },
  'marketing': { revenueKpi: 'leads', label: 'Marketing' },
};

function formatCurrency(value: number, abbreviated: boolean = false): string {
  if (abbreviated) {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${Math.round(value / 1000)}K`;
    }
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function getStatusColor(pacing: number): string {
  if (pacing >= 100) return 'var(--christmas-green)';
  if (pacing >= 90) return '#3B82F6';
  if (pacing >= 75) return 'var(--christmas-gold)';
  return '#EF4444';
}

function StatusDot({ pacing }: { pacing: number }) {
  const color = getStatusColor(pacing);
  return (
    <div
      className="w-3 h-3 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

// Helper to get yesterday's date in YYYY-MM-DD format
function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export default function DashboardPage() {
  const [currentDate, setCurrentDate] = useState('');
  const [selectedDate, setSelectedDate] = useState(getYesterdayDateString()); // Default to yesterday
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [showBackfillModal, setShowBackfillModal] = useState(false);

  // Fetch dashboard data
  const fetchData = async () => {
    try {
      const res = await fetch(`/api/huddle?date=${selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        setDashData(data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch sync status
  const fetchSyncStatus = async () => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const res = await fetch(`/api/huddle/sync-status?month=${currentMonth}`);
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch sync status:', err);
    }
  };

  // Run backfill
  const handleBackfill = async () => {
    setIsBackfilling(true);
    setShowBackfillModal(false);
    try {
      const currentMonth = new Date();
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
        .toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const endDate = yesterday.toISOString().split('T')[0];

      const res = await fetch('/api/huddle/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, skipExisting: true }),
      });

      if (res.ok) {
        const result = await res.json();
        console.log('Backfill completed:', result);
        // Refresh data after backfill
        await fetchData();
        await fetchSyncStatus();
      }
    } catch (err) {
      console.error('Backfill error:', err);
    } finally {
      setIsBackfilling(false);
    }
  };

  // Sync data from ServiceTitan
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/huddle/snapshots/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      });
      if (res.ok) {
        setLastSync(new Date().toLocaleTimeString());
        await fetchData(); // Refresh data after sync
        await fetchSyncStatus(); // Refresh sync status
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    setCurrentDate(now.toLocaleDateString('en-US', options));

    // Initial fetch
    fetchData();
    fetchSyncStatus();

    // Auto-refresh every 10 minutes
    const interval = setInterval(() => {
      fetchData();
      fetchSyncStatus();
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  // Use real data from API, with fallback defaults
  const pacing = dashData?.pacing;
  const todayRevenue = pacing?.todayRevenue || 0;
  const dailyTarget = pacing?.dailyTarget || 36368;
  const weekRevenue = pacing?.wtdRevenue || 0;
  const weeklyTarget = pacing?.weeklyTarget || 181840;
  const mtdRevenue = pacing?.mtdRevenue || 0;
  const monthlyTarget = pacing?.monthlyTarget || 800096;
  const monthlyProgress = pacing?.pacingPercent || 0;

  // Extract department summary data from API response
  const getDepartmentSummary = () => {
    if (!dashData?.departments) return [];

    return Object.entries(departmentConfig).map(([slug, config]) => {
      const dept = dashData.departments?.find(d => d.slug === slug);
      if (!dept) {
        return { name: config.label, today: 0, mtd: 0, target: 0, pacing: 0 };
      }

      // Find the primary KPI for this department
      const primaryKpi = dept.kpis.find(k => k.slug === config.revenueKpi);
      const todayValue = primaryKpi?.actual || 0;
      const targetValue = primaryKpi?.target || 0;
      const pacingValue = primaryKpi?.percent_to_goal || 0;

      return {
        name: config.label,
        today: todayValue,
        mtd: 0, // TODO: Calculate MTD from historical data
        target: targetValue,
        pacing: Math.round(pacingValue),
      };
    });
  };

  const departmentSummary = getDepartmentSummary();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--christmas-cream)' }}
          >
            Christmas Air
          </h1>
          <p className="text-lg mt-1" style={{ color: 'var(--text-secondary)' }}>
            Daily Huddle Dashboard
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Date Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDate(getYesterdayDateString())}
              className="px-3 py-1.5 text-sm rounded-lg transition-colors"
              style={{
                backgroundColor: selectedDate === getYesterdayDateString() ? 'var(--christmas-green)' : 'var(--bg-card)',
                color: selectedDate === getYesterdayDateString() ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              Yesterday
            </button>
            <button
              onClick={() => setSelectedDate(getTodayDateString())}
              className="px-3 py-1.5 text-sm rounded-lg transition-colors"
              style={{
                backgroundColor: selectedDate === getTodayDateString() ? 'var(--christmas-green)' : 'var(--bg-card)',
                color: selectedDate === getTodayDateString() ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              Today
            </button>
          </div>

          {/* Sync Status */}
          {lastSync && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Synced: {lastSync}
            </span>
          )}

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--christmas-gold)',
              color: 'var(--bg-primary)',
              opacity: isSyncing ? 0.7 : 1,
            }}
          >
            <svg
              className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>

          {/* Date Display */}
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="var(--text-secondary)"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
              {currentDate}
            </span>
          </div>
        </div>
      </div>

      {/* Data Completeness Warning */}
      {syncStatus && !syncStatus.isDataComplete && (
        <div
          className="mb-6 p-4 rounded-lg flex items-center justify-between"
          style={{
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
          }}
        >
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="#EAB308"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="font-medium" style={{ color: '#EAB308' }}>
                MTD data incomplete ({syncStatus.dataCompleteness.completenessPercent}%)
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Missing {syncStatus.dataCompleteness.missingDays} day(s): {syncStatus.dataCompleteness.missingDates.join(', ')}
                {syncStatus.dataCompleteness.hasMoreMissing && '...'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowBackfillModal(true)}
            disabled={isBackfilling}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'rgba(234, 179, 8, 0.2)',
              color: '#EAB308',
              border: '1px solid rgba(234, 179, 8, 0.3)',
            }}
          >
            {isBackfilling ? 'Backfilling...' : 'Backfill Data'}
          </button>
        </div>
      )}

      {/* Backfill Confirmation Modal */}
      {showBackfillModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="p-6 rounded-xl max-w-md"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              Backfill Missing Data?
            </h3>
            <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
              This will sync {syncStatus?.dataCompleteness.missingDays} missing day(s) from ServiceTitan.
              This may take a few minutes.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowBackfillModal(false)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBackfill}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  backgroundColor: 'var(--christmas-green)',
                  color: 'var(--christmas-cream)',
                }}
              >
                Start Backfill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Status Indicator */}
      {syncStatus?.lastSync && (
        <div
          className="mb-4 flex items-center gap-2 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: syncStatus.lastSync.status === 'completed'
                ? 'var(--christmas-green)'
                : '#EAB308',
            }}
          />
          <span>
            Last auto-sync: {new Date(syncStatus.lastSync.completedAt).toLocaleString()}
            {' '}({syncStatus.dataCompleteness.completenessPercent}% complete)
          </span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <SummaryCard
          icon="dollar"
          label="Today's Revenue"
          value={loading ? '...' : formatCurrency(todayRevenue)}
          subValue={`of ${formatCurrency(dailyTarget)}`}
          trend={todayRevenue > dailyTarget ? { direction: 'up', value: `+${Math.round(((todayRevenue / dailyTarget) - 1) * 100)}%` } : undefined}
          accentColor="green"
        />
        <SummaryCard
          icon="percent"
          label="Monthly Progress"
          value={loading ? '...' : `${monthlyProgress}%`}
          subValue={`of ${formatCurrency(monthlyTarget)}`}
          accentColor="gold"
        />
        <SummaryCard
          icon="trend"
          label="This Week"
          value={loading ? '...' : formatCurrency(weekRevenue)}
          subValue={`of ${formatCurrency(weeklyTarget)}`}
          trend={weekRevenue > weeklyTarget * 0.5 ? { direction: 'up', value: `${Math.round((weekRevenue / weeklyTarget) * 100)}%` } : undefined}
          accentColor="blue"
        />
      </div>

      {/* Goal Pacing Section */}
      <div className="mb-8">
        <PacingSection data={{
          today: { current: todayRevenue, target: dailyTarget },
          week: { current: weekRevenue, target: weeklyTarget },
          month: { current: mtdRevenue, target: monthlyTarget },
          year: { current: mtdRevenue, target: 15100000 }, // Annual target
        }} />
      </div>

      {/* Department Summary */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Section Header */}
        <div
          className="flex items-center gap-3 p-5 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(184, 149, 107, 0.2)' }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="var(--christmas-gold)"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            Department Summary
          </h3>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                <th
                  className="text-left text-xs font-semibold uppercase tracking-wider px-5 py-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Department
                </th>
                <th
                  className="text-right text-xs font-semibold uppercase tracking-wider px-5 py-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Today
                </th>
                <th
                  className="text-right text-xs font-semibold uppercase tracking-wider px-5 py-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  MTD
                </th>
                <th
                  className="text-right text-xs font-semibold uppercase tracking-wider px-5 py-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Pacing
                </th>
                <th
                  className="text-center text-xs font-semibold uppercase tracking-wider px-5 py-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {departmentSummary.map((dept, index) => (
                <tr
                  key={dept.name}
                  className="transition-colors hover:bg-opacity-50"
                  style={{
                    borderBottom:
                      index < departmentSummary.length - 1
                        ? '1px solid var(--border-subtle)'
                        : 'none',
                  }}
                >
                  <td className="px-5 py-4">
                    <span
                      className="font-medium"
                      style={{ color: 'var(--christmas-cream)' }}
                    >
                      {dept.name}
                    </span>
                  </td>
                  <td
                    className="text-right px-5 py-4"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {dept.today >= 1000
                      ? formatCurrency(dept.today)
                      : dept.today.toLocaleString()}
                  </td>
                  <td
                    className="text-right px-5 py-4"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {formatCurrency(dept.mtd)}
                  </td>
                  <td
                    className="text-right px-5 py-4 font-semibold"
                    style={{ color: getStatusColor(dept.pacing) }}
                  >
                    {dept.pacing}%
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-center">
                      <StatusDot pacing={dept.pacing} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
