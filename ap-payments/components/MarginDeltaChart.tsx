'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { MarginRow } from './MarginGrid';

/**
 * The one Phase-1 chart: ServiceTitan GM% vs Adjusted GM% for the highest-revenue jobs.
 * Dramatizes the whole value prop — the gap between the two bars is the cost ST missed.
 */
export default function MarginDeltaChart({ rows }: { rows: MarginRow[] }) {
  const data = rows
    .filter((r) => r.cost_status === 'synced' && (r.revenue ?? 0) > 0)
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
    .slice(0, 12)
    .map((r) => ({
      name: r.job_number,
      ST: r.stGrossMarginPct != null ? Math.round(r.stGrossMarginPct * 1000) / 10 : 0,
      Adjusted: r.adjustedGrossMarginPct != null ? Math.round(r.adjustedGrossMarginPct * 1000) / 10 : 0,
    }));

  if (data.length === 0) {
    return (
      <div
        className="rounded-lg p-6 text-sm flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', height: 280 }}
      >
        No priced jobs in this period yet.
      </div>
    );
  }

  return (
    <div
      className="rounded-lg p-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        ServiceTitan vs Adjusted Gross Margin %
      </div>
      <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Top {data.length} jobs by revenue. The gap is the cost ServiceTitan didn&apos;t capture.
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} angle={-35} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="%" />
          <Tooltip
            formatter={(v) => `${v}%`}
            contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="ST" fill="#9ca3af" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Adjusted" fill="var(--christmas-green)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
