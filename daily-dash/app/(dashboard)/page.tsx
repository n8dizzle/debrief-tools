'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

// Client-side cache for dashboard data
const dashboardCache = new Map<string, { data: DashboardData; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minute cache

// Department revenue breakdown
interface DepartmentRevenue {
  revenue: number;
  completedRevenue: number;
  nonJobRevenue: number;
  adjRevenue: number;
}

// Trade metrics for a single time period
interface TradeMetrics {
  revenue: number;
  completedRevenue: number;
  nonJobRevenue: number;
  adjRevenue: number;
  departments?: {
    install: DepartmentRevenue;
    service: DepartmentRevenue;
    maintenance: DepartmentRevenue;
  };
}

// Trade targets
interface HVACTargets {
  daily: number;
  weekly: number;
  monthly: number;
  quarterly: number;
  annual: number;
  departments: {
    install: number;
    service: number;
    maintenance: number;
  };
}

interface PlumbingTargets {
  daily: number;
  weekly: number;
  monthly: number;
  quarterly: number;
  annual: number;
}

// Plumbing metrics (no department breakdown)
interface PlumbingMetrics {
  revenue: number;
  completedRevenue: number;
  nonJobRevenue: number;
  adjRevenue: number;
}

// All trade data across time periods
interface TradeData {
  hvac: {
    today: TradeMetrics;
    wtd: TradeMetrics;
    mtd: TradeMetrics;
    qtd: TradeMetrics;
    ytd: TradeMetrics;
    targets?: HVACTargets;
  };
  plumbing: {
    today: PlumbingMetrics;
    wtd: PlumbingMetrics;
    mtd: PlumbingMetrics;
    qtd: PlumbingMetrics;
    ytd: PlumbingMetrics;
    targets?: PlumbingTargets;
  };
}

// Monthly trend data for chart
interface MonthlyTrendData {
  month: string;
  label: string;
  hvacRevenue: number;
  plumbingRevenue: number;
  totalRevenue: number;
  goal: number;
}

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
  expectedAnnualPacingPercent: number;
  pacingPercent: number;
  businessDaysRemaining: number;
  businessDaysElapsed: number;
  businessDaysInMonth: number;
  trades?: TradeData;
  monthlyTrend?: MonthlyTrendData[];
}

// Business hours: Mon-Sat 8am-6pm (10 hours per day)
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 18;
const BUSINESS_HOURS_PER_DAY = BUSINESS_END_HOUR - BUSINESS_START_HOUR;

function getDailyPacingPercent(): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  if (dayOfWeek === 0) return 0;
  const currentHour = now.getHours() + now.getMinutes() / 60;
  if (currentHour < BUSINESS_START_HOUR) return 0;
  if (currentHour >= BUSINESS_END_HOUR) return 100;
  const hoursElapsed = currentHour - BUSINESS_START_HOUR;
  return Math.round((hoursElapsed / BUSINESS_HOURS_PER_DAY) * 100);
}

function getWeeklyPacingPercent(): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  if (dayOfWeek === 0) return 0;
  const businessDayOfWeek = dayOfWeek;
  const totalBusinessDaysInWeek = 6;
  const currentHour = now.getHours() + now.getMinutes() / 60;
  let dayProgress = 0;
  if (currentHour >= BUSINESS_END_HOUR) {
    dayProgress = 1;
  } else if (currentHour >= BUSINESS_START_HOUR) {
    dayProgress = (currentHour - BUSINESS_START_HOUR) / BUSINESS_HOURS_PER_DAY;
  }
  const daysCompleted = businessDayOfWeek - 1;
  const totalProgress = (daysCompleted + dayProgress) / totalBusinessDaysInWeek;
  return Math.round(totalProgress * 100);
}

function getMonthlyPacingPercent(businessDaysElapsed: number, businessDaysInMonth: number): number {
  if (businessDaysInMonth <= 0) return 0;
  const now = new Date();
  const dayOfWeek = now.getDay();
  let partialDay = 0;
  if (dayOfWeek >= 1 && dayOfWeek <= 6) {
    const currentHour = now.getHours() + now.getMinutes() / 60;
    if (currentHour >= BUSINESS_END_HOUR) {
      partialDay = 1;
    } else if (currentHour >= BUSINESS_START_HOUR) {
      partialDay = (currentHour - BUSINESS_START_HOUR) / BUSINESS_HOURS_PER_DAY;
    }
  }
  const totalElapsed = businessDaysElapsed + partialDay;
  return Math.round((totalElapsed / businessDaysInMonth) * 100);
}

function getQuarterlyPacingPercent(): number {
  const now = new Date();
  const currentMonth = now.getMonth();
  const quarterStartMonth = Math.floor(currentMonth / 3) * 3;

  const quarterStart = new Date(now.getFullYear(), quarterStartMonth, 1);
  const quarterEnd = new Date(now.getFullYear(), quarterStartMonth + 3, 0);

  let businessDaysElapsed = 0;
  let businessDaysInQuarter = 0;
  const current = new Date(quarterStart);

  while (current <= quarterEnd) {
    const dow = current.getDay();
    if (dow >= 1 && dow <= 6) {
      businessDaysInQuarter++;
      if (current < now) {
        businessDaysElapsed++;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  const dayOfWeek = now.getDay();
  let partialDay = 0;
  if (dayOfWeek >= 1 && dayOfWeek <= 6) {
    const currentHour = now.getHours() + now.getMinutes() / 60;
    if (currentHour >= BUSINESS_END_HOUR) {
      partialDay = 1;
    } else if (currentHour >= BUSINESS_START_HOUR) {
      partialDay = (currentHour - BUSINESS_START_HOUR) / BUSINESS_HOURS_PER_DAY;
    }
  }

  return Math.round(((businessDaysElapsed + partialDay) / businessDaysInQuarter) * 100);
}

interface DashboardData {
  date: string;
  pacing?: PacingData;
}

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatCurrencyCompact(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function getStatusColor(pacing: number): string {
  if (pacing >= 100) return 'var(--christmas-green)';
  if (pacing >= 90) return '#3B82F6';
  if (pacing >= 75) return 'var(--christmas-gold)';
  return '#EF4444';
}

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

// ============================================
// ANNUAL BANNER COMPONENT
// ============================================
interface AnnualBannerProps {
  revenue: number;
  target: number;
  expectedPercent: number;
  loading?: boolean;
}

function AnnualBanner({ revenue, target, expectedPercent, loading }: AnnualBannerProps) {
  const percentage = target > 0 ? Math.round((revenue / target) * 100) : 0;
  const isAheadOfPace = percentage >= expectedPercent;
  const statusColor = getStatusColor(percentage);
  const year = new Date().getFullYear();

  return (
    <div
      className="p-3 sm:p-4 rounded-xl mb-6"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid rgba(52, 102, 67, 0.3)',
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {year} Annual Progress
        </h2>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-base sm:text-lg font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {loading ? '...' : formatCurrencyCompact(revenue)} / {formatCurrencyCompact(target)}
          </span>
          <span
            className="text-sm font-semibold px-2 py-0.5 rounded"
            style={{
              backgroundColor: `${statusColor}15`,
              color: statusColor,
            }}
          >
            {loading ? '...' : `${percentage}%`}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="relative h-2 rounded-full overflow-visible mb-2"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(percentage, 100)}%`,
            backgroundColor: statusColor,
          }}
        />
        {expectedPercent > 0 && !loading && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 transition-all duration-300"
            style={{
              left: `${Math.min(expectedPercent, 100)}%`,
              backgroundColor: 'var(--christmas-cream)',
              opacity: 0.9,
            }}
          />
        )}
      </div>

      {/* Pacing indicator */}
      {expectedPercent > 0 && !loading && (
        <div className="flex items-center justify-end gap-2">
          <span
            className="text-xs"
            style={{ color: isAheadOfPace ? 'var(--christmas-green)' : '#EF4444' }}
          >
            {isAheadOfPace ? '▲ Ahead of pace' : '▼ Behind pace'}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Expected: {expectedPercent}%
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================
// SECTION DIVIDER COMPONENT
// ============================================
interface SectionDividerProps {
  label: string;
}

function SectionDivider({ label }: SectionDividerProps) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, var(--border-subtle), transparent)' }} />
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, var(--border-subtle), transparent)' }} />
    </div>
  );
}

// ============================================
// TREND CHART COMPONENT
// ============================================
interface TrendChartProps {
  data: MonthlyTrendData[];
  loading?: boolean;
}

type TrendFilter = 'all' | 'hvac' | 'plumbing';

function TrendChart({ data, loading }: TrendChartProps) {
  const [filter, setFilter] = useState<TrendFilter>('all');

  if (loading || data.length === 0) {
    return (
      <div
        className="p-4 sm:p-5 rounded-xl mb-6"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            18 Month Trend
          </h3>
        </div>
        <div className="h-48 sm:h-64 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
          {loading ? 'Loading trend data...' : 'No trend data available'}
        </div>
      </div>
    );
  }

  // Custom tooltip - adapts to current filter
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) => {
    if (!active || !payload || !payload.length) return null;

    const hvac = payload.find(p => p.dataKey === 'hvacRevenue')?.value || 0;
    const plumbing = payload.find(p => p.dataKey === 'plumbingRevenue')?.value || 0;
    const total = hvac + plumbing;

    return (
      <div
        className="p-3 rounded-lg shadow-lg"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--christmas-cream)' }}>
          {label}
        </p>
        <div className="space-y-1 text-xs">
          {(filter === 'all' || filter === 'hvac') && (
            <div className="flex justify-between gap-4">
              <span style={{ color: 'var(--christmas-green)' }}>HVAC:</span>
              <span style={{ color: 'var(--christmas-cream)' }}>{formatCurrencyCompact(hvac)}</span>
            </div>
          )}
          {(filter === 'all' || filter === 'plumbing') && (
            <div className="flex justify-between gap-4">
              <span style={{ color: 'var(--christmas-gold)' }}>Plumbing:</span>
              <span style={{ color: 'var(--christmas-cream)' }}>{formatCurrencyCompact(plumbing)}</span>
            </div>
          )}
          {filter === 'all' && (
            <div className="flex justify-between gap-4 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total:</span>
              <span className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>{formatCurrencyCompact(total)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Filter button component
  const FilterButton = ({ value, label, color }: { value: TrendFilter; label: string; color?: string }) => {
    const isActive = filter === value;
    return (
      <button
        onClick={() => setFilter(value)}
        className="flex items-center gap-1.5 px-2 py-1 rounded transition-all"
        style={{
          backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
          opacity: isActive ? 1 : 0.6,
        }}
      >
        {color && <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />}
        <span style={{ color: isActive ? 'var(--christmas-cream)' : 'var(--text-muted)' }}>{label}</span>
      </button>
    );
  };

  return (
    <div
      className="p-4 sm:p-5 rounded-xl mb-6"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          18 Month Trend
        </h3>
        <div className="flex items-center gap-1 text-xs">
          <FilterButton value="all" label="All" />
          <FilterButton value="hvac" label="HVAC" color="var(--christmas-green)" />
          <FilterButton value="plumbing" label="Plumbing" color="var(--christmas-gold)" />
        </div>
      </div>

      <div className="h-48 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
              interval={1}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
              tickFormatter={(value) => formatCurrencyCompact(value)}
              width={45}
            />
            <CartesianGrid
              horizontal={true}
              vertical={false}
              strokeDasharray="3 3"
              stroke="var(--border-subtle)"
              strokeOpacity={0.5}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            {(filter === 'all' || filter === 'hvac') && (
              <Bar
                dataKey="hvacRevenue"
                stackId="revenue"
                fill="#346643"
                radius={filter === 'hvac' ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            )}
            {(filter === 'all' || filter === 'plumbing') && (
              <Bar
                dataKey="plumbingRevenue"
                stackId="revenue"
                fill="#B8956B"
                radius={[4, 4, 0, 0]}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================
// REVENUE CARD COMPONENT (for daily metrics)
// ============================================
interface RevenueCardProps {
  label: string;
  revenue: number;
  sales?: number;
  target: number;
  loading?: boolean;
  accentColor: 'green' | 'blue' | 'gold' | 'purple';
  expectedPacing?: number;
}

function RevenueCard({ label, revenue, sales, target, loading, accentColor, expectedPacing }: RevenueCardProps) {
  const percentage = target > 0 ? Math.round((revenue / target) * 100) : 0;
  const statusColor = getStatusColor(percentage);
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
      className="relative p-4 sm:p-5 rounded-xl transition-all hover:scale-[1.01]"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: `1px solid ${colors.border}`,
      }}
    >
      {/* Percentage Badge */}
      <div
        className="absolute top-3 sm:top-4 right-3 sm:right-4 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{
          backgroundColor: `${statusColor}15`,
          color: statusColor,
        }}
      >
        {loading ? '...' : `${percentage}%`}
      </div>

      {/* Label */}
      <p className="text-xs sm:text-sm font-medium mb-3 sm:mb-4 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>

      {/* Revenue / Sales Display */}
      {hasSales ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center mb-3 gap-2 sm:gap-0">
            <div className="flex-1 min-w-0">
              <span className="text-lg sm:text-xl font-bold block truncate" style={{ color: 'var(--christmas-cream)' }}>
                {loading ? '...' : formatCurrencyCompact(revenue)}
              </span>
              <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Revenue
              </span>
            </div>
            <div
              className="hidden sm:block w-px h-8 mx-2 flex-shrink-0"
              style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.5 }}
            />
            <div className="flex-1 min-w-0">
              <span className="text-lg sm:text-xl font-bold block truncate" style={{ color: 'var(--christmas-gold)' }}>
                {loading ? '...' : formatCurrencyCompact(sales)}
              </span>
              <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Sales
              </span>
            </div>
          </div>
          <div
            className="h-px w-full mb-2"
            style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.3 }}
          />
        </>
      ) : (
        <p className="text-2xl font-bold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          {loading ? '...' : formatCurrency(revenue)}
        </p>
      )}

      {/* Target */}
      <p className="text-xs mb-2 truncate" style={{ color: 'var(--text-muted)' }}>
        of {formatCurrencyCompact(target)} target
      </p>

      {/* Progress Bar */}
      <div
        className="relative h-1.5 rounded-full overflow-visible"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(percentage, 100)}%`,
            backgroundColor: statusColor,
          }}
        />
        {expectedPacing !== undefined && expectedPacing > 0 && !loading && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 transition-all duration-300"
            style={{
              left: `${Math.min(expectedPacing, 100)}%`,
              backgroundColor: 'var(--christmas-cream)',
              opacity: 0.9,
            }}
          />
        )}
      </div>

      {/* Pacing indicator */}
      {expectedPacing !== undefined && expectedPacing > 0 && !loading && (
        <div className="flex items-center justify-between mt-2 gap-1">
          <span
            className="text-[10px] whitespace-nowrap"
            style={{ color: isAheadOfPace ? 'var(--christmas-green)' : '#EF4444' }}
          >
            {isAheadOfPace ? '▲ Ahead' : '▼ Behind'}
          </span>
          <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
            {expectedPacing}% exp
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================
// MINI TRADE CARD COMPONENT (for trade sections)
// ============================================
interface MiniTradeCardProps {
  label: string;
  revenue: number;
  target?: number;
  loading?: boolean;
  accentColor: string;
  expectedPacing?: number;
}

function MiniTradeCard({ label, revenue, target, loading, accentColor, expectedPacing }: MiniTradeCardProps) {
  const percentage = target && target > 0 ? Math.round((revenue / target) * 100) : null;
  const statusColor = percentage !== null ? getStatusColor(percentage) : accentColor;
  const isAheadOfPace = expectedPacing !== undefined && percentage !== null && percentage >= expectedPacing;

  return (
    <div
      className="p-3 sm:p-4 rounded-lg"
      style={{ backgroundColor: 'var(--bg-card)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        {percentage !== null && (
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `${statusColor}15`,
              color: statusColor,
            }}
          >
            {loading ? '...' : `${percentage}%`}
          </span>
        )}
      </div>

      <p className="text-xl font-bold mb-1" style={{ color: 'var(--christmas-cream)' }}>
        {loading ? '...' : formatCurrencyCompact(revenue)}
      </p>

      {target && target > 0 && (
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
          of {formatCurrencyCompact(target)}
        </p>
      )}

      {percentage !== null && (
        <div
          className="relative h-1 rounded-full overflow-visible"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <div
            className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(percentage, 100)}%`,
              backgroundColor: statusColor,
            }}
          />
          {expectedPacing !== undefined && expectedPacing > 0 && !loading && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2 transition-all duration-300"
              style={{
                left: `${Math.min(expectedPacing, 100)}%`,
                backgroundColor: 'var(--christmas-cream)',
                opacity: 0.8,
              }}
            />
          )}
        </div>
      )}

      {expectedPacing !== undefined && expectedPacing > 0 && percentage !== null && !loading && (
        <div className="flex items-center justify-between mt-1.5">
          <span
            className="text-[10px]"
            style={{ color: isAheadOfPace ? 'var(--christmas-green)' : '#EF4444' }}
          >
            {isAheadOfPace ? '▲ Ahead' : '▼ Behind'}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN DASHBOARD PAGE
// ============================================
export default function DashboardPage() {
  const [currentDate, setCurrentDate] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const fetchData = useCallback(async (bypassCache = false) => {
    const cacheKey = `dashboard-${selectedDate}`;

    // Check cache first (unless bypassing)
    if (!bypassCache) {
      const cached = dashboardCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setDashData(cached.data);
        setLoading(false);
        return;
      }
    }

    // Only show loading if no cached data exists at all
    const cached = dashboardCache.get(cacheKey);
    if (!cached) {
      setLoading(true);
    }

    try {
      const res = await fetch(`/api/huddle?date=${selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        setDashData(data);
        // Cache the result
        dashboardCache.set(cacheKey, { data, timestamp: Date.now() });
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

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
        // Clear cache for this date and refetch
        dashboardCache.delete(`dashboard-${selectedDate}`);
        await fetchData(true);
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
    // Refresh every 10 minutes (bypassing cache for fresh data)
    const interval = setInterval(() => fetchData(true), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedDate, fetchData]);

  // Extract data from API response
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
  const annualTarget = pacing?.annualTarget || 10260000;

  // Trade data
  const trades = pacing?.trades;
  const hvacToday = trades?.hvac?.today?.revenue || 0;
  const hvacWtd = trades?.hvac?.wtd?.revenue || 0;
  const hvacMtd = trades?.hvac?.mtd?.revenue || 0;
  const hvacInstallMtd = trades?.hvac?.mtd?.departments?.install?.revenue || 0;
  const hvacServiceMtd = trades?.hvac?.mtd?.departments?.service?.revenue || 0;
  const hvacMaintenanceMtd = trades?.hvac?.mtd?.departments?.maintenance?.revenue || 0;
  const plumbingToday = trades?.plumbing?.today?.revenue || 0;
  const plumbingWtd = trades?.plumbing?.wtd?.revenue || 0;
  const plumbingMtd = trades?.plumbing?.mtd?.revenue || 0;

  // Trade targets
  const hvacTargets = trades?.hvac?.targets;
  const plumbingTargets = trades?.plumbing?.targets;

  // Pacing percentages
  const dailyPacing = getDailyPacingPercent();
  const weeklyPacing = getWeeklyPacingPercent();
  const monthlyPacing = getMonthlyPacingPercent(
    pacing?.businessDaysElapsed || 0,
    pacing?.businessDaysInMonth || 22
  );
  const quarterlyPacing = getQuarterlyPacingPercent();

  // Monthly trend data
  const monthlyTrend = pacing?.monthlyTrend || [];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1
            className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight"
            style={{ color: 'var(--christmas-cream)' }}
          >
            <span className="hidden sm:inline">Christmas Air Conditioning & Plumbing</span>
            <span className="sm:hidden">Christmas Air</span>
          </h1>
          <p className="text-sm sm:text-lg mt-1" style={{ color: 'var(--text-secondary)' }}>
            Daily Huddle Dashboard
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setSelectedDate(getYesterdayDateString())}
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors"
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
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors"
              style={{
                backgroundColor: selectedDate === getTodayDateString() ? 'var(--christmas-green)' : 'var(--bg-card)',
                color: selectedDate === getTodayDateString() ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              Today
            </button>
          </div>

          {lastSync && (
            <span className="hidden sm:inline text-xs" style={{ color: 'var(--text-muted)' }}>
              Synced: {lastSync}
            </span>
          )}

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
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
            <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          <div
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-lg"
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

      {/* Annual Progress Banner */}
      <AnnualBanner
        revenue={ytdRevenue}
        target={annualTarget}
        expectedPercent={pacing?.expectedAnnualPacingPercent || 0}
        loading={loading}
      />

      {/* 18 Month Trend Chart */}
      <TrendChart data={monthlyTrend} loading={loading} />

      {/* Section Divider - Pacing Metrics */}
      <SectionDivider label="Pacing Metrics" />

      {/* Revenue Cards - 4 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <RevenueCard
          label="Today"
          revenue={todayRevenue}
          sales={todaySales}
          target={dailyTarget}
          loading={loading}
          accentColor="green"
          expectedPacing={dailyPacing}
        />
        <RevenueCard
          label="This Week"
          revenue={weekRevenue}
          sales={weekSales}
          target={weeklyTarget}
          loading={loading}
          accentColor="blue"
          expectedPacing={weeklyPacing}
        />
        <RevenueCard
          label="This Month"
          revenue={mtdRevenue}
          sales={mtdSales}
          target={monthlyTarget}
          loading={loading}
          accentColor="gold"
          expectedPacing={monthlyPacing}
        />
        <RevenueCard
          label="This Quarter"
          revenue={qtdRevenue}
          sales={qtdSales}
          target={quarterlyTarget}
          loading={loading}
          accentColor="purple"
          expectedPacing={quarterlyPacing}
        />
      </div>

      {/* Section Divider - By Trade */}
      <SectionDivider label="By Trade" />

      {/* HVAC Trade Section */}
      <div
        className="p-4 sm:p-5 rounded-xl mb-4"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
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
          <div className="text-right">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>MTD: </span>
            <span className="text-lg font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {loading ? '...' : formatCurrencyCompact(hvacMtd)}
            </span>
          </div>
        </div>

        {/* Time Period Cards - Today, Week, Month only */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <MiniTradeCard
            label="Today"
            revenue={hvacToday}
            target={hvacTargets?.daily || 0}
            loading={loading}
            accentColor="#3B82F6"
            expectedPacing={dailyPacing}
          />
          <MiniTradeCard
            label="Week"
            revenue={hvacWtd}
            target={hvacTargets?.weekly || 0}
            loading={loading}
            accentColor="#3B82F6"
            expectedPacing={weeklyPacing}
          />
          <MiniTradeCard
            label="Month"
            revenue={hvacMtd}
            target={hvacTargets?.monthly || 0}
            loading={loading}
            accentColor="#3B82F6"
            expectedPacing={monthlyPacing}
          />
        </div>

        {/* Separator */}
        <div className="h-px w-full mb-4" style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.3 }} />

        {/* Department Label */}
        <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Departments (MTD)
        </p>

        {/* HVAC Departments */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MiniTradeCard
            label="Install"
            revenue={hvacInstallMtd}
            target={hvacTargets?.departments?.install || 0}
            loading={loading}
            accentColor="#3B82F6"
            expectedPacing={monthlyPacing}
          />
          <MiniTradeCard
            label="Service"
            revenue={hvacServiceMtd}
            target={hvacTargets?.departments?.service || 0}
            loading={loading}
            accentColor="#3B82F6"
            expectedPacing={monthlyPacing}
          />
          <MiniTradeCard
            label="Maintenance"
            revenue={hvacMaintenanceMtd}
            target={hvacTargets?.departments?.maintenance || 0}
            loading={loading}
            accentColor="#3B82F6"
            expectedPacing={monthlyPacing}
          />
        </div>
      </div>

      {/* Plumbing Trade Section */}
      <div
        className="p-4 sm:p-5 rounded-xl mb-8"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
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
          <div className="text-right">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>MTD: </span>
            <span className="text-lg font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {loading ? '...' : formatCurrencyCompact(plumbingMtd)}
            </span>
          </div>
        </div>

        {/* Time Period Cards - Today, Week, Month only */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MiniTradeCard
            label="Today"
            revenue={plumbingToday}
            target={plumbingTargets?.daily || 0}
            loading={loading}
            accentColor="#8B5CF6"
            expectedPacing={dailyPacing}
          />
          <MiniTradeCard
            label="Week"
            revenue={plumbingWtd}
            target={plumbingTargets?.weekly || 0}
            loading={loading}
            accentColor="#8B5CF6"
            expectedPacing={weeklyPacing}
          />
          <MiniTradeCard
            label="Month"
            revenue={plumbingMtd}
            target={plumbingTargets?.monthly || 0}
            loading={loading}
            accentColor="#8B5CF6"
            expectedPacing={monthlyPacing}
          />
        </div>
      </div>
    </div>
  );
}
