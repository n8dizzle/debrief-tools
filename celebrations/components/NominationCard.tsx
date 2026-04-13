'use client';

import { useState } from 'react';
import { CelNomination, NominationCategory, getCategoryByKey, COMPANY_VALUES } from '@/lib/supabase';

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors"
      style={{ color: copied ? 'var(--status-success)' : 'var(--text-muted)' }}
      title={label ? `Copy ${label}` : 'Copy'}
    >
      {copied ? (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

export { CopyButton };

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
        <div className="flex items-start gap-1 mb-3 group">
          <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>
            {nomination.story}
          </p>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <CopyButton text={nomination.story} label="quote" />
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-3">
            {showNominator && (
              <span className="inline-flex items-center gap-0.5 group">
                Nominated by {nomination.nominator_name}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyButton text={nomination.nominator_name} label="nominator" />
                </span>
              </span>
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
