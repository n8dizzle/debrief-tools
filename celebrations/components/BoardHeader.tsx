'use client';

import { CelBoard, BOARD_TYPE_LABELS, BOARD_TYPE_EMOJI } from '@/lib/supabase';

interface BoardHeaderProps {
  board: CelBoard;
  postCount: number;
  onContribute?: () => void;
}

export default function BoardHeader({ board, postCount, onContribute }: BoardHeaderProps) {
  return (
    <div className="mb-6 sm:mb-8">
      {/* Cover image */}
      {board.cover_image_url && (
        <div
          className="w-full h-32 sm:h-48 md:h-64 rounded-xl mb-4 sm:mb-6 bg-cover bg-center"
          style={{ backgroundImage: `url(${board.cover_image_url})` }}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
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
          <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: 'var(--christmas-cream)' }}>
            {board.title}
          </h1>

          {/* Honoree */}
          {board.honoree_name && (
            <p className="text-base sm:text-lg mb-1" style={{ color: 'var(--text-secondary)' }}>
              For {board.honoree_name}
            </p>
          )}

          {/* Description */}
          {board.description && (
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
              {board.description}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 mt-3">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {postCount} {postCount === 1 ? 'post' : 'posts'}
            </span>
            {board.event_date && (
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {new Date(board.event_date + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>
        </div>

        {/* CTA */}
        {onContribute && (
          <button
            onClick={onContribute}
            className="btn btn-primary w-full sm:w-auto px-6 py-3 text-base whitespace-nowrap"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Your Message
          </button>
        )}
      </div>
    </div>
  );
}
