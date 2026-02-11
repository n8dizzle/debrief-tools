'use client';

import Link from 'next/link';
import { CelBoard, BOARD_TYPE_LABELS, BOARD_TYPE_EMOJI } from '@/lib/supabase';

interface BoardCardProps {
  board: CelBoard;
}

export default function BoardCard({ board }: BoardCardProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  return (
    <Link
      href={`/boards/${board.id}`}
      className="card block transition-all hover:scale-[1.01]"
      style={{ textDecoration: 'none' }}
    >
      {/* Cover image */}
      {board.cover_image_url && (
        <div
          className="w-full h-32 rounded-lg mb-3 bg-cover bg-center"
          style={{ backgroundImage: `url(${board.cover_image_url})` }}
        />
      )}

      {/* Type badge */}
      <div className="flex items-center gap-2 mb-2">
        <span className="badge" style={{
          background: 'rgba(93, 138, 102, 0.15)',
          color: 'var(--christmas-green-light)',
        }}>
          {BOARD_TYPE_EMOJI[board.board_type]} {BOARD_TYPE_LABELS[board.board_type]}
        </span>
        {board.visibility === 'public' && (
          <span className="badge" style={{
            background: 'rgba(59, 130, 246, 0.15)',
            color: '#60a5fa',
          }}>
            Public
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-lg mb-1" style={{ color: 'var(--christmas-cream)' }}>
        {board.title}
      </h3>

      {/* Honoree */}
      {board.honoree_name && (
        <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
          For {board.honoree_name}
        </p>
      )}

      {/* Description */}
      {board.description && (
        <p className="text-sm line-clamp-2" style={{ color: 'var(--text-muted)' }}>
          {board.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          {board.post_count ?? 0} posts
        </div>

        {board.event_date && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {new Date(board.event_date + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        )}
      </div>
    </Link>
  );
}
