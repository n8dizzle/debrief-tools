// @homework/shared utils
// Formatting utilities for the Homework marketplace.
//
// CRITICAL: This company operates in Texas (Central Time).
// NEVER use toISOString().split('T')[0] for date formatting.
// Always use local date components (getFullYear, getMonth, getDate).

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

/**
 * Format an amount in cents to a dollar string.
 * Examples:
 *   formatCurrency(12500) -> "$125.00"
 *   formatCurrency(99)    -> "$0.99"
 *   formatCurrency(0)     -> "$0.00"
 */
export function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Format an amount in cents to a compact dollar string (no decimals for whole dollars).
 * Examples:
 *   formatCurrencyCompact(12500) -> "$125"
 *   formatCurrencyCompact(12550) -> "$125.50"
 *   formatCurrencyCompact(99)    -> "$0.99"
 */
export function formatCurrencyCompact(cents: number): string {
  const dollars = cents / 100;
  if (Number.isInteger(dollars)) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(dollars);
  }
  return formatCurrency(cents);
}

// ---------------------------------------------------------------------------
// Dates (Local Timezone - Central Time)
// ---------------------------------------------------------------------------

/**
 * Format a Date object to YYYY-MM-DD using LOCAL timezone components.
 * NEVER use toISOString().split('T')[0] which converts to UTC first.
 *
 * At 11pm Central on Jan 31, toISOString() would return "2026-02-01" (WRONG).
 * This function correctly returns "2026-01-31".
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as YYYY-MM-DD in local timezone.
 */
export function getTodayDateString(): string {
  return formatLocalDate(new Date());
}

/**
 * Get yesterday's date as YYYY-MM-DD in local timezone.
 */
export function getYesterdayDateString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatLocalDate(yesterday);
}

/**
 * Format a date/timestamp string for display.
 * Input can be an ISO string from Supabase (timestamptz).
 *
 * Examples:
 *   formatDate('2026-02-12T14:30:00Z')           -> "Feb 12, 2026"
 *   formatDate('2026-02-12T14:30:00Z', true)      -> "Feb 12, 2026 at 8:30 AM"
 *   formatDate('2026-02-12T14:30:00Z', true, true) -> "Feb 12, 2026 at 8:30 AM CST"
 */
export function formatDate(
  dateString: string,
  includeTime = false,
  includeTimezone = false
): string {
  const date = new Date(dateString);

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Chicago',
  };

  if (includeTime) {
    options.hour = 'numeric';
    options.minute = '2-digit';
    options.hour12 = true;
  }

  if (includeTimezone) {
    options.timeZoneName = 'short';
  }

  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/**
 * Format a date as a relative time string.
 * Examples: "just now", "5 minutes ago", "2 hours ago", "3 days ago"
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  }
  if (diffDay < 365) {
    const months = Math.floor(diffDay / 30);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  }

  // Older than a year: show the full date
  return formatDate(dateString);
}

/**
 * Format a time string (HH:MM 24h) to 12-hour display.
 * Examples: "14:30" -> "2:30 PM", "08:00" -> "8:00 AM"
 */
export function formatTime(time24: string): string {
  const [hourStr, minuteStr] = time24.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr || '00';

  if (hour === 0) return `12:${minute} AM`;
  if (hour < 12) return `${hour}:${minute} AM`;
  if (hour === 12) return `12:${minute} PM`;
  return `${hour - 12}:${minute} PM`;
}

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

/**
 * Format a phone number for display.
 * Handles 10-digit US numbers with or without country code.
 *
 * Examples:
 *   formatPhone('2145551234')    -> "(214) 555-1234"
 *   formatPhone('+12145551234')  -> "(214) 555-1234"
 *   formatPhone('214-555-1234')  -> "(214) 555-1234"
 */
export function formatPhone(phone: string): string {
  // Strip everything except digits
  const digits = phone.replace(/\D/g, '');

  // Handle 11-digit (with leading 1) or 10-digit
  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;

  if (normalized.length !== 10) {
    // Can't format, return as-is
    return phone;
  }

  const area = normalized.slice(0, 3);
  const prefix = normalized.slice(3, 6);
  const line = normalized.slice(6, 10);

  return `(${area}) ${prefix}-${line}`;
}

/**
 * Normalize a phone number to E.164 format for storage.
 * Examples:
 *   normalizePhone('(214) 555-1234') -> '+12145551234'
 *   normalizePhone('214-555-1234')   -> '+12145551234'
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Can't normalize, return with + prefix
  return `+${digits}`;
}

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

/**
 * Format a numeric rating for display.
 * Examples:
 *   formatRating(4.5)  -> "4.5"
 *   formatRating(5)    -> "5.0"
 *   formatRating(3.75) -> "3.8"
 *   formatRating(null) -> "N/A"
 */
export function formatRating(rating: number | null | undefined): string {
  if (rating == null) return 'N/A';
  return rating.toFixed(1);
}

/**
 * Get a text description for a rating value.
 * 5 = Excellent, 4 = Great, 3 = Good, 2 = Fair, 1 = Poor
 */
export function getRatingLabel(rating: number): string {
  if (rating >= 4.5) return 'Excellent';
  if (rating >= 3.5) return 'Great';
  if (rating >= 2.5) return 'Good';
  if (rating >= 1.5) return 'Fair';
  return 'Poor';
}

// ---------------------------------------------------------------------------
// Slugify
// ---------------------------------------------------------------------------

/**
 * Convert a string to a URL-friendly slug.
 * Examples:
 *   slugify('AC Tune-Up')          -> "ac-tune-up"
 *   slugify('Water Heater Install') -> "water-heater-install"
 *   slugify('HVAC   Repair!!!')     -> "hvac-repair"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')    // Remove non-word chars (except spaces and hyphens)
    .replace(/[\s_]+/g, '-')     // Replace spaces and underscores with hyphens
    .replace(/-+/g, '-')         // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '');    // Trim leading/trailing hyphens
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/**
 * Truncate a string to a max length, adding ellipsis if truncated.
 * Examples:
 *   truncate('Hello world', 5)  -> "Hello..."
 *   truncate('Hi', 5)           -> "Hi"
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Generate a human-readable order number.
 * Format: HW-YYYYMMDD-XXXX (where XXXX is random hex)
 */
export function generateOrderNumber(): string {
  const dateStr = formatLocalDate(new Date()).replace(/-/g, '');
  const randomHex = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `HW-${dateStr}-${randomHex}`;
}

/**
 * Capitalize the first letter of each word.
 * Examples:
 *   titleCase('hello world') -> "Hello World"
 *   titleCase('HVAC repair') -> "HVAC Repair"
 */
export function titleCase(text: string): string {
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}
