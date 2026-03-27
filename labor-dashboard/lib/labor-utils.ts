/**
 * Utility functions for Labor Dashboard
 */

/**
 * Format a local date (Central Time) without UTC conversion.
 * NEVER use toISOString().split('T')[0] — it converts to UTC.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date string in local time
 */
export function getTodayDateString(): string {
  return formatLocalDate(new Date());
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format currency compact (no decimals for large amounts)
 */
export function formatCurrencyCompact(amount: number | null | undefined): string {
  if (amount == null) return '$0';
  if (Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return formatCurrency(amount);
}

/**
 * Format a date string for display
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '\u2014';
  const date = new Date(dateStr + 'T00:00:00');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return '\u2014';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format hours with 1 decimal
 */
export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return '0.0';
  return hours.toFixed(1);
}

/**
 * Validate cron secret or session auth for API routes
 */
export function isValidCronRequest(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }
  return false;
}

/**
 * Determine trade from business unit name
 */
export function determineTradeFromBU(buName: string | null | undefined): 'hvac' | 'plumbing' | null {
  if (!buName) return null;
  const lower = buName.toLowerCase();
  if (lower.includes('plumb')) return 'plumbing';
  if (lower.includes('hvac') || lower.includes('air') || lower.includes('heat') || lower.includes('cool')) return 'hvac';
  return null;
}

/**
 * Get month label from YYYY-MM string
 */
export function getMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month) - 1]} ${year.slice(-2)}`;
}
