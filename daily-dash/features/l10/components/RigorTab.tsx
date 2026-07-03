'use client';

import { useRigor, RigorApp, RigorStatus } from '@/lib/hooks/useL10Data';

// Freshness-only, weekly-focused: is a human using this tool for its purpose
// THIS WEEK? Active = something in the last 7 days, Slipping = quiet this week
// but alive in the last 30, Dormant = nothing in 30 days.
const STATUS_META: Record<RigorStatus, { label: string; color: string; bg: string; border: string }> = {
  active: { label: 'Active', color: '#6B9B75', bg: 'rgba(93, 138, 102, 0.15)', border: 'var(--christmas-green)' },
  slipping: { label: 'Slipping', color: '#B8956B', bg: 'rgba(184, 149, 107, 0.15)', border: 'var(--christmas-gold)' },
  dormant: { label: 'Dormant', color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)', border: '#EF4444' },
  unknown: { label: 'No data', color: 'var(--text-muted)', bg: 'var(--bg-secondary)', border: 'var(--border-subtle)' },
};

function daysAgo(iso: string): number {
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function formatLastAction(iso: string | null): string {
  if (!iso) return 'No activity yet';
  const d = daysAgo(iso);
  const dateStr = new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (d <= 0) return `Today · ${dateStr}`;
  if (d === 1) return `Yesterday · ${dateStr}`;
  return `${d} days ago · ${dateStr}`;
}

function RigorCard({ app }: { app: RigorApp }) {
  const meta = STATUS_META[app.status];

  return (
    <div
      className="rounded-lg p-5 flex flex-col"
      style={{ backgroundColor: 'var(--bg-card)', border: `1px solid var(--border-subtle)` }}
    >
      {/* Header: name + status badge */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          {app.url ? (
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-semibold hover:underline"
              style={{ color: 'var(--christmas-cream)' }}
            >
              {app.name}
            </a>
          ) : (
            <span className="text-base font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              {app.name}
            </span>
          )}
        </div>
        <span
          className="px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0"
          style={{ backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
        >
          {meta.label}
        </span>
      </div>

      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        {app.purpose}
      </p>

      {/* Last action */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>
          Last action
        </div>
        <div className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
          {formatLastAction(app.lastAction)}
        </div>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-2 gap-3 mt-auto">
        <div className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="text-xl font-bold" style={{ color: app.count7d > 0 ? '#6B9B75' : 'var(--text-muted)' }}>
            {app.count7d}
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            this week
          </div>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="text-xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {app.count30d}
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            last 30 days
          </div>
        </div>
      </div>

      <div className="text-[10px] mt-2" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
        {app.actionLabel}
      </div>
    </div>
  );
}

export default function RigorTab() {
  const { apps, isLoading, error } = useRigor();

  return (
    <div>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        Are the tools we build actually being used to improve the work &mdash; or did we ship them and
        let them rot? Each card tracks a real human action in that tool.{' '}
        <span style={{ color: 'var(--text-muted)' }}>
          Active = used this week · Slipping = quiet this week but alive in the last 30 days · Dormant = nothing in 30 days.
        </span>
      </p>

      {isLoading ? (
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Loading&hellip;</div>
      ) : error ? (
        <div className="text-center py-8" style={{ color: '#f87171' }}>
          Couldn&rsquo;t load rigor data. Try refreshing &mdash; if this persists you may need to sign in again.
        </div>
      ) : !apps?.length ? (
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No apps tracked yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.map((app) => (
            <RigorCard key={app.key} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
