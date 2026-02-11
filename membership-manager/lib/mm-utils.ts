/**
 * Utility functions for Membership Manager
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
 * Format a date string for display
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
 * Calculate days between two dates (positive = future, negative = past)
 */
export function daysBetween(dateStr: string, referenceDate?: Date): number {
  const date = new Date(dateStr + 'T00:00:00');
  const ref = referenceDate || new Date();
  ref.setHours(0, 0, 0, 0);
  const diff = date.getTime() - ref.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get urgency level for a visit based on days overdue
 */
export function getVisitUrgency(daysOverdue: number): 'overdue' | 'due-soon' | 'on-track' {
  if (daysOverdue < 0) return 'overdue';
  if (daysOverdue <= 14) return 'due-soon';
  return 'on-track';
}

/**
 * Get display color for urgency level
 */
export function getUrgencyColor(urgency: 'overdue' | 'due-soon' | 'on-track'): string {
  switch (urgency) {
    case 'overdue': return 'var(--status-error)';
    case 'due-soon': return 'var(--status-warning)';
    case 'on-track': return 'var(--status-success)';
  }
}

/**
 * Determine trade from service name
 */
export function getTradeFromServiceName(name: string): 'hvac' | 'plumbing' | 'unknown' {
  const lower = name.toLowerCase();
  if (lower.includes('plumb') || lower.includes('drain') || lower.includes('water heater')) {
    return 'plumbing';
  }
  if (lower.includes('hvac') || lower.includes('heat') || lower.includes('cool') || lower.includes('furnace') || lower.includes('ac') || lower.includes('a/c') || lower.includes('tune')) {
    return 'hvac';
  }
  return 'unknown';
}

/**
 * Get status badge styles
 */
export function getStatusBadgeStyle(status: string): { background: string; color: string } {
  switch (status.toLowerCase()) {
    case 'active':
      return { background: 'rgba(34, 197, 94, 0.15)', color: 'var(--status-success)' };
    case 'expired':
    case 'cancelled':
    case 'canceled':
      return { background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-error)' };
    case 'suspended':
      return { background: 'rgba(234, 179, 8, 0.15)', color: 'var(--status-warning)' };
    default:
      return { background: 'rgba(107, 124, 110, 0.15)', color: 'var(--text-muted)' };
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
