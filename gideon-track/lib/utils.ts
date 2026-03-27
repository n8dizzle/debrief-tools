export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getEffectiveThreshold(
  booklet: { passing_threshold_override: number | null },
  series: { passing_threshold_override: number | null },
  level: { passing_threshold: number }
): number {
  return booklet.passing_threshold_override
    ?? series.passing_threshold_override
    ?? level.passing_threshold;
}

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
