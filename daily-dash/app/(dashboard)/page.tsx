'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useHuddleData } from '@/lib/hooks/useHuddleData';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';

// Department revenue breakdown
interface DepartmentRevenue {
  revenue: number;
  completedRevenue: number;
  nonJobRevenue: number;
  adjRevenue: number;
  sales: number;
}

// Trade metrics for a single time period
interface TradeMetrics {
  revenue: number;
  completedRevenue: number;
  nonJobRevenue: number;
  adjRevenue: number;
  sales: number;
  departments?: {
    install: DepartmentRevenue;
    service: DepartmentRevenue;
    maintenance: DepartmentRevenue;
    sales: DepartmentRevenue;
  };
}

// Per-department targets
interface DeptTargets {
  monthly: number;
  daily: number;
  weekly: number;
}

// Trade targets
interface HVACTargets {
  daily: number;
  weekly: number;
  monthly: number;
  quarterly: number;
  annual: number;
  departments?: {
    install: DeptTargets;
    service: DeptTargets;
    maintenance: DeptTargets;
    sales: DeptTargets;
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
  sales: number;
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
  dailyTarget: number;       // Base daily target (for full business day)
  todayTarget?: number;      // Adjusted for day of week (0 Sunday, 50% Saturday)
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
  // Sunday = no target, return 0
  if (dayOfWeek === 0) return 0;
  const currentHour = now.getHours() + now.getMinutes() / 60;
  if (currentHour < BUSINESS_START_HOUR) return 0;
  if (currentHour >= BUSINESS_END_HOUR) return 100;
  const hoursElapsed = currentHour - BUSINESS_START_HOUR;
  // Saturday is a half day, but pacing % is still based on progress through business hours
  // The target itself is already halved, so pacing calculation stays the same
  return Math.round((hoursElapsed / BUSINESS_HOURS_PER_DAY) * 100);
}

function getWeeklyPacingPercent(): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  // Sunday = no progress tracking
  if (dayOfWeek === 0) return 0;

  // Total business days in week: Mon-Fri = 5, Saturday = 0.5, Total = 5.5
  const totalBusinessDaysInWeek = 5.5;

  const currentHour = now.getHours() + now.getMinutes() / 60;
  let dayProgress = 0;
  if (currentHour >= BUSINESS_END_HOUR) {
    dayProgress = dayOfWeek === 6 ? 0.5 : 1; // Saturday counts as 0.5 when complete
  } else if (currentHour >= BUSINESS_START_HOUR) {
    const hourProgress = (currentHour - BUSINESS_START_HOUR) / BUSINESS_HOURS_PER_DAY;
    dayProgress = dayOfWeek === 6 ? hourProgress * 0.5 : hourProgress; // Saturday partial = 0.5 max
  }

  // Days completed before today: Mon-Fri each count as 1
  // If today is Saturday (6), then Mon-Fri (5 days) are completed
  const daysCompleted = dayOfWeek === 6 ? 5 : dayOfWeek - 1;
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
    const dayWeight = dayOfWeek === 6 ? 0.5 : 1; // Saturday counts as 0.5 max
    if (currentHour >= BUSINESS_END_HOUR) {
      partialDay = dayWeight;
    } else if (currentHour >= BUSINESS_START_HOUR) {
      const hourProgress = (currentHour - BUSINESS_START_HOUR) / BUSINESS_HOURS_PER_DAY;
      partialDay = hourProgress * dayWeight;
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

  // Reset time to start of day for comparison
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  while (current <= quarterEnd) {
    const dow = current.getDay();
    // Mon-Fri = 1 full day, Saturday = 0.5, Sunday = 0
    if (dow >= 1 && dow <= 5) {
      businessDaysInQuarter += 1;
      if (current < todayStart) {
        businessDaysElapsed += 1;
      }
    } else if (dow === 6) {
      businessDaysInQuarter += 0.5;
      if (current < todayStart) {
        businessDaysElapsed += 0.5;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  const dayOfWeek = now.getDay();
  let partialDay = 0;
  if (dayOfWeek >= 1 && dayOfWeek <= 6) {
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const dayWeight = dayOfWeek === 6 ? 0.5 : 1; // Saturday counts as 0.5 max
    if (currentHour >= BUSINESS_END_HOUR) {
      partialDay = dayWeight;
    } else if (currentHour >= BUSINESS_START_HOUR) {
      const hourProgress = (currentHour - BUSINESS_START_HOUR) / BUSINESS_HOURS_PER_DAY;
      partialDay = hourProgress * dayWeight;
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

function getStatusColor(actualPct: number, expectedPct?: number): string {
  // If we have expected pacing, color based on whether ahead or behind
  if (expectedPct !== undefined && expectedPct > 0) {
    const ratio = actualPct / expectedPct;
    if (ratio >= 1) return 'var(--christmas-green)';
    if (ratio >= 0.9) return '#3B82F6';
    if (ratio >= 0.75) return 'var(--christmas-gold)';
    return '#EF4444';
  }
  // Fallback: just use absolute percentage
  if (actualPct >= 100) return 'var(--christmas-green)';
  if (actualPct >= 90) return '#3B82F6';
  if (actualPct >= 75) return 'var(--christmas-gold)';
  return '#EF4444';
}

function getTodayDateString(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const statusColor = getStatusColor(percentage, expectedPercent);
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
              backgroundColor: `${isAheadOfPace ? 'var(--christmas-green)' : '#EF4444'}15`,
              color: isAheadOfPace ? 'var(--christmas-green)' : '#EF4444',
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
            Expected: {expectedPercent.toFixed(2)}%
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
  badge?: string;
}

function SectionDivider({ label, badge }: SectionDividerProps) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, var(--border-subtle), transparent)' }} />
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        {badge && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--christmas-gold)', border: '1px solid var(--border-subtle)' }}>
            {badge}
          </span>
        )}
      </div>
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
          <BarChart data={data} margin={{ top: 10, right: 5, left: 0, bottom: 5 }}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              interval="preserveStartEnd"
              minTickGap={30}
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
  const statusColor = getStatusColor(percentage, expectedPacing);
  const isAheadOfPace = expectedPacing !== undefined && percentage >= expectedPacing;

  const accentColors = {
    green: { border: 'rgba(52, 102, 67, 0.3)' },
    blue: { border: 'rgba(59, 130, 246, 0.3)' },
    gold: { border: 'rgba(184, 149, 107, 0.3)' },
    purple: { border: 'rgba(139, 92, 246, 0.3)' },
  };

  const colors = accentColors[accentColor];
  const hasSales = sales !== undefined;

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
            <div className="flex-1">
              <span className="text-xl sm:text-2xl font-bold block whitespace-nowrap" style={{ color: 'var(--christmas-cream)' }}>
                {loading ? '...' : formatCurrencyCompact(revenue)}
              </span>
              <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Revenue
              </span>
            </div>
            <div
              className="hidden sm:block w-px h-10 mx-3 flex-shrink-0"
              style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.5 }}
            />
            <div className="flex-1">
              <span className="text-xl sm:text-2xl font-bold block whitespace-nowrap" style={{ color: 'var(--christmas-gold)' }}>
                {loading ? '...' : formatCurrencyCompact(sales)}
              </span>
              <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
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
  const statusColor = percentage !== null ? getStatusColor(percentage, expectedPacing) : accentColor;
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
// TRADE SCOREBOARD COMPONENT
// ============================================
interface TradeScoreboardProps {
  trade: 'hvac' | 'plumbing';
  tradeData: TradeData;
  targets: HVACTargets | PlumbingTargets | undefined;
  dailyPacing: number;
  weeklyPacing: number;
  monthlyPacing: number;
  loading: boolean;
}

function ScoreboardCell({
  actual,
  target,
  expectedPacing,
  loading,
}: {
  actual: number;
  target: number;
  expectedPacing: number;
  loading: boolean;
}) {
  if (loading) return <span style={{ color: 'var(--text-muted)' }}>--</span>;
  const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
  const color = target > 0 ? getStatusColor(pct, expectedPacing) : 'var(--text-muted)';
  return (
    <div className="text-right">
      <span style={{ color }} className="font-semibold">{formatCurrencyCompact(actual)}</span>
      {target > 0 && (
        <span style={{ color: 'var(--text-muted)' }} className="text-[10px] sm:text-xs"> / {formatCurrencyCompact(target)}</span>
      )}
    </div>
  );
}

function SalesCell({ actual, loading }: { actual: number; loading: boolean }) {
  if (loading) return <span style={{ color: 'var(--text-muted)' }}>--</span>;
  return (
    <div className="text-right">
      <span style={{ color: 'var(--christmas-cream)' }} className="font-semibold">{formatCurrencyCompact(actual)}</span>
    </div>
  );
}

function RevenueSalesCell({
  revenue, sales, target, expectedPacing, loading,
}: {
  revenue: number; sales: number; target: number; expectedPacing: number; loading: boolean;
}) {
  if (loading) return <div className="text-right"><span style={{ color: 'var(--text-muted)' }}>--</span></div>;
  const pct = target > 0 ? Math.round((revenue / target) * 100) : 0;
  const color = target > 0 ? getStatusColor(pct, expectedPacing) : 'var(--text-muted)';
  return (
    <div className="text-right leading-tight">
      <div>
        <span style={{ color }} className="font-semibold">{formatCurrencyCompact(revenue)}</span>
        {target > 0 && (
          <span style={{ color: 'var(--text-muted)' }} className="text-[10px] sm:text-xs"> / {formatCurrencyCompact(target)}</span>
        )}
      </div>
      {sales > 0 && (
        <div className="text-[10px]" style={{ color: 'var(--christmas-gold)', opacity: 0.8 }}>
          {formatCurrencyCompact(sales)} sold
        </div>
      )}
    </div>
  );
}

function TradeScoreboard({ trade, tradeData, targets, dailyPacing, weeklyPacing, monthlyPacing, loading }: TradeScoreboardProps) {
  const isHvac = trade === 'hvac';
  const accentColor = isHvac ? '#3B82F6' : '#8B5CF6';
  const data = tradeData[trade];

  const hvacTargets = targets as HVACTargets | undefined;
  const depts = isHvac ? ['sales', 'install', 'service', 'maintenance'] as const : [];
  const deptLabels: Record<string, string> = { install: 'Install', service: 'Service', maintenance: 'Maintenance', sales: 'Sales' };

  // Get department data for a period
  const getDept = (period: 'today' | 'wtd' | 'mtd', dept: 'install' | 'service' | 'maintenance' | 'sales') => {
    const periodData = data[period] as TradeMetrics;
    return periodData?.departments?.[dept] || { revenue: 0, sales: 0 };
  };

  const getDeptTarget = (dept: 'install' | 'service' | 'maintenance' | 'sales', period: 'daily' | 'weekly' | 'monthly') => {
    return hvacTargets?.departments?.[dept]?.[period] || 0;
  };

  return (
    <div
      className="p-4 sm:p-5 rounded-xl mb-4"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: `1px solid ${accentColor}4D`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}33` }}
          >
            {isHvac ? (
              <svg className="w-4 h-4" fill="none" stroke={accentColor} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke={accentColor} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            )}
          </div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            {isHvac ? 'HVAC' : 'Plumbing'}
          </h3>
        </div>
      </div>

      {/* Scoreboard Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="text-left py-2 pr-2 font-medium" style={{ color: 'var(--text-muted)', width: '100px' }}></th>
              <th className="text-right py-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Today</th>
              <th className="text-right py-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Week</th>
              <th className="text-right py-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Month</th>
            </tr>
          </thead>
          <tbody>
            {/* Department rows (HVAC only) */}
            {isHvac && depts.map((dept) => (
              <tr key={dept}>
                <td className="py-2 pr-2 font-medium" style={{ color: 'var(--christmas-cream)' }}>
                  {deptLabels[dept]}
                </td>
                <td className="py-2 px-2">
                  <RevenueSalesCell revenue={getDept('today', dept).revenue} sales={getDept('today', dept).sales || 0} target={getDeptTarget(dept, 'daily')} expectedPacing={dailyPacing} loading={loading} />
                </td>
                <td className="py-2 px-2">
                  <RevenueSalesCell revenue={getDept('wtd', dept).revenue} sales={getDept('wtd', dept).sales || 0} target={getDeptTarget(dept, 'weekly')} expectedPacing={weeklyPacing} loading={loading} />
                </td>
                <td className="py-2 px-2">
                  <RevenueSalesCell revenue={getDept('mtd', dept).revenue} sales={getDept('mtd', dept).sales || 0} target={getDeptTarget(dept, 'monthly')} expectedPacing={monthlyPacing} loading={loading} />
                </td>
              </tr>
            ))}

            {/* Separator */}
            {isHvac && (
              <tr>
                <td colSpan={4} className="py-1">
                  <div className="h-px w-full" style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.3 }} />
                </td>
              </tr>
            )}

            {/* Total row */}
            <tr>
              <td className="py-2 pr-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Total
              </td>
              <td className="py-2 px-2">
                <RevenueSalesCell revenue={data.today.revenue} sales={(data.today as TradeMetrics).sales || 0} target={targets?.daily || 0} expectedPacing={dailyPacing} loading={loading} />
              </td>
              <td className="py-2 px-2">
                <RevenueSalesCell revenue={data.wtd.revenue} sales={(data.wtd as TradeMetrics).sales || 0} target={targets?.weekly || 0} expectedPacing={weeklyPacing} loading={loading} />
              </td>
              <td className="py-2 px-2">
                <RevenueSalesCell revenue={data.mtd.revenue} sales={(data.mtd as TradeMetrics).sales || 0} target={targets?.monthly || 0} expectedPacing={monthlyPacing} loading={loading} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// MAIN DASHBOARD PAGE
// ============================================
export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = getTodayDateString();
    return { start: today, end: today };
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [hvacExpanded, setHvacExpanded] = useState(false);

  // Use the end date as the reference point for pacing data
  const selectedDate = dateRange.end;

  // Use SWR for cached data fetching - instant load on navigation
  const { data: dashData, pacing, isLoading, isValidating, mutate } = useHuddleData(
    selectedDate === getTodayDateString() ? undefined : selectedDate
  );

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Sync trade daily snapshots (revenue + sales from ST Reports)
      await fetch('/api/trades/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      });
      // Also sync huddle snapshots
      await fetch('/api/huddle/snapshots/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      });
      setLastSync(new Date().toLocaleTimeString());
      // Refresh SWR cache
      mutate();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Show loading only on first load (no cached data)
  const loading = isLoading && !pacing;
  const todayRevenue = pacing?.todayRevenue || 0;
  const todaySales = pacing?.todaySales || 0;
  const dailyTarget = pacing?.dailyTarget || 38864;
  // todayTarget is adjusted for day of week (0 Sunday, 50% Saturday)
  const todayTarget = pacing?.todayTarget ?? dailyTarget;
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
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
          />

          {lastSync && (
            <span className="hidden sm:inline text-xs" style={{ color: 'var(--text-muted)' }}>
              Synced: {lastSync}
            </span>
          )}

          {/* Background refresh indicator */}
          {isValidating && !isLoading && !isSyncing && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-card)' }}>
              <svg className="w-3 h-3 animate-spin" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span style={{ color: 'var(--text-muted)' }}>Refreshing</span>
            </div>
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
      <SectionDivider label="Pacing Metrics" badge={pacing?.businessDaysRemaining !== undefined ? `${pacing.businessDaysRemaining} biz days left` : undefined} />

      {/* Revenue Cards - 4 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <RevenueCard
          label="Today"
          revenue={todayRevenue}
          sales={todaySales}
          target={todayTarget}
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

      {/* Trade Breakdown Cards */}
      {trades && (
        <div className="space-y-5">
          {/* Plumbing Card */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, var(--bg-secondary) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              boxShadow: '0 4px 24px rgba(139, 92, 246, 0.08)',
            }}
          >
            <div className="p-5 sm:p-6">
              {/* Trade Header */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(139, 92, 246, 0.1) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)' }}
                >
                  {/* Wrench icon */}
                  <svg className="w-5 h-5" fill="none" stroke="#8B5CF6" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: 'var(--christmas-cream)' }}>Plumbing</h3>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    MTD {loading ? '...' : formatCurrencyCompact(trades.plumbing.mtd.revenue)} rev
                  </div>
                </div>
              </div>

              {/* Plumbing Period Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([
                  { label: 'Today', revenue: trades.plumbing.today.revenue, sales: (trades.plumbing.today as TradeMetrics).sales || 0, target: plumbingTargets?.daily || 0, pacing: dailyPacing },
                  { label: 'This Week', revenue: trades.plumbing.wtd.revenue, sales: (trades.plumbing.wtd as TradeMetrics).sales || 0, target: plumbingTargets?.weekly || 0, pacing: weeklyPacing },
                  { label: 'This Month', revenue: trades.plumbing.mtd.revenue, sales: (trades.plumbing.mtd as TradeMetrics).sales || 0, target: plumbingTargets?.monthly || 0, pacing: monthlyPacing },
                ] as const).map((p) => (
                  <RevenueCard key={p.label} label={p.label} revenue={p.revenue} sales={p.sales} target={p.target} loading={loading} accentColor="purple" expectedPacing={p.pacing} />
                ))}
              </div>
            </div>
          </div>

          {/* HVAC Card */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.06) 0%, rgba(251, 146, 60, 0.03) 50%, var(--bg-secondary) 100%)',
              border: '1px solid rgba(234, 88, 12, 0.25)',
              boxShadow: '0 4px 24px rgba(234, 88, 12, 0.06)',
            }}
          >
            <div className="p-5 sm:p-6">
              {/* Trade Header */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.25) 0%, rgba(251, 146, 60, 0.12) 100%)', border: '1px solid rgba(234, 88, 12, 0.2)' }}
                >
                  {/* Snowflake / AC icon */}
                  <svg className="w-5 h-5" fill="none" stroke="#EA580C" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0-18l-3 3m3-3l3 3m-3 15l-3-3m3 3l3-3M3 12h18M3 12l3-3m-3 3l3 3m15-3l-3-3m3 3l-3 3M5.636 5.636l2.121 2.121m8.486 8.486l2.121 2.121M5.636 18.364l2.121-2.121m8.486-8.486l2.121-2.121" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--christmas-cream)' }}>HVAC</h3>
              </div>

              {/* HVAC Period Cards - always visible */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([
                  { label: 'Today', revenue: trades.hvac.today.revenue, sales: (trades.hvac.today as TradeMetrics).sales || 0, target: hvacTargets?.daily || 0, pacing: dailyPacing },
                  { label: 'This Week', revenue: trades.hvac.wtd.revenue, sales: (trades.hvac.wtd as TradeMetrics).sales || 0, target: hvacTargets?.weekly || 0, pacing: weeklyPacing },
                  { label: 'This Month', revenue: trades.hvac.mtd.revenue, sales: (trades.hvac.mtd as TradeMetrics).sales || 0, target: hvacTargets?.monthly || 0, pacing: monthlyPacing },
                ] as const).map((p) => (
                  <RevenueCard key={p.label} label={p.label} revenue={p.revenue} sales={p.sales} target={p.target} loading={loading} accentColor="gold" expectedPacing={p.pacing} />
                ))}
              </div>
            </div>

            {/* Collapsible Department Breakdown */}
            <div style={{ borderTop: '1px solid rgba(234, 88, 12, 0.15)' }}>
              <button
                onClick={() => setHvacExpanded(!hvacExpanded)}
                className="w-full px-5 sm:px-6 py-3 flex items-center justify-between cursor-pointer"
                style={{ background: 'transparent' }}
              >
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Department Breakdown</span>
                <svg
                  className="w-4 h-4 transition-transform duration-200"
                  style={{ color: 'var(--text-muted)', transform: hvacExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {hvacExpanded && (
                <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-4">
                  {(['sales', 'install', 'service', 'maintenance'] as const).map((dept) => {
                    const labels: Record<string, string> = { install: 'Install', service: 'Service', maintenance: 'Maintenance', sales: 'Sales' };
                    const getDeptData = (period: 'today' | 'wtd' | 'mtd') => {
                      const pd = trades.hvac[period] as TradeMetrics;
                      return pd?.departments?.[dept] || { revenue: 0, sales: 0 };
                    };
                    const getDeptTarget = (period: 'daily' | 'weekly' | 'monthly') => hvacTargets?.departments?.[dept]?.[period] || 0;
                    return (
                      <div key={dept}>
                        <div className="text-sm font-semibold mb-2 px-1" style={{ color: 'var(--christmas-cream)' }}>{labels[dept]}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {([
                            { label: 'Today', data: getDeptData('today'), target: getDeptTarget('daily'), pacing: dailyPacing },
                            { label: 'Week', data: getDeptData('wtd'), target: getDeptTarget('weekly'), pacing: weeklyPacing },
                            { label: 'Month', data: getDeptData('mtd'), target: getDeptTarget('monthly'), pacing: monthlyPacing },
                          ] as const).map((p) => (
                            <RevenueCard key={p.label} label={p.label} revenue={p.data.revenue} sales={p.data.sales || 0} target={p.target} loading={loading} accentColor="gold" expectedPacing={p.pacing} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
