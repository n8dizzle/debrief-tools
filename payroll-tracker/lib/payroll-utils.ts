/**
 * Utility functions for Payroll Tracker.
 */

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateString(): string {
  return formatLocalDate(new Date());
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyCompact(v: number): string {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export function formatHours(hours: number): string {
  return hours.toFixed(1);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

export function formatTimestamp(ts: string): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function isValidCronRequest(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '');
  return token === process.env.CRON_SECRET;
}

export function getMonthToDateRange(): { start: string; end: string } {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const end = formatLocalDate(now);
  return { start, end };
}

/**
 * Get the Monday-Sunday pay week containing a given date.
 */
export function getPayWeek(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatLocalDate(monday), end: formatLocalDate(sunday) };
}

/**
 * Get preset pay period ranges (Mon-Sun weeks).
 */
export function getPayPeriodPresets(): { label: string; start: string; end: string }[] {
  const now = new Date();
  const thisWeek = getPayWeek(now);

  const lastWeekDate = new Date(now);
  lastWeekDate.setDate(now.getDate() - 7);
  const lastWeek = getPayWeek(lastWeekDate);

  const twoWeeksAgoDate = new Date(now);
  twoWeeksAgoDate.setDate(now.getDate() - 14);
  const twoWeeksAgo = getPayWeek(twoWeeksAgoDate);

  const threeWeeksAgoDate = new Date(now);
  threeWeeksAgoDate.setDate(now.getDate() - 21);
  const threeWeeksAgo = getPayWeek(threeWeeksAgoDate);

  // Last 4 weeks combined
  const last4Start = threeWeeksAgo.start;
  const last4End = lastWeek.end;

  return [
    { label: 'This Week', ...thisWeek },
    { label: 'Last Week', ...lastWeek },
    { label: '2 Weeks Ago', ...twoWeeksAgo },
    { label: '3 Weeks Ago', ...threeWeeksAgo },
    { label: 'Last 4 Weeks', start: last4Start, end: last4End },
  ];
}

/**
 * Get the current pay week as the default range.
 */
export function getCurrentPayWeekRange(): { start: string; end: string } {
  return getPayWeek(new Date());
}
