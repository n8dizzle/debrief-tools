'use client';

import { useState, useEffect } from 'react';

interface PacingData {
  todayRevenue: number;
  todaySales: number;
  dailyTarget: number;
  wtdRevenue: number;
  wtdSales: number;
  weeklyTarget: number;
  mtdRevenue: number;
  mtdSales: number;
  monthlyTarget: number;
  qtdRevenue: number;
  qtdSales: number;
  quarterlyTarget: number;
  quarter: number;
  ytdRevenue: number;
  annualTarget: number;
  expectedAnnualPacingPercent: number; // Seasonal weighted expected YTD %
  pacingPercent: number;
  businessDaysRemaining: number;
  businessDaysElapsed: number;
  businessDaysInMonth: number;
}

// Business hours: Mon-Sat 8am-6pm (10 hours per day)
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 18;
const BUSINESS_HOURS_PER_DAY = BUSINESS_END_HOUR - BUSINESS_START_HOUR; // 10 hours

// Calculate what percentage of the business day has elapsed
function getDailyPacingPercent(): number {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

  // Sunday is not a business day
  if (dayOfWeek === 0) return 0;

  const currentHour = now.getHours() + now.getMinutes() / 60;

  if (currentHour < BUSINESS_START_HOUR) return 0;
  if (currentHour >= BUSINESS_END_HOUR) return 100;

  const hoursElapsed = currentHour - BUSINESS_START_HOUR;
  return Math.round((hoursElapsed / BUSINESS_HOURS_PER_DAY) * 100);
}

// Calculate what percentage of the business week has elapsed (Mon-Sat)
function getWeeklyPacingPercent(): number {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

  // Sunday - week hasn't started yet for business purposes
  if (dayOfWeek === 0) return 0;

  // Mon=1 -> day 1, Tue=2 -> day 2, ..., Sat=6 -> day 6
  const businessDayOfWeek = dayOfWeek;
  const totalBusinessDaysInWeek = 6; // Mon-Sat

  // Calculate partial day progress
  const currentHour = now.getHours() + now.getMinutes() / 60;
  let dayProgress = 0;
  if (currentHour >= BUSINESS_END_HOUR) {
    dayProgress = 1;
  } else if (currentHour >= BUSINESS_START_HOUR) {
    dayProgress = (currentHour - BUSINESS_START_HOUR) / BUSINESS_HOURS_PER_DAY;
  }

  // Days completed + partial current day
  const daysCompleted = businessDayOfWeek - 1;
  const totalProgress = (daysCompleted + dayProgress) / totalBusinessDaysInWeek;

  return Math.round(totalProgress * 100);
}

// Calculate what percentage of the business month has elapsed
function getMonthlyPacingPercent(businessDaysElapsed: number, businessDaysInMonth: number): number {
  if (businessDaysInMonth <= 0) return 0;

  const now = new Date();
  const dayOfWeek = now.getDay();

  // Add partial day progress if it's a business day (Mon-Sat)
  let partialDay = 0;
  if (dayOfWeek >= 1 && dayOfWeek <= 6) {
    const currentHour = now.getHours() + now.getMinutes() / 60;
    if (currentHour >= BUSINESS_END_HOUR) {
      partialDay = 1;
    } else if (currentHour >= BUSINESS_START_HOUR) {
      partialDay = (currentHour - BUSINESS_START_HOUR) / BUSINESS_HOURS_PER_DAY;
    }
  }

  // businessDaysElapsed from API is full days completed, add partial
  const totalElapsed = businessDaysElapsed + partialDay;
  return Math.round((totalElapsed / businessDaysInMonth) * 100);
}

// Calculate what percentage of the business quarter has elapsed
function getQuarterlyPacingPercent(businessDaysElapsed: number, businessDaysInMonth: number, quarter: number): number {
  // Estimate ~22 business days per month, 66 per quarter
  const estimatedBusinessDaysInQuarter = 66;
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const quarterStartMonth = (quarter - 1) * 3 + 1;
  const monthsIntoQuarter = currentMonth - quarterStartMonth;

  // Calculate total business days elapsed in quarter
  // Previous months in quarter (estimate 22 days each) + current month progress
  const previousMonthsDays = monthsIntoQuarter * 22;
  const currentMonthProgress = businessDaysElapsed;

  const now2 = new Date();
  const dayOfWeek = now2.getDay();
  let partialDay = 0;
  if (dayOfWeek >= 1 && dayOfWeek <= 6) {
    const currentHour = now2.getHours() + now2.getMinutes() / 60;
    if (currentHour >= BUSINESS_END_HOUR) {
      partialDay = 1;
    } else if (currentHour >= BUSINESS_START_HOUR) {
      partialDay = (currentHour - BUSINESS_START_HOUR) / BUSINESS_HOURS_PER_DAY;
    }
  }

  const totalElapsed = previousMonthsDays + currentMonthProgress + partialDay;
  return Math.round((totalElapsed / estimatedBusinessDaysInQuarter) * 100);
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

// Helper to get date in YYYY-MM-DD format using local time (not UTC)
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
}

function getTodayDateString(): string {
  return getLocalDateString(new Date());
}

// Format currency in compact form (e.g., $38.9K)
function formatCurrencyCompact(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

// Revenue Card Component
interface RevenueCardProps {
  label: string;
  revenue: number;
  sales?: number; // Optional sales amount
  target: number;
  loading?: boolean;
  accentColor: 'green' | 'blue' | 'gold' | 'purple';
  expectedPacing?: number; // Where we should be based on time elapsed (0-100)
}

function RevenueCard({ label, revenue, sales, target, loading, accentColor, expectedPacing }: RevenueCardProps) {
  const percentage = target > 0 ? Math.round((revenue / target) * 100) : 0;
  const statusColor = getStatusColor(percentage);

  // Determine if we're ahead or behind pace
  const isAheadOfPace = expectedPacing !== undefined && percentage >= expectedPacing;

  const accentColors = {
    green: { border: 'rgba(52, 102, 67, 0.3)' },
    blue: { border: 'rgba(59, 130, 246, 0.3)' },
    gold: { border: 'rgba(184, 149, 107, 0.3)' },
    purple: { border: 'rgba(139, 92, 246, 0.3)' },
  };

  const colors = accentColors[accentColor];
  const hasSales = sales !== undefined && sales > 0;

  return (
    <div
      className="relative p-5 rounded-xl transition-all hover:scale-[1.01]"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: `1px solid ${colors.border}`,
      }}
    >
      {/* Percentage Badge */}
      <div
        className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{
          backgroundColor: `${statusColor}15`,
          color: statusColor,
        }}
      >
        {loading ? '...' : `${percentage}%`}
      </div>

      {/* Label */}
      <p className="text-sm font-medium mb-4 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>

      {/* Revenue / Sales Display */}
      {hasSales ? (
        <>
          {/* Revenue and Sales with vertical divider */}
          <div className="flex items-center mb-4">
            {/* Revenue column */}
            <div className="flex-1">
              <span className="text-2xl font-bold block" style={{ color: 'var(--christmas-cream)' }}>
                {loading ? '...' : formatCurrencyCompact(revenue)}
              </span>
              <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Revenue
              </span>
            </div>
            {/* Vertical divider */}
            <div
              className="w-px h-10 mx-4"
              style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.5 }}
            />
            {/* Sales column */}
            <div className="flex-1">
              <span className="text-2xl font-bold block" style={{ color: 'var(--christmas-gold)' }}>
                {loading ? '...' : formatCurrencyCompact(sales)}
              </span>
              <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Sales
              </span>
            </div>
          </div>
          {/* Horizontal separator */}
          <div
            className="h-px w-full mb-3"
            style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.3 }}
          />
        </>
      ) : (
        /* Original revenue-only display */
        <p className="text-2xl font-bold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          {loading ? '...' : formatCurrency(revenue)}
        </p>
      )}

      {/* Target */}
      <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
        of {formatCurrency(target)} target
      </p>

      {/* Progress Bar with Pacing Marker */}
      <div
        className="relative h-1.5 rounded-full overflow-visible"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        {/* Actual Progress */}
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(percentage, 100)}%`,
            backgroundColor: statusColor,
          }}
        />

        {/* Expected Pacing Marker */}
        {expectedPacing !== undefined && expectedPacing > 0 && !loading && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 transition-all duration-300"
            style={{
              left: `${Math.min(expectedPacing, 100)}%`,
              backgroundColor: 'var(--christmas-cream)',
              opacity: 0.9,
            }}
            title={`Expected: ${expectedPacing}%`}
          />
        )}
      </div>

      {/* Pacing indicator text */}
      {expectedPacing !== undefined && expectedPacing > 0 && !loading && (
        <div className="flex items-center justify-between mt-2">
          <span
            className="text-xs"
            style={{ color: isAheadOfPace ? 'var(--christmas-green)' : '#EF4444' }}
          >
            {isAheadOfPace ? '▲ Ahead of pace' : '▼ Behind pace'}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Expected: {expectedPacing}%
          </span>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [currentDate, setCurrentDate] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
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
  const todaySales = pacing?.todaySales || 0;
  const dailyTarget = pacing?.dailyTarget || 38864;
  const weekRevenue = pacing?.wtdRevenue || 0;
  const weekSales = pacing?.wtdSales || 0;
  const weeklyTarget = pacing?.weeklyTarget || 194318;
  const mtdRevenue = pacing?.mtdRevenue || 0;
  const mtdSales = pacing?.mtdSales || 0;
  const monthlyTarget = pacing?.monthlyTarget || 855000;
  const qtdRevenue = pacing?.qtdRevenue || 0;
  const qtdSales = pacing?.qtdSales || 0;
  const quarterlyTarget = pacing?.quarterlyTarget || 2565000;
  const currentQuarter = pacing?.quarter || Math.floor((new Date().getMonth()) / 3) + 1;
  const ytdRevenue = pacing?.ytdRevenue || 0;
  const annualTarget = pacing?.annualTarget || 10260000; // ~$855K * 12

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
            Christmas Air Conditioning & Plumbing
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <RevenueCard
          label="Today"
          revenue={todayRevenue}
          sales={todaySales}
          target={dailyTarget}
          loading={loading}
          accentColor="green"
          expectedPacing={getDailyPacingPercent()}
        />
        <RevenueCard
          label="This Week"
          revenue={weekRevenue}
          sales={weekSales}
          target={weeklyTarget}
          loading={loading}
          accentColor="blue"
          expectedPacing={getWeeklyPacingPercent()}
        />
        <RevenueCard
          label="This Month"
          revenue={mtdRevenue}
          sales={mtdSales}
          target={monthlyTarget}
          loading={loading}
          accentColor="gold"
          expectedPacing={getMonthlyPacingPercent(
            pacing?.businessDaysElapsed || 0,
            pacing?.businessDaysInMonth || 22
          )}
        />
        <RevenueCard
          label="This Quarter"
          revenue={qtdRevenue}
          sales={qtdSales}
          target={quarterlyTarget}
          loading={loading}
          accentColor="purple"
          expectedPacing={getQuarterlyPacingPercent(
            pacing?.businessDaysElapsed || 0,
            pacing?.businessDaysInMonth || 22,
            currentQuarter
          )}
        />
      </div>

      {/* Annual Revenue Card - Full Width */}
      <div className="mb-8">
        <RevenueCard
          label="This Year"
          revenue={ytdRevenue}
          target={annualTarget}
          loading={loading}
          accentColor="green"
          expectedPacing={pacing?.expectedAnnualPacingPercent || 0}
        />
      </div>

      {/* Department Revenue Sections - 50/50 Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* HVAC Section */}
        <div
          className="p-5 rounded-xl"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="#3B82F6" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              HVAC
            </h3>
          </div>

          {/* HVAC Breakdown: Install, Service, Maintenance */}
          <div className="space-y-3">
            {/* Install */}
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-card)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>Install</p>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3B82F6' }}>
                  0%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Today</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--christmas-cream)' }}>{loading ? '...' : formatCurrency(0)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>MTD</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--christmas-cream)' }}>{loading ? '...' : formatCurrency(0)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Target</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{loading ? '...' : formatCurrency(569000)}</p>
                </div>
              </div>
            </div>

            {/* Service */}
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-card)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>Service</p>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3B82F6' }}>
                  0%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Today</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--christmas-cream)' }}>{loading ? '...' : formatCurrency(0)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>MTD</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--christmas-cream)' }}>{loading ? '...' : formatCurrency(0)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Target</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{loading ? '...' : formatCurrency(124000)}</p>
                </div>
              </div>
            </div>

            {/* Maintenance */}
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-card)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>Maintenance</p>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3B82F6' }}>
                  0%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Today</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--christmas-cream)' }}>{loading ? '...' : formatCurrency(0)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>MTD</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--christmas-cream)' }}>{loading ? '...' : formatCurrency(0)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Target</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{loading ? '...' : formatCurrency(31000)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Plumbing Section */}
        <div
          className="p-5 rounded-xl"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(139, 92, 246, 0.2)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="#8B5CF6" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              Plumbing
            </h3>
          </div>

          {/* Plumbing Breakdown: Service, Maintenance */}
          <div className="space-y-3">
            {/* Service */}
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-card)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>Service</p>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(139, 92, 246, 0.2)', color: '#8B5CF6' }}>
                  0%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Today</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--christmas-cream)' }}>{loading ? '...' : formatCurrency(0)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>MTD</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--christmas-cream)' }}>{loading ? '...' : formatCurrency(0)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Target</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{loading ? '...' : formatCurrency(130000)}</p>
                </div>
              </div>
            </div>

            {/* Maintenance */}
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-card)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>Maintenance</p>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(139, 92, 246, 0.2)', color: '#8B5CF6' }}>
                  0%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Today</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--christmas-cream)' }}>{loading ? '...' : formatCurrency(0)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>MTD</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--christmas-cream)' }}>{loading ? '...' : formatCurrency(0)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Target</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{loading ? '...' : formatCurrency(0)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
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
