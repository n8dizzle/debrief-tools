'use client';

import { ARCollectionNote, ARNoteType, ARContactResult } from '@/lib/supabase';
import { formatNoteDate, formatActivityDate } from '@/lib/ar-utils';
import Link from 'next/link';

interface ActivityTimelineProps {
  notes: ARCollectionNote[];
  showInvoiceLink?: boolean;
  invoiceNumbers?: Record<string, string>;
  maxItems?: number;
}

function getNoteTypeIcon(type: ARNoteType): JSX.Element {
  const iconClass = "w-4 h-4";

  switch (type) {
    case 'call':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      );
    case 'email':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case 'text':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case 'task':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      );
    case 'status_change':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case 'payment_promise':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'note':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      );
  }
}

function getNoteTypeColor(type: ARNoteType): string {
  switch (type) {
    case 'call':
      return 'var(--christmas-green-light)';
    case 'email':
      return '#60a5fa'; // blue
    case 'text':
      return '#a78bfa'; // purple
    case 'task':
      return '#fbbf24'; // yellow
    case 'status_change':
      return '#f97316'; // orange
    case 'payment_promise':
      return '#34d399'; // green
    case 'note':
      return '#14b8a6'; // teal
    default:
      return 'var(--text-secondary)';
  }
}

function getContactResultLabel(result: ARContactResult | null): string {
  if (!result) return '';
  switch (result) {
    case 'reached': return 'Reached';
    case 'voicemail': return 'Voicemail';
    case 'no_answer': return 'No Answer';
    case 'left_message': return 'Left Message';
    default: return result;
  }
}

export default function ActivityTimeline({
  notes,
  showInvoiceLink = false,
  invoiceNumbers = {},
  maxItems
}: ActivityTimelineProps) {
  const displayNotes = maxItems ? notes.slice(0, maxItems) : notes;

  if (displayNotes.length === 0) {
    return (
      <div className="text-center py-6" style={{ color: 'var(--text-muted)' }}>
        No activity recorded yet
      </div>
    );
  }

  return (
    <div className="relative">
      {displayNotes.map((note, index) => {
        const isLast = index === displayNotes.length - 1;
        const typeColor = getNoteTypeColor(note.note_type);

        return (
          <div key={note.id} className="relative flex gap-3 pb-4">
            {/* Timeline connector */}
            {!isLast && (
              <div
                className="absolute left-[11px] top-6 w-0.5 h-full"
                style={{ backgroundColor: 'var(--border-subtle)' }}
              />
            )}

            {/* Icon */}
            <div
              className="relative z-10 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-secondary)', color: typeColor }}
            >
              {getNoteTypeIcon(note.note_type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium" style={{ color: typeColor }}>
                  {formatActivityDate(note.created_at)}
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
                  {note.author_initials?.toUpperCase()}
                </span>
                {note.contact_result && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                  >
                    {getContactResultLabel(note.contact_result)}
                  </span>
                )}
                {note.spoke_with && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    w/ {note.spoke_with}
                  </span>
                )}
                {showInvoiceLink && note.invoice_id && (
                  <Link
                    href={`/invoices/${note.invoice_id}`}
                    className="text-xs hover:underline"
                    style={{ color: 'var(--christmas-green-light)' }}
                  >
                    #{invoiceNumbers[note.invoice_id] || 'Invoice'}
                  </Link>
                )}
              </div>

              {/* Note content */}
              {note.content && (
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {note.content}
                </p>
              )}

              {/* Payment promise info */}
              {note.promised_amount && (
                <div className="mt-1 text-xs" style={{ color: 'var(--status-success)' }}>
                  Payment promised: ${note.promised_amount.toLocaleString()}
                  {note.promised_date && ` by ${formatNoteDate(note.promised_date)}`}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Show more indicator */}
      {maxItems && notes.length > maxItems && (
        <div className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          +{notes.length - maxItems} more activities
        </div>
      )}
    </div>
  );
}
