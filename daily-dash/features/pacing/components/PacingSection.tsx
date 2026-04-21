'use client';

interface PeriodData {
  revenue: number;
  sales: number;
  target: number;
  pacing?: number;
}

interface PacingSectionData {
  today: PeriodData;
  week: PeriodData;
  month: PeriodData;
  quarter: PeriodData;
}

interface PacingSectionProps {
  data: PacingSectionData;
  title?: string;
}

function formatCurrencyCompact(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

function getStatusColor(actualPct: number, expectedPct?: number): string {
  if (expectedPct !== undefined && expectedPct > 0) {
    const ratio = actualPct / expectedPct;
    if (ratio >= 1) return 'var(--christmas-green)';
    if (ratio >= 0.9) return 'var(--christmas-gold)';
    return '#EF4444';
  }
  if (actualPct >= 100) return 'var(--christmas-green)';
  if (actualPct >= 90) return 'var(--christmas-gold)';
  return '#EF4444';
}

function getPacingLabel(actualPct: number, expectedPct: number): { text: string; color: string } {
  if (expectedPct <= 0) return { text: '', color: 'var(--text-muted)' };
  const ratio = actualPct / expectedPct;
  if (ratio >= 1) return { text: '▲ On track', color: 'var(--christmas-green)' };
  if (ratio >= 0.9) return { text: '▶ Slightly behind', color: 'var(--christmas-gold)' };
  return { text: '▼ Behind pace', color: '#EF4444' };
}

function PacingCard({ label, revenue, sales, target, pacing }: {
  label: string;
  revenue: number;
  sales: number;
  target: number;
  pacing?: number;
}) {
  const pct = target > 0 ? Math.round((revenue / target) * 100) : 0;
  const color = getStatusColor(pct, pacing);
  const pacingInfo = pacing !== undefined ? getPacingLabel(pct, pacing) : null;

  return (
    <div
      className="relative p-4 sm:p-5 rounded-xl"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      {/* Badge */}
      <div
        className="absolute top-3 sm:top-4 right-3 sm:right-4 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {pct}%
      </div>

      {/* Label */}
      <p className="text-xs sm:text-sm font-medium mb-3 sm:mb-4 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>

      {/* Revenue | Sales centered */}
      <div className="flex items-center justify-center mb-3">
        <div className="flex-1 text-center">
          <span className="text-xl sm:text-2xl font-bold block whitespace-nowrap" style={{ color: 'var(--christmas-cream)' }}>
            {formatCurrencyCompact(revenue)}
          </span>
          <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Revenue</span>
        </div>
        <div className="w-px h-10 flex-shrink-0" style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.5 }} />
        <div className="flex-1 text-center">
          <span className="text-xl sm:text-2xl font-bold block whitespace-nowrap" style={{ color: 'var(--christmas-gold)' }}>
            {formatCurrencyCompact(sales)}
          </span>
          <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Sales</span>
        </div>
      </div>

      <div className="h-px w-full mb-2" style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.3 }} />

      {/* Target */}
      <p className="text-xs mb-2 truncate" style={{ color: 'var(--text-muted)' }}>
        of {formatCurrencyCompact(target)} target
      </p>

      {/* Progress bar */}
      <div className="relative h-1.5 rounded-full overflow-visible" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
        {pacing !== undefined && pacing > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 transition-all duration-300"
            style={{ left: `${Math.min(pacing, 100)}%`, backgroundColor: 'var(--christmas-cream)', opacity: 0.9 }}
          />
        )}
      </div>

      {/* Pacing label */}
      {pacingInfo && pacingInfo.text && (
        <div className="flex items-center justify-between mt-2 gap-1">
          <span className="text-[10px] whitespace-nowrap" style={{ color: pacingInfo.color }}>
            {pacingInfo.text}
          </span>
          {pacing !== undefined && (
            <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
              {pacing}% exp
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function PacingSection({ data, title = 'Goal Pacing' }: PacingSectionProps) {
  return (
    <div
      className="rounded-xl p-6"
      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(93, 138, 102, 0.2)' }}>
          <svg className="w-4 h-4" fill="none" stroke="var(--christmas-green)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>{title}</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PacingCard label="Today" {...data.today} />
        <PacingCard label="This Week" {...data.week} />
        <PacingCard label="This Month" {...data.month} />
        <PacingCard label="This Quarter" {...data.quarter} />
      </div>
    </div>
  );
}
