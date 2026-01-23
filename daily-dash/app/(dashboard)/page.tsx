'use client';

import { useState, useEffect } from 'react';

interface PacingData {
  todayRevenue: number;
  dailyTarget: number;
  wtdRevenue: number;
  weeklyTarget: number;
  mtdRevenue: number;
  monthlyTarget: number;
  qtdRevenue: number;
  quarterlyTarget: number;
  quarter: number;
  pacingPercent: number;
  businessDaysRemaining: number;
  businessDaysElapsed: number;
  businessDaysInMonth: number;
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

function formatCurrency(value: number): string {
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

// Revenue Card Component
interface RevenueCardProps {
  label: string;
  revenue: number;
  target: number;
  loading?: boolean;
  accentColor: 'green' | 'blue' | 'gold' | 'purple';
}

function RevenueCard({ label, revenue, target, loading, accentColor }: RevenueCardProps) {
  const percentage = target > 0 ? Math.round((revenue / target) * 100) : 0;
  const statusColor = getStatusColor(percentage);

  const accentColors = {
    green: { border: 'rgba(52, 102, 67, 0.3)' },
    blue: { border: 'rgba(59, 130, 246, 0.3)' },
    gold: { border: 'rgba(184, 149, 107, 0.3)' },
    purple: { border: 'rgba(139, 92, 246, 0.3)' },
  };

  const colors = accentColors[accentColor];

  return (
    <div
      className="relative p-5 rounded-xl transition-all hover:scale-[1.02]"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: `1px solid ${colors.border}`,
      }}
    >
      {/* Percentage Badge */}
      <div
        className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-bold"
        style={{
          backgroundColor: `${statusColor}20`,
          color: statusColor,
        }}
      >
        {loading ? '...' : `${percentage}%`}
      </div>

      {/* Label */}
      <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>

      {/* Revenue */}
      <p className="text-2xl font-bold mb-1" style={{ color: 'var(--christmas-cream)' }}>
        {loading ? '...' : formatCurrency(revenue)}
      </p>

      {/* Target */}
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        of {formatCurrency(target)} target
      </p>

      {/* Progress Bar */}
      <div
        className="mt-4 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(percentage, 100)}%`,
            backgroundColor: statusColor,
          }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [currentDate, setCurrentDate] = useState('');
  const [selectedDate, setSelectedDate] = useState(getYesterdayDateString());
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

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
        await fetchData();
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

    fetchData();

    const interval = setInterval(fetchData, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  // Use real data from API, with fallback defaults
  const pacing = dashData?.pacing;
  const todayRevenue = pacing?.todayRevenue || 0;
  const dailyTarget = pacing?.dailyTarget || 38864;
  const weekRevenue = pacing?.wtdRevenue || 0;
  const weeklyTarget = pacing?.weeklyTarget || 194318;
  const mtdRevenue = pacing?.mtdRevenue || 0;
  const monthlyTarget = pacing?.monthlyTarget || 855000;
  const qtdRevenue = pacing?.qtdRevenue || 0;
  const quarterlyTarget = pacing?.quarterlyTarget || 2565000;
  const currentQuarter = pacing?.quarter || Math.floor((new Date().getMonth()) / 3) + 1;

  // Extract department summary data from API response
  const getDepartmentSummary = () => {
    if (!dashData?.departments) return [];

    return Object.entries(departmentConfig).map(([slug, config]) => {
      const dept = dashData.departments?.find(d => d.slug === slug);
      if (!dept) {
        return { name: config.label, today: 0, mtd: 0, target: 0, pacing: 0 };
      }

      const primaryKpi = dept.kpis.find(k => k.slug === config.revenueKpi);
      const todayValue = primaryKpi?.actual || 0;
      const targetValue = primaryKpi?.target || 0;
      const pacingValue = primaryKpi?.percent_to_goal || 0;

      return {
        name: config.label,
        today: todayValue,
        mtd: 0,
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

      {/* Revenue Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <RevenueCard
          label="Today"
          revenue={todayRevenue}
          target={dailyTarget}
          loading={loading}
          accentColor="green"
        />
        <RevenueCard
          label="This Week"
          revenue={weekRevenue}
          target={weeklyTarget}
          loading={loading}
          accentColor="blue"
        />
        <RevenueCard
          label="This Month"
          revenue={mtdRevenue}
          target={monthlyTarget}
          loading={loading}
          accentColor="gold"
        />
        <RevenueCard
          label={`Q${currentQuarter}`}
          revenue={qtdRevenue}
          target={quarterlyTarget}
          loading={loading}
          accentColor="purple"
        />
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
