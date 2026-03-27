/**
 * Date utilities - always use local (Central) time, never UTC.
 */

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatLocalDateTime(date: Date): string {
  const dateStr = formatLocalDate(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${dateStr}T${hours}:${minutes}:${seconds}`;
}

/**
 * Get a date that is N hours ago from now, formatted for ST API (no Z suffix).
 */
export function getHoursAgo(hours: number): string {
  const date = new Date(Date.now() - hours * 60 * 60 * 1000);
  return formatLocalDateTime(date);
}

/**
 * Calculate hours elapsed since a given ISO date string.
 */
export function hoursElapsed(isoDateString: string): number {
  const created = new Date(isoDateString);
  const now = new Date();
  return (now.getTime() - created.getTime()) / (1000 * 60 * 60);
}

/**
 * Format hours as a human-readable duration (e.g., "2d 5h" or "3h 12m").
 */
export function formatDuration(hours: number): string {
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins}m`;
  }
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours - days * 24);
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}
