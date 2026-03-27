'use client';

import { CelNomination, NominationCategory, getCategoryByKey, COMPANY_VALUES } from '@/lib/supabase';

interface NominationCardProps {
  nomination: CelNomination;
  categories?: NominationCategory[];
  showNominator?: boolean;
  onDelete?: (id: string) => void;
  deleting?: boolean;
}

export default function NominationCard({ nomination, categories, showNominator, onDelete, deleting }: NominationCardProps) {
  const value = getCategoryByKey(nomination.company_value, categories || COMPANY_VALUES);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderLeft: `4px solid ${value?.color || 'var(--border-default)'}`,
      }}
    >
      <div className="p-4">
        {/* Value badge + nominee */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
              style={{
                background: value?.bgColor,
                color: value?.color,
              }}
            >
              {value?.emoji} {value?.label}
            </span>
          </div>
          {onDelete && (
            <button
              onClick={() => onDelete(nomination.id)}
              disabled={deleting}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ color: 'var(--text-muted)' }}
              title="Delete nomination"
            >
              {deleting ? '...' : '×'}
            </button>
          )}
        </div>

        {/* Nominee name */}
        <div className="text-base font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>
          {nomination.nominee_name}
        </div>

        {/* Story */}
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
          {nomination.story}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-3">
            {showNominator && (
              <span>Nominated by {nomination.nominator_name}</span>
            )}
            {nomination.event_date && (
              <span>Event: {new Date(nomination.event_date + 'T00:00:00').toLocaleDateString()}</span>
            )}
          </div>
          <span>{new Date(nomination.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
