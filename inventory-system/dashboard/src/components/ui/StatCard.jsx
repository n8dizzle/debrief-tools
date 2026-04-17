import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Metric stat card for the dashboard header row.
 *
 * Props:
 *   title      string   — e.g. "Materials Below Reorder"
 *   value      number   — the big number
 *   icon       ReactNode — Lucide icon element
 *   colorClass string   — Tailwind bg + text for icon box  e.g. "bg-amber-100 text-amber-600"
 *   trend      number   — positive = up, negative = down, 0 = flat (optional)
 *   trendLabel string   — e.g. "vs yesterday"
 *   onClick    fn       — optional click handler (navigates to section)
 *   loading    boolean
 */
export default function StatCard({
  title, value, icon, colorClass = 'bg-indigo-100 text-indigo-600',
  trend, trendLabel, onClick, loading = false,
}) {
  const trendUp   = trend > 0;
  const trendDown = trend < 0;

  return (
    <div
      className={`stat-card select-none ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Icon */}
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${colorClass}`}>
          {icon}
        </div>

        {/* Trend chip */}
        {trend !== undefined && !loading && (
          <span className={`
            inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
            ${trendUp   ? 'bg-red-50   text-red-600'     : ''}
            ${trendDown ? 'bg-emerald-50 text-emerald-600' : ''}
            ${!trendUp && !trendDown ? 'bg-slate-100 text-slate-500' : ''}
          `}>
            {trendUp   && <TrendingUp   className="w-3 h-3" />}
            {trendDown && <TrendingDown className="w-3 h-3" />}
            {!trendUp && !trendDown && <Minus className="w-3 h-3" />}
            {Math.abs(trend)}
          </span>
        )}
      </div>

      {/* Value */}
      <div className="mt-3">
        {loading ? (
          <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
        ) : (
          <p className="text-3xl font-bold text-slate-800 tabular-nums leading-none">
            {typeof value === 'number' ? value.toLocaleString() : value ?? '—'}
          </p>
        )}
        <p className="text-sm text-slate-500 mt-1.5 leading-tight">{title}</p>
        {trendLabel && !loading && (
          <p className="text-[11px] text-slate-400 mt-0.5">{trendLabel}</p>
        )}
      </div>
    </div>
  );
}
