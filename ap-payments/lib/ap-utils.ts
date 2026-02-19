/**
 * Utility functions for AP Payments
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
 * Format currency amount — use this everywhere instead of manual `$${...}`.
 * Handles null/undefined safely. Always produces "$1,234.56" format.
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Compact currency for chart ticks: "$1.2k", "$500"
 */
export function formatCurrencyCompact(v: number): string {
  if (v >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
}

/**
 * Format a rate per hour, e.g. "$25/hr"
 */
export function formatRate(rate: number | null | undefined): string {
  if (rate == null) return '—';
  return `${formatCurrency(rate)}/hr`;
}

/**
 * Format a date string for display
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
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
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get display label for assignment type
 */
export function getAssignmentLabel(type: string): string {
  switch (type) {
    case 'in_house': return 'In-House';
    case 'contractor': return 'Contractor';
    case 'unassigned':
    default: return 'Unassigned';
  }
}

/**
 * Get display label for payment status
 */
export function getPaymentStatusLabel(status: string): string {
  switch (status) {
    case 'received': return 'Received';
    case 'pending_approval': return 'Pending Approval';
    case 'ready_to_pay': return 'Ready to Pay';
    case 'paid': return 'Paid';
    case 'none':
    default: return 'None';
  }
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
