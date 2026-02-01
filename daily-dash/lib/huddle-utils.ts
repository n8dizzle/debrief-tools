import { HuddleKPIStatus, HuddleKPIFormat } from './supabase';

/**
 * Calculate status based on percent to goal
 * @param percentToGoal - The percentage achieved (e.g., 95 for 95%)
 * @param higherIsBetter - Whether higher values are better (true for most KPIs, false for things like Abandon Rate)
 * @returns The status: 'met', 'close', 'missed', or 'pending'
 */
export function getStatusFromPercentage(
  percentToGoal: number | null,
  higherIsBetter: boolean = true
): HuddleKPIStatus {
  if (percentToGoal === null) return 'pending';

  if (higherIsBetter) {
    if (percentToGoal >= 100) return 'met';
    if (percentToGoal >= 85) return 'close';
    return 'missed';
  } else {
    // For metrics where lower is better (e.g., Abandon Rate, AR)
    if (percentToGoal <= 100) return 'met';
    if (percentToGoal <= 115) return 'close';
    return 'missed';
  }
}

/**
 * Status color mapping for CSS
 */
export const statusColors: Record<HuddleKPIStatus, string> = {
  met: 'var(--christmas-green)',
  close: 'var(--christmas-gold)',
  missed: '#dc2626', // red-600
  pending: 'var(--text-muted)',
};

/**
 * Status background colors for cells
 */
export const statusBackgrounds: Record<HuddleKPIStatus, string> = {
  met: 'rgba(93, 138, 102, 0.2)', // christmas-green with opacity
  close: 'rgba(184, 149, 107, 0.2)', // christmas-gold with opacity
  missed: 'rgba(220, 38, 38, 0.2)', // red with opacity
  pending: 'transparent',
};

/**
 * Format a value based on its KPI format type
 */
export function formatKPIValue(
  value: number | null | undefined,
  format: HuddleKPIFormat,
  unit: string = ''
): string {
  if (value === null || value === undefined) return '-';

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);

    case 'percent':
      return `${value.toFixed(1)}%`;

    case 'number':
      if (unit === 'sec' || unit === 'secs') {
        return `${value}s`;
      }
      return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 1,
      }).format(value);

    case 'boolean':
      return value ? 'Yes' : 'No';

    case 'text':
      return String(value);

    case 'time':
      // Format as minutes:seconds if value is in seconds
      const mins = Math.floor(value / 60);
      const secs = Math.round(value % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;

    default:
      return String(value);
  }
}

/**
 * Format percent to goal for display
 */
export function formatPercentToGoal(percent: number | null): string {
  if (percent === null) return '-';
  return `${percent.toFixed(0)}%`;
}

/**
 * Calculate percent to goal
 */
export function calculatePercentToGoal(
  actual: number | null,
  target: number | null,
  higherIsBetter: boolean = true
): number | null {
  if (actual === null || target === null || target === 0) return null;

  if (higherIsBetter) {
    return (actual / target) * 100;
  } else {
    // For metrics where lower is better, invert the calculation
    // If actual is lower than target, that's good (> 100%)
    return (target / actual) * 100;
  }
}

/**
 * Get business days remaining in the month
 */
export function getBusinessDaysRemaining(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  const today = date.getDate();

  // Get last day of month
  const lastDay = new Date(year, month + 1, 0).getDate();

  let businessDays = 0;

  // Count business days from today to end of month (including today)
  for (let day = today; day <= lastDay; day++) {
    const d = new Date(year, month, day);
    const dayOfWeek = d.getDay();
    // Monday = 1, Saturday = 6, Sunday = 0
    // Include Saturday as a half business day (0.5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      businessDays += 1;
    } else if (dayOfWeek === 6) {
      businessDays += 0.5; // Saturday counts as half day
    }
  }

  return businessDays;
}

/**
 * Calculate daily pace needed to hit monthly goal
 */
export function calculateDailyPaceNeeded(
  monthlyTarget: number,
  currentTotal: number,
  businessDaysRemaining: number
): number {
  const remaining = monthlyTarget - currentTotal;
  if (businessDaysRemaining <= 0) return 0;
  return Math.max(0, remaining / businessDaysRemaining);
}

/**
 * Get today's date in YYYY-MM-DD format (Central Time)
 */
export function getTodayDateString(): string {
  const now = new Date();
  // Convert to Central Time
  const centralTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  return centralTime.toISOString().split('T')[0];
}

/**
 * Get yesterday's date in YYYY-MM-DD format (Central Time)
 */
export function getYesterdayDateString(): string {
  const now = new Date();
  const centralTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  centralTime.setDate(centralTime.getDate() - 1);
  return centralTime.toISOString().split('T')[0];
}

/**
 * Format date for display
 */
export function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Convert a Date object to YYYY-MM-DD string in Central Time
 * IMPORTANT: Always use this instead of toISOString().split('T')[0] to avoid timezone issues
 */
export function getLocalDateString(date: Date): string {
  // Convert to Central Time
  const centralTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const year = centralTime.getFullYear();
  const month = String(centralTime.getMonth() + 1).padStart(2, '0');
  const day = String(centralTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get date range for last N days
 */
export function getDateRange(days: number): { start: string; end: string; dates: string[] } {
  const end = getTodayDateString();
  const dates: string[] = [];

  const endDate = new Date(end + 'T12:00:00'); // Use noon to avoid any edge cases
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    dates.push(getLocalDateString(d));
  }

  return {
    start: dates[0],
    end: dates[dates.length - 1],
    dates,
  };
}
