'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Types
interface DailyCount {
  date: string;
  count: number;
}

interface MonthlyGoal {
  month: number;
  target_value: number;
  daily_target_value: number;
}

interface LocationStats {
  id: string;
  name: string;
  short_name: string;
  total_reviews: number;
  average_rating: number;
  reviews_this_year: number;
  reviews_this_month: number;
  reviews_this_period: number;
  period_change_percent: number | null;
}

interface ReviewStats {
  total_reviews: number;
  average_rating: number;
  reviews_this_year: number;
  reviews_this_month: number;
  reviews_today: number;
  reviews_this_week: number;
  reviews_this_period: number;
  year_goal: number;
  period_goal: number | null;
  monthly_goal: number | null;
  daily_goal: number | null;
  year_progress_percent: number;
  expected_progress_percent: number;
  pacing_status: 'ahead' | 'on_track' | 'behind';
  pacing_difference_percent: number;
  locations: LocationStats[];
  rating_distribution: Record<number, number>;
  daily_counts: DailyCount[];
  period_start: string;
  period_end: string;
  period_year: number;
  monthly_goals: MonthlyGoal[];
}

interface Review {
  id: string;
  location_id: string;
  google_review_id: string;
  reviewer_name: string;
  reviewer_photo_url: string | null;
  star_rating: number;
  comment: string | null;
  review_reply: string | null;
  reply_time: string | null;
  create_time: string;
  team_members_mentioned: string[] | null;
  location: {
    id: string;
    name: string;
    short_name: string;
  };
}

interface LeaderboardEntry {
  name: string;
  mention_count: number;
  five_star_count: number;
  avg_rating: number;
  recent_review?: string;
}

// Period presets
type PeriodPreset = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_30' | 'last_90' | 'last_year' | 'all_time' | 'custom';

function getPeriodDates(preset: PeriodPreset, customStart?: Date, customEnd?: Date): { start: Date; end: Date } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (preset) {
    case 'this_month':
      return {
        start: new Date(year, month, 1),
        end: now,
      };
    case 'last_month':
      return {
        start: new Date(year, month - 1, 1),
        end: new Date(year, month, 0),
      };
    case 'this_quarter': {
      const quarterStart = Math.floor(month / 3) * 3;
      return {
        start: new Date(year, quarterStart, 1),
        end: now,
      };
    }
    case 'last_quarter': {
      const quarterStart = Math.floor(month / 3) * 3;
      return {
        start: new Date(year, quarterStart - 3, 1),
        end: new Date(year, quarterStart, 0),
      };
    }
    case 'this_year':
      return {
        start: new Date(year, 0, 1),
        end: now,
      };
    case 'last_30':
      return {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: now,
      };
    case 'last_90':
      return {
        start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        end: now,
      };
    case 'last_year':
      return {
        start: new Date(year - 1, 0, 1),
        end: new Date(year - 1, 11, 31),
      };
    case 'all_time':
      return {
        start: new Date(2010, 0, 1), // Far back enough to capture all reviews (earliest is 2012)
        end: now,
      };
    case 'custom':
      return {
        start: customStart || new Date(year, month, 1),
        end: customEnd || now,
      };
    default:
      return {
        start: new Date(year, month, 1),
        end: now,
      };
  }
}

function getPeriodLabel(preset: PeriodPreset, customStart?: Date, customEnd?: Date): string {
  const now = new Date();
  switch (preset) {
    case 'this_month':
      return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    case 'last_month': {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    case 'this_quarter':
      return `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
    case 'last_quarter':
      return `Q${Math.floor(now.getMonth() / 3)} ${now.getFullYear()}`;
    case 'this_year':
      return `${now.getFullYear()}`;
    case 'last_30':
      return 'Last 30 Days';
    case 'last_90':
      return 'Last 90 Days';
    case 'last_year':
      return `${now.getFullYear() - 1}`;
    case 'all_time':
      return 'All Time';
    case 'custom':
      if (customStart && customEnd) {
        return `${customStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${customEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
      return 'Custom Range';
    default:
      return 'Selected Period';
  }
}

// Components
function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={sizeClass}
          fill={star <= rating ? '#FBBF24' : '#374151'}
          viewBox="0 0 24 24"
        >
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  changePercent,
  icon,
  highlight = false,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  changePercent?: number | null;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  const isPositive = changePercent !== null && changePercent !== undefined && changePercent > 0;
  const isNegative = changePercent !== null && changePercent !== undefined && changePercent < 0;

  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: highlight ? 'rgba(52, 102, 67, 0.2)' : 'var(--bg-secondary)',
        border: highlight ? '1px solid rgba(52, 102, 67, 0.4)' : '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
        {icon && <div style={{ color: 'var(--text-muted)' }}>{icon}</div>}
      </div>
      <div className="flex items-baseline gap-3">
        <span
          className="text-3xl font-bold"
          style={{ color: highlight ? 'var(--christmas-green)' : 'var(--christmas-cream)' }}
        >
          {value}
        </span>
        {changePercent !== null && changePercent !== undefined && (
          <span
            className="text-sm font-medium"
            style={{
              color: isPositive ? 'var(--christmas-green)' : isNegative ? '#EF4444' : 'var(--text-muted)'
            }}
          >
            {isPositive ? '+' : ''}
            {Math.round(changePercent)}%
          </span>
        )}
      </div>
      {subtext && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{subtext}</p>}
    </div>
  );
}

function ReviewsChart({ data, period }: { data: DailyCount[]; period: PeriodPreset }) {
  const chartData = useMemo(() => {
    return data.map((item) => {
      const date = new Date(item.date);
      let label: string;

      if (period === 'this_year' || period === 'last_quarter' || period === 'this_quarter') {
        label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      return {
        date: label,
        reviews: item.count,
        fullDate: item.date,
      };
    });
  }, [data, period]);

  const totalReviews = data.reduce((sum, d) => sum + d.count, 0);
  const avgPerDay = data.length > 0 ? (totalReviews / data.length).toFixed(1) : '0';

  return (
    <div
      className="rounded-xl p-6"
      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>Reviews by Day</h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {totalReviews} total &middot; {avgPerDay} avg/day
          </p>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a2e1f',
                border: '1px solid rgba(52, 102, 67, 0.3)',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              }}
              labelStyle={{ color: '#d4c5a9', marginBottom: '4px' }}
              itemStyle={{ color: '#346643' }}
              formatter={(value) => [`${value} reviews`, '']}
              cursor={{ fill: 'rgba(52, 102, 67, 0.1)' }}
            />
            <Bar dataKey="reviews" fill="#346643" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function GoalProgress({
  stats,
  period,
  periodDates
}: {
  stats: ReviewStats;
  period: PeriodPreset;
  periodDates: { start: Date; end: Date };
}) {
  const now = new Date();

  // Don't show progress bar if no goal exists for this period's year (pre-2025)
  if (stats.period_goal === null) {
    return null;
  }

  // Calculate business days between two dates (excludes weekends)
  function getBusinessDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  // Helper to get monthly goal from the monthly_goals array
  function getMonthlyGoalValue(month: number): number {
    const monthGoal = stats.monthly_goals?.find(g => g.month === month);
    if (monthGoal) return monthGoal.target_value;
    // Fallback to dividing annual by 12
    const yearGoal = stats.period_goal || stats.year_goal;
    return Math.round(yearGoal / 12);
  }

  // Helper to get daily target from the monthly_goals array
  function getDailyTargetValue(month: number): number {
    const monthGoal = stats.monthly_goals?.find(g => g.month === month);
    if (monthGoal) return monthGoal.daily_target_value;
    // Fallback
    return Math.round(getMonthlyGoalValue(month) / 22); // ~22 business days avg
  }

  // Helper to sum quarterly goals from monthly goals
  function getQuarterlyGoal(quarterStartMonth: number): number {
    return getMonthlyGoalValue(quarterStartMonth) +
           getMonthlyGoalValue(quarterStartMonth + 1) +
           getMonthlyGoalValue(quarterStartMonth + 2);
  }

  // Calculate goal based on period - use monthly_goals for accurate pacing
  function getPeriodGoal(): { goal: number; label: string; reviewsInPeriod: number; dailyTarget: number } {
    const yearGoal = stats.period_goal!; // We know it's not null from check above

    // Get quarter number from a date
    const getQuarter = (date: Date) => Math.floor(date.getMonth() / 3) + 1;
    const getQuarterStartMonth = (date: Date) => Math.floor(date.getMonth() / 3) * 3 + 1;

    switch (period) {
      case 'this_month': {
        const monthNum = periodDates.start.getMonth() + 1;
        const goal = getMonthlyGoalValue(monthNum);
        const dailyTarget = getDailyTargetValue(monthNum);
        const monthName = periodDates.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return { goal, label: `${monthName} Goal`, reviewsInPeriod: stats.reviews_this_period, dailyTarget };
      }
      case 'last_month': {
        const monthNum = periodDates.start.getMonth() + 1;
        const goal = getMonthlyGoalValue(monthNum);
        const dailyTarget = getDailyTargetValue(monthNum);
        const monthName = periodDates.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return { goal, label: `${monthName} Goal`, reviewsInPeriod: stats.reviews_this_period, dailyTarget };
      }
      case 'last_30': {
        // Use current month's goal for rolling 30-day period
        const monthNum = now.getMonth() + 1;
        const goal = getMonthlyGoalValue(monthNum);
        const dailyTarget = getDailyTargetValue(monthNum);
        return { goal, label: 'Last 30 Days Goal', reviewsInPeriod: stats.reviews_this_period, dailyTarget };
      }
      case 'last_90': {
        // Sum 3 months for rolling 90-day period
        const currentMonth = now.getMonth() + 1;
        const goal = getMonthlyGoalValue(currentMonth) +
                     getMonthlyGoalValue(currentMonth - 1 > 0 ? currentMonth - 1 : 12) +
                     getMonthlyGoalValue(currentMonth - 2 > 0 ? currentMonth - 2 : 11);
        const dailyTarget = getDailyTargetValue(currentMonth);
        return { goal, label: 'Last 90 Days Goal', reviewsInPeriod: stats.reviews_this_period, dailyTarget };
      }
      case 'this_quarter': {
        const q = getQuarter(periodDates.start);
        const year = periodDates.start.getFullYear();
        const quarterStart = getQuarterStartMonth(periodDates.start);
        const goal = getQuarterlyGoal(quarterStart);
        const dailyTarget = getDailyTargetValue(now.getMonth() + 1);
        return { goal, label: `Q${q} ${year} Goal`, reviewsInPeriod: stats.reviews_this_period, dailyTarget };
      }
      case 'last_quarter': {
        const q = getQuarter(periodDates.start);
        const year = periodDates.start.getFullYear();
        const quarterStart = getQuarterStartMonth(periodDates.start);
        const goal = getQuarterlyGoal(quarterStart);
        const dailyTarget = getDailyTargetValue(quarterStart + 1); // middle month of quarter
        return { goal, label: `Q${q} ${year} Goal`, reviewsInPeriod: stats.reviews_this_period, dailyTarget };
      }
      case 'this_year': {
        const dailyTarget = getDailyTargetValue(now.getMonth() + 1);
        return { goal: yearGoal, label: `${periodDates.start.getFullYear()} Goal`, reviewsInPeriod: stats.reviews_this_year, dailyTarget };
      }
      case 'last_year': {
        const dailyTarget = Math.round(yearGoal / 260); // ~260 business days/year
        return { goal: yearGoal, label: `${periodDates.start.getFullYear()} Goal`, reviewsInPeriod: stats.reviews_this_period, dailyTarget };
      }
      case 'all_time': {
        const dailyTarget = getDailyTargetValue(now.getMonth() + 1);
        return { goal: stats.year_goal, label: `${now.getFullYear()} Goal`, reviewsInPeriod: stats.reviews_this_year, dailyTarget };
      }
      case 'custom': {
        // Pro-rate goal based on custom period length using monthly goals
        const startMonth = periodDates.start.getMonth() + 1;
        const endMonth = periodDates.end.getMonth() + 1;
        let goal = 0;
        for (let m = startMonth; m <= endMonth; m++) {
          goal += getMonthlyGoalValue(m);
        }
        const dailyTarget = getDailyTargetValue(endMonth);
        const startLabel = periodDates.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endLabel = periodDates.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { goal, label: `${startLabel} - ${endLabel} Goal`, reviewsInPeriod: stats.reviews_this_period, dailyTarget };
      }
      default: {
        const monthNum = now.getMonth() + 1;
        return { goal: getMonthlyGoalValue(monthNum), label: 'Goal', reviewsInPeriod: stats.reviews_this_period, dailyTarget: getDailyTargetValue(monthNum) };
      }
    }
  }

  const { goal, label, reviewsInPeriod, dailyTarget } = getPeriodGoal();
  const currentPercent = Math.min((reviewsInPeriod / goal) * 100, 100);

  // Get the FULL period end date for calculating expected progress
  // (periodDates.end might be truncated to "now" for current periods)
  function getFullPeriodEnd(): Date {
    const year = periodDates.start.getFullYear();
    const month = periodDates.start.getMonth();
    switch (period) {
      case 'this_month':
        return new Date(year, month + 1, 0); // Last day of the month
      case 'this_quarter': {
        const quarterEnd = Math.floor(month / 3) * 3 + 2; // 0->2, 3->5, 6->8, 9->11
        return new Date(year, quarterEnd + 1, 0);
      }
      case 'this_year':
        return new Date(year, 11, 31);
      case 'last_30':
      case 'last_90':
        return periodDates.end; // These are rolling periods ending at now
      default:
        return periodDates.end;
    }
  }

  const fullPeriodEnd = getFullPeriodEnd();
  const totalPeriodDays = Math.ceil((fullPeriodEnd.getTime() - periodDates.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysElapsed = Math.ceil((now.getTime() - periodDates.start.getTime()) / (1000 * 60 * 60 * 24));

  const isPastPeriod = period === 'last_month' || period === 'last_quarter' || period === 'last_year';
  const expectedPercent = isPastPeriod
    ? 100 // Past periods should be at 100%
    : Math.min((daysElapsed / totalPeriodDays) * 100, 100);

  const isAhead = currentPercent >= expectedPercent;
  const difference = Math.abs(currentPercent - expectedPercent);

  // Calculate business days remaining in the FULL period
  const businessDaysRemaining = fullPeriodEnd > now ? getBusinessDays(now, fullPeriodEnd) : 0;
  const reviewsNeeded = Math.max(0, goal - reviewsInPeriod);
  const perBusinessDayNeeded = businessDaysRemaining > 0 ? (reviewsNeeded / businessDaysRemaining).toFixed(1) : '0';

  // For past periods, show completion status instead of pacing

  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>{label}</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{reviewsInPeriod.toLocaleString()} of {goal.toLocaleString()} reviews</p>
        </div>
        {isPastPeriod ? (
          <div
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: reviewsInPeriod >= goal ? 'rgba(52, 102, 67, 0.3)' : 'rgba(239, 68, 68, 0.2)',
              color: reviewsInPeriod >= goal ? 'var(--christmas-green)' : '#EF4444',
            }}
          >
            {reviewsInPeriod >= goal ? 'Goal Met' : `${(goal - reviewsInPeriod)} short`}
          </div>
        ) : (
          <div
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: isAhead ? 'rgba(52, 102, 67, 0.3)' : 'rgba(239, 68, 68, 0.2)',
              color: isAhead ? 'var(--christmas-green)' : '#EF4444',
            }}
          >
            {isAhead ? '↑' : '↓'} {difference.toFixed(1)}% {isAhead ? 'ahead' : 'behind'}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div
        className="relative h-8 rounded-full overflow-hidden mb-3"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
      >
        {/* Current progress */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
          style={{
            width: `${Math.max(currentPercent, 8)}%`,
            background: isAhead || isPastPeriod && reviewsInPeriod >= goal
              ? 'linear-gradient(90deg, #2d5a3d 0%, #346643 100%)'
              : 'linear-gradient(90deg, #dc2626 0%, #f87171 100%)',
          }}
        >
          <span className="text-xs font-bold text-white">{currentPercent.toFixed(0)}%</span>
        </div>
        {/* Expected marker - only show for current periods */}
        {!isPastPeriod && expectedPercent > 0 && expectedPercent < 100 && (
          <div
            className="absolute inset-y-0 w-0.5"
            style={{ left: `${expectedPercent}%`, backgroundColor: 'var(--christmas-gold)' }}
          >
            <div
              className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap"
              style={{ color: 'var(--christmas-gold)' }}
            >
              Expected
            </div>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-sm">
        <div style={{ color: 'var(--text-muted)' }}>
          <span className="font-medium" style={{ color: 'var(--christmas-cream)' }}>{reviewsNeeded.toLocaleString()}</span> {isPastPeriod ? 'short of goal' : 'to go'}
        </div>
        {!isPastPeriod && businessDaysRemaining > 0 && (
          <>
            <div style={{ color: 'var(--text-muted)' }}>
              Target: <span className="font-medium" style={{ color: 'var(--christmas-cream)' }}>{dailyTarget}</span>/day
              {parseFloat(perBusinessDayNeeded) > dailyTarget && (
                <span className="ml-1" style={{ color: '#EF4444' }}>(need {perBusinessDayNeeded})</span>
              )}
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              <span className="font-medium" style={{ color: 'var(--christmas-cream)' }}>{businessDaysRemaining}</span> business days left
            </div>
          </>
        )}
        {isPastPeriod && (
          <div style={{ color: 'var(--text-muted)' }}>
            {reviewsInPeriod >= goal
              ? <span className="font-medium" style={{ color: 'var(--christmas-green)' }}>+{reviewsInPeriod - goal} over goal</span>
              : <span className="font-medium" style={{ color: '#EF4444' }}>{((reviewsInPeriod / goal) * 100).toFixed(0)}% of goal</span>
            }
          </div>
        )}
      </div>
    </div>
  );
}

function LocationsTable({ locations }: { locations: LocationStats[] }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>By Location</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs" style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
              <th className="text-left py-2 px-4 font-medium">Location</th>
              <th className="text-right py-2 px-4 font-medium">Rating</th>
              <th className="text-right py-2 px-4 font-medium">This Period</th>
              <th className="text-right py-2 px-4 font-medium">All Time</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((location, index) => {
              const changePercent = location.period_change_percent;
              const isPositive = changePercent !== null && changePercent > 0;
              const isNegative = changePercent !== null && changePercent < 0;

              return (
                <tr
                  key={location.id}
                  className="transition-colors hover:opacity-80"
                  style={{
                    borderBottom: index < locations.length - 1 ? '1px solid rgba(212, 197, 169, 0.1)' : 'none',
                  }}
                >
                  <td className="py-2.5 px-4">
                    <span className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>{location.short_name}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <span className="text-sm" style={{ color: 'var(--christmas-gold)' }}>{location.average_rating.toFixed(1)} ★</span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <span className="text-sm font-medium" style={{ color: 'var(--christmas-green)' }}>{location.reviews_this_period}</span>
                    {changePercent !== null && (
                      <span
                        className="text-xs ml-1"
                        style={{
                          color: isPositive ? 'var(--christmas-green)' : isNegative ? '#EF4444' : 'var(--text-muted)'
                        }}
                      >
                        {isPositive ? '+' : ''}{Math.round(changePercent)}%
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <span className="text-sm" style={{ color: 'var(--christmas-cream)' }}>{location.total_reviews.toLocaleString()}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Leaderboard({ entries, loading }: { entries: LeaderboardEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <div
        className="rounded-xl p-6"
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-32 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div
        className="rounded-xl p-6"
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>Team Leaderboard</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No team member mentions found in reviews.</p>
      </div>
    );
  }

  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3, 10);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>Team Leaderboard</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Most mentioned in reviews</p>
      </div>

      {/* Top 3 Podium */}
      <div
        className="grid grid-cols-3 gap-2 p-3"
        style={{ background: 'linear-gradient(to bottom, rgba(52, 102, 67, 0.15), transparent)' }}
      >
        {/* Second Place */}
        <div className="text-center pt-2">
          {topThree[1] && (
            <>
              <div
                className="w-10 h-10 mx-auto rounded-full flex items-center justify-center text-lg font-bold mb-1"
                style={{ backgroundColor: 'rgba(212, 197, 169, 0.2)', color: 'var(--christmas-cream)' }}
              >
                {topThree[1].name.charAt(0)}
              </div>
              <div className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>{topThree[1].name}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{topThree[1].mention_count}</div>
              <div className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>2nd</div>
            </>
          )}
        </div>

        {/* First Place */}
        <div className="text-center">
          {topThree[0] && (
            <>
              <div
                className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-xl font-bold mb-1"
                style={{
                  background: 'linear-gradient(135deg, #c9a227, #8b7355)',
                  color: 'white',
                  boxShadow: '0 0 0 2px rgba(201, 162, 39, 0.4)',
                }}
              >
                {topThree[0].name.charAt(0)}
              </div>
              <div className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>{topThree[0].name}</div>
              <div className="text-xs" style={{ color: 'var(--christmas-gold)' }}>{topThree[0].mention_count}</div>
              <div className="text-sm font-bold" style={{ color: 'var(--christmas-gold)' }}>1st</div>
            </>
          )}
        </div>

        {/* Third Place */}
        <div className="text-center pt-3">
          {topThree[2] && (
            <>
              <div
                className="w-9 h-9 mx-auto rounded-full flex items-center justify-center text-base font-bold mb-1"
                style={{ backgroundColor: 'rgba(139, 115, 85, 0.3)', color: '#8b7355' }}
              >
                {topThree[2].name.charAt(0)}
              </div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{topThree[2].name}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{topThree[2].mention_count}</div>
              <div className="text-sm font-bold" style={{ color: '#8b7355' }}>3rd</div>
            </>
          )}
        </div>
      </div>

      {/* Rest of the list */}
      {rest.length > 0 && (
        <div>
          {rest.map((entry, index) => (
            <div
              key={entry.name}
              className="flex items-center justify-between px-5 py-2 transition-colors hover:opacity-80"
              style={{ borderTop: '1px solid rgba(212, 197, 169, 0.1)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs w-4" style={{ color: 'var(--text-muted)' }}>{index + 4}.</span>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                  style={{ backgroundColor: 'rgba(0,0,0,0.3)', color: 'var(--text-muted)' }}
                >
                  {entry.name.charAt(0)}
                </div>
                <span className="text-sm" style={{ color: 'var(--christmas-cream)' }}>{entry.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--christmas-gold)' }}>{entry.five_star_count} ★5</span>
                <span className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>{entry.mention_count}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  const timeAgo = useMemo(() => {
    const now = new Date();
    const reviewDate = new Date(review.create_time);
    const diffMs = now.getTime() - reviewDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  }, [review.create_time]);

  // Check if text is truncated on mount and resize
  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current) {
        setIsTruncated(textRef.current.scrollHeight > textRef.current.clientHeight);
      }
    };
    checkTruncation();
    window.addEventListener('resize', checkTruncation);
    return () => window.removeEventListener('resize', checkTruncation);
  }, [review.comment]);

  const hasTeamMentions = review.team_members_mentioned && review.team_members_mentioned.length > 0;

  return (
    <div
      className="p-4 last:border-b-0 transition-colors hover:opacity-90"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0"
            style={{ backgroundColor: 'rgba(52, 102, 67, 0.3)', color: 'var(--christmas-green)' }}
          >
            {review.reviewer_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate" style={{ color: 'var(--christmas-cream)' }}>{review.reviewer_name}</span>
              <StarRating rating={review.star_rating} />
            </div>
            <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              <span>{timeAgo}</span>
              <span>&middot;</span>
              <span>{review.location.short_name}</span>
            </div>
            {review.comment && (
              <div className="mt-2">
                <p
                  ref={textRef}
                  className={`text-sm transition-all duration-200 ${
                    isExpanded ? '' : 'line-clamp-2'
                  }`}
                  style={{ color: 'var(--christmas-cream)', opacity: 0.9 }}
                >
                  {review.comment}
                </p>
                {(isTruncated || isExpanded) && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs mt-1 font-medium transition-colors hover:opacity-80"
                    style={{ color: 'var(--christmas-green)' }}
                  >
                    {isExpanded ? '← Read less' : 'Read more →'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {hasTeamMentions && (
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                backgroundColor: 'rgba(201, 162, 39, 0.2)',
                color: 'var(--christmas-gold)',
                border: '1px solid rgba(201, 162, 39, 0.3)',
              }}
            >
              {review.team_members_mentioned!.join(', ')}
            </span>
          )}
          {review.review_reply ? (
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                backgroundColor: 'rgba(52, 102, 67, 0.2)',
                color: 'var(--christmas-green)',
                border: '1px solid rgba(52, 102, 67, 0.3)',
              }}
            >
              Replied
            </span>
          ) : (
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#EF4444',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
            >
              Needs Reply
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Client-side cache for stats (persists across component renders)
const statsCache = new Map<string, { data: ReviewStats; timestamp: number }>();
const reviewsCache = new Map<string, { data: Review[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minute client cache

export default function ReviewsPage() {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodPreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [syncing, setSyncing] = useState(false);
  const [showTeamMentionsOnly, setShowTeamMentionsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  const periodDates = getPeriodDates(period, customStartDate || undefined, customEndDate || undefined);

  // Generate cache keys
  const statsCacheKey = useMemo(() =>
    `stats-${period}-${customStartDate?.toISOString()}-${customEndDate?.toISOString()}`,
    [period, customStartDate, customEndDate]
  );

  const reviewsCacheKey = useMemo(() =>
    `reviews-${period}-${customStartDate?.toISOString()}-${customEndDate?.toISOString()}-${selectedLocation}-${ratingFilter}-${showTeamMentionsOnly}-${debouncedSearch}`,
    [period, customStartDate, customEndDate, selectedLocation, ratingFilter, showTeamMentionsOnly, debouncedSearch]
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch stats with caching
  useEffect(() => {
    async function fetchStats() {
      // Check client cache first
      const cached = statsCache.get(statsCacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setStats(cached.data);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({
          year: new Date().getFullYear().toString(),
          periodStart: periodDates.start.toISOString(),
          periodEnd: periodDates.end.toISOString(),
        });

        const response = await fetch(`/api/reviews/stats?${params}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
          // Cache the result
          statsCache.set(statsCacheKey, { data, timestamp: Date.now() });
        } else {
          console.error('Stats API error:', response.status, await response.text());
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [period, customStartDate, customEndDate, statsCacheKey]);

  // Fetch leaderboard
  useEffect(() => {
    async function fetchLeaderboard() {
      setLeaderboardLoading(true);
      try {
        const params = new URLSearchParams({
          year: new Date().getFullYear().toString(),
        });

        const response = await fetch(`/api/reviews/leaderboard?${params}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setLeaderboard(data.leaderboard || []);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setLeaderboardLoading(false);
      }
    }

    fetchLeaderboard();
  }, []);

  // Fetch reviews with caching
  useEffect(() => {
    async function fetchReviews() {
      // Check client cache first
      const cached = reviewsCache.get(reviewsCacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setReviews(cached.data);
        setReviewsLoading(false);
        return;
      }

      setReviewsLoading(true);
      try {
        const params = new URLSearchParams({
          limit: '50',
          startDate: periodDates.start.toISOString(),
          endDate: periodDates.end.toISOString(),
        });

        if (selectedLocation !== 'all') {
          params.set('locationId', selectedLocation);
        }

        if (ratingFilter !== 'all') {
          params.set('rating', ratingFilter);
        }

        if (showTeamMentionsOnly) {
          params.set('hasTeamMention', 'true');
        }

        if (debouncedSearch.trim()) {
          params.set('search', debouncedSearch.trim());
        }

        const response = await fetch(`/api/reviews?${params}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setReviews(data.reviews || []);
          // Cache the result
          reviewsCache.set(reviewsCacheKey, { data: data.reviews || [], timestamp: Date.now() });
        }
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      } finally {
        setReviewsLoading(false);
      }
    }

    fetchReviews();
  }, [period, customStartDate, customEndDate, selectedLocation, ratingFilter, showTeamMentionsOnly, debouncedSearch, reviewsCacheKey]);

  // Sync reviews - clears cache and reloads
  async function handleSync() {
    setSyncing(true);
    try {
      const response = await fetch('/api/reviews/sync', { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        // Clear all caches before reload
        statsCache.clear();
        reviewsCache.clear();
        window.location.reload();
      } else {
        alert(`Sync failed: ${data.error}`);
      }
    } catch (error) {
      alert('Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  // Calculate period change
  const periodTotalChange = useMemo(() => {
    if (!stats?.locations) return null;
    const total = stats.locations.reduce((sum, loc) => {
      if (loc.period_change_percent !== null) {
        return sum + loc.reviews_this_period;
      }
      return sum;
    }, 0);
    const prevTotal = stats.locations.reduce((sum, loc) => {
      if (loc.period_change_percent !== null && loc.period_change_percent !== 100) {
        return sum + Math.round(loc.reviews_this_period / (1 + loc.period_change_percent / 100));
      }
      return sum;
    }, 0);
    if (prevTotal === 0) return null;
    return ((total - prevTotal) / prevTotal) * 100;
  }, [stats]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }} />
            ))}
          </div>
          <div className="h-72 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }} />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p style={{ color: 'var(--text-muted)' }}>Failed to load review data</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>Google Reviews</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{getPeriodLabel(period, customStartDate || undefined, customEndDate || undefined)}</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => {
              const newPeriod = e.target.value as PeriodPreset;
              setPeriod(newPeriod);
              if (newPeriod !== 'custom') {
                setCustomStartDate(null);
                setCustomEndDate(null);
              }
            }}
            className="px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--christmas-cream)',
            }}
          >
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="last_30">Last 30 Days</option>
            <option value="last_90">Last 90 Days</option>
            <option value="this_quarter">This Quarter</option>
            <option value="last_quarter">Last Quarter</option>
            <option value="this_year">This Year</option>
            <option value="last_year">Last Year</option>
            <option value="all_time">All Time</option>
            <option value="custom">Custom Range</option>
          </select>

          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate ? customStartDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setCustomStartDate(e.target.value ? new Date(e.target.value) : null)}
                className="px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--christmas-cream)',
                }}
              />
              <span style={{ color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                value={customEndDate ? customEndDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setCustomEndDate(e.target.value ? new Date(e.target.value) : null)}
                className="px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--christmas-cream)',
                }}
              />
            </div>
          )}

          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-2 disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: 'var(--christmas-green)' }}
          >
            {syncing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing
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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Reviews This Period"
          value={stats.reviews_this_period}
          changePercent={periodTotalChange}
          highlight
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          }
        />
        <StatCard
          label="Average Rating"
          value={stats.average_rating.toFixed(2)}
          subtext="across all locations"
          icon={
            <svg className="w-5 h-5" fill="#FBBF24" viewBox="0 0 24 24">
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          }
        />
        <StatCard
          label={`${stats.period_year} Progress`}
          value={stats.period_goal !== null
            ? `${stats.reviews_this_period.toLocaleString()} / ${stats.period_goal.toLocaleString()}`
            : '-'
          }
          subtext={stats.period_goal !== null
            ? `${Math.round((stats.reviews_this_period / stats.period_goal) * 100)}% of goal`
            : 'No goal set'
          }
          changePercent={stats.period_goal !== null ? stats.pacing_difference_percent : undefined}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        <StatCard
          label="Total Reviews"
          value={stats.total_reviews.toLocaleString()}
          subtext="all-time across locations"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
      </div>

      {/* Goal Progress */}
      <div className="mb-6">
        <GoalProgress stats={stats} period={period} periodDates={periodDates} />
      </div>

      {/* Chart - Full Width */}
      <div className="mb-6">
        <ReviewsChart data={stats.daily_counts} period={period} />
      </div>

      {/* Leaderboard and Locations Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Leaderboard entries={leaderboard} loading={leaderboardLoading} />
        <LocationsTable locations={stats.locations} />
      </div>

      {/* Reviews */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>Reviews</h3>
            <div className="flex items-center gap-3">
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm focus:outline-none"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--christmas-cream)',
                }}
              >
                <option value="all">All Locations</option>
                {stats.locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.short_name}
                  </option>
                ))}
              </select>

              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm focus:outline-none"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--christmas-cream)',
                }}
              >
                <option value="all">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>

              <button
                onClick={() => setShowTeamMentionsOnly(!showTeamMentionsOnly)}
                className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: showTeamMentionsOnly ? 'var(--christmas-gold)' : 'rgba(0,0,0,0.3)',
                  border: showTeamMentionsOnly ? 'none' : '1px solid var(--border-subtle)',
                  color: showTeamMentionsOnly ? '#1a2e1f' : 'var(--christmas-cream)',
                }}
              >
                Team Mentions
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--text-muted)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reviews by name, keyword, or tech..."
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--christmas-cream)',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {reviewsLoading ? (
            <div className="p-8 text-center">
              <div
                className="animate-spin w-6 h-6 mx-auto rounded-full border-2 border-t-transparent"
                style={{ borderColor: 'var(--christmas-green)', borderTopColor: 'transparent' }}
              />
            </div>
          ) : reviews.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              No reviews found for the selected filters
            </div>
          ) : (
            reviews.map((review) => <ReviewCard key={review.id} review={review} />)
          )}
        </div>
      </div>
    </div>
  );
}
