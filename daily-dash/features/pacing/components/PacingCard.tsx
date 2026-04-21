'use client';

type PacingStatus = 'ahead' | 'on-track' | 'close' | 'behind';

interface PacingCardProps {
  label: string;
  current: number;
  target: number;
  format?: 'currency' | 'number' | 'percent';
  showStatus?: boolean;
}

function formatValue(value: number, format: string): string {
  switch (format) {
    case 'currency':
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
      }
      if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
      }
      return `$${value.toLocaleString()}`;
    case 'percent':
      return `${value.toFixed(1)}%`;
    default:
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toLocaleString();
  }
}

function getStatus(percent: number): PacingStatus {
  if (percent >= 100) return 'ahead';
  if (percent >= 90) return 'close';
  return 'behind';
}

function StatusBadge({ status }: { status: PacingStatus }) {
  const config: Record<PacingStatus, { label: string; bg: string; text: string }> = {
    ahead: {
      label: 'On track',
      bg: 'rgba(93, 138, 102, 0.2)',
      text: 'var(--christmas-green)',
    },
    'on-track': {
      label: 'Slightly behind',
      bg: 'rgba(184, 149, 107, 0.2)',
      text: 'var(--christmas-gold)',
    },
    close: {
      label: 'Slightly behind',
      bg: 'rgba(184, 149, 107, 0.2)',
      text: 'var(--christmas-gold)',
    },
    behind: {
      label: 'Behind pace',
      bg: 'rgba(239, 68, 68, 0.15)',
      text: '#EF4444',
    },
  };

  const { label, bg, text } = config[status];

  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}

export default function PacingCard({
  label,
  current,
  target,
  format = 'currency',
  showStatus = true,
}: PacingCardProps) {
  const percent = target > 0 ? (current / target) * 100 : 0;
  const status = getStatus(percent);
  const displayPercent = Math.min(percent, 100); // Cap visual at 100%

  // Determine progress bar color based on status
  const progressColor =
    status === 'ahead'
      ? 'var(--christmas-green)'
      : status === 'close' || status === 'on-track'
      ? 'var(--christmas-gold)'
      : '#EF4444';

  return (
    <div
      className="rounded-xl p-5 flex-1 min-w-[200px]"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Header with label and status */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        {showStatus && <StatusBadge status={status} />}
      </div>

      {/* Value display */}
      <div className="flex items-baseline gap-1.5 mb-4">
        <span
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--christmas-cream)' }}
        >
          {formatValue(current, format)}
        </span>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          / {formatValue(target, format)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${displayPercent}%`,
              backgroundColor: progressColor,
            }}
          />
        </div>

        {/* Percentage label */}
        <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {percent.toFixed(0)}% complete
        </div>
      </div>
    </div>
  );
}
