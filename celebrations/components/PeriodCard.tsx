'use client';

import Link from 'next/link';
import { CelNominationPeriod, NominationPeriodStatus } from '@/lib/supabase';

const STATUS_STYLES: Record<NominationPeriodStatus, { label: string; bg: string; color: string }> = {
  draft: { label: 'Draft', bg: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af' },
  open: { label: 'Open', bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
  closed: { label: 'Closed', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
};

interface PeriodCardProps {
  period: CelNominationPeriod;
  isManager?: boolean;
}

export default function PeriodCard({ period, isManager }: PeriodCardProps) {
  const status = STATUS_STYLES[period.status] || STATUS_STYLES.draft;

  const content = (
    <div
      className="rounded-lg p-4 transition-colors"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold" style={{ color: 'var(--christmas-cream)' }}>
          {period.title}
        </h3>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ background: status.bg, color: status.color }}
        >
          {status.label}
        </span>
      </div>

      {period.description && (
        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
          {period.description}
        </p>
      )}

      <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>{period.nomination_count ?? 0} nomination{(period.nomination_count ?? 0) !== 1 ? 's' : ''}</span>
        {period.opens_at && (
          <span>Opens: {new Date(period.opens_at).toLocaleDateString()}</span>
        )}
        {period.closes_at && (
          <span>Closes: {new Date(period.closes_at).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );

  if (isManager) {
    return (
      <Link href={`/nominations/periods/${period.id}`} className="block hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
