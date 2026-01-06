'use client';

interface SummaryCardProps {
  icon: 'dollar' | 'percent' | 'trend' | 'calendar';
  label: string;
  value: string;
  subValue?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
  accentColor?: 'green' | 'gold' | 'blue';
}

function CardIcon({ type, color }: { type: string; color: string }) {
  const colorClasses: Record<string, string> = {
    green: 'var(--christmas-green)',
    gold: 'var(--christmas-gold)',
    blue: '#3B82F6',
  };

  const bgColor = colorClasses[color] || colorClasses.green;

  const icons: Record<string, JSX.Element> = {
    dollar: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    percent: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    trend: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    calendar: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  };

  return (
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center"
      style={{ backgroundColor: `${bgColor}20`, color: bgColor }}
    >
      {icons[type] || icons.dollar}
    </div>
  );
}

export default function SummaryCard({
  icon,
  label,
  value,
  subValue,
  trend,
  accentColor = 'green',
}: SummaryCardProps) {
  return (
    <div
      className="rounded-xl p-5 transition-all hover:scale-[1.02]"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <CardIcon type={icon} color={accentColor} />
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              trend.direction === 'up'
                ? 'text-green-400'
                : trend.direction === 'down'
                ? 'text-red-400'
                : 'text-gray-400'
            }`}
            style={{
              backgroundColor:
                trend.direction === 'up'
                  ? 'rgba(74, 222, 128, 0.1)'
                  : trend.direction === 'down'
                  ? 'rgba(248, 113, 113, 0.1)'
                  : 'rgba(156, 163, 175, 0.1)',
            }}
          >
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
            {trend.value}
          </div>
        )}
      </div>

      <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className="text-3xl font-bold tracking-tight"
          style={{ color: 'var(--christmas-cream)' }}
        >
          {value}
        </span>
        {subValue && (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
}
