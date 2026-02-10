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
    case 'requested': return 'Requested';
    case 'approved': return 'Approved';
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
