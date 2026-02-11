'use client';

import { useState } from 'react';
import { CelReaction } from '@/lib/supabase';

const QUICK_REACTIONS = ['\u2764\uFE0F', '\uD83D\uDC4F', '\uD83D\uDE02', '\uD83C\uDF89', '\uD83D\uDE0D', '\uD83D\uDD25'];

interface ReactionBarProps {
  reactions: CelReaction[];
  currentUserId?: string;
  onReact: (emoji: string) => void;
}

export default function ReactionBar({ reactions, currentUserId, onReact }: ReactionBarProps) {
  const [showPicker, setShowPicker] = useState(false);

  // Group reactions by emoji
  const grouped = reactions.reduce<Record<string, { count: number; hasReacted: boolean; names: string[] }>>((acc, r) => {
    if (!acc[r.emoji]) {
      acc[r.emoji] = { count: 0, hasReacted: false, names: [] };
    }
    acc[r.emoji].count++;
    acc[r.emoji].names.push(r.reactor_name);
    if (r.reactor_user_id === currentUserId) {
      acc[r.emoji].hasReacted = true;
    }
    return acc;
  }, {});

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-1.5">
      {/* Existing reactions */}
      {Object.entries(grouped).map(([emoji, data]) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className="inline-flex items-center gap-1.5 sm:gap-1 px-3 py-1.5 sm:px-2 sm:py-0.5 rounded-full text-sm sm:text-xs transition-colors min-h-[36px] sm:min-h-0"
          style={{
            background: data.hasReacted ? 'rgba(93, 138, 102, 0.25)' : 'var(--bg-card-hover)',
            border: `1px solid ${data.hasReacted ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
            color: 'var(--text-secondary)',
          }}
          title={data.names.join(', ')}
        >
          <span>{emoji}</span>
          <span>{data.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="inline-flex items-center justify-center w-9 h-9 sm:w-7 sm:h-7 rounded-full transition-colors"
          style={{
            background: 'var(--bg-card-hover)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)',
          }}
        >
          <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {showPicker && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
            <div
              className="absolute bottom-full mb-2 left-0 z-20 flex gap-1.5 sm:gap-1 p-2.5 sm:p-2 rounded-lg shadow-lg"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
              }}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact(emoji);
                    setShowPicker(false);
                  }}
                  className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:scale-110 transition-transform text-xl sm:text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
