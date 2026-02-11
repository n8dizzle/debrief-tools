'use client';

import { CelPost, CelReaction } from '@/lib/supabase';
import ReactionBar from './ReactionBar';

interface PostCardProps {
  post: CelPost;
  currentUserId?: string;
  onReact?: (postId: string, emoji: string) => void;
  onDelete?: (postId: string) => void;
  onPin?: (postId: string, pinned: boolean) => void;
  isManager?: boolean;
}

export default function PostCard({ post, currentUserId, onReact, onDelete, onPin, isManager }: PostCardProps) {
  const isAuthor = currentUserId && post.author_user_id === currentUserId;
  const timeAgo = getRelativeTime(post.created_at);

  return (
    <div className="masonry-item">
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: post.content_type === 'text' && post.background_color
            ? post.background_color
            : 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Media content */}
        {post.content_type === 'photo' && post.media_url && (
          <img
            src={post.media_url}
            alt=""
            className="w-full"
            style={{ display: 'block' }}
            loading="lazy"
          />
        )}

        {post.content_type === 'gif' && post.media_url && (
          <div>
            <img
              src={post.media_url}
              alt=""
              className="w-full"
              style={{ display: 'block' }}
              loading="lazy"
            />
          </div>
        )}

        {post.content_type === 'video' && post.media_url && (
          <video
            src={post.media_url}
            controls
            preload="metadata"
            className="w-full"
            style={{ display: 'block' }}
          />
        )}

        {/* Text content */}
        {post.content_type === 'text' && post.text_content && (
          <div className="p-5">
            <p
              className={`${post.text_content.length < 80 ? 'text-xl' : 'text-base'} leading-relaxed`}
              style={{
                color: post.background_color && post.background_color !== '#1C231E'
                  ? '#ffffff'
                  : 'var(--text-primary)',
              }}
            >
              {post.text_content}
            </p>
          </div>
        )}

        {/* Caption for media posts */}
        {post.content_type !== 'text' && post.text_content && (
          <div className="px-4 pt-3">
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
              {post.text_content}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3">
          {/* Author */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {post.author_avatar_url ? (
                <img
                  src={post.author_avatar_url}
                  alt=""
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                  style={{ background: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
                >
                  {post.author_name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium" style={{
                color: post.content_type === 'text' && post.background_color && post.background_color !== '#1C231E'
                  ? 'rgba(255,255,255,0.9)'
                  : 'var(--text-secondary)',
              }}>
                {post.author_name}
              </span>
              <span className="text-xs" style={{
                color: post.content_type === 'text' && post.background_color && post.background_color !== '#1C231E'
                  ? 'rgba(255,255,255,0.5)'
                  : 'var(--text-muted)',
              }}>
                {timeAgo}
              </span>
            </div>

            {/* Actions */}
            {(isAuthor || isManager) && (
              <div className="flex gap-1">
                {isManager && onPin && (
                  <button
                    onClick={() => onPin(post.id, !post.is_pinned)}
                    className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                    title={post.is_pinned ? 'Unpin' : 'Pin'}
                  >
                    <svg className="w-5 h-5 sm:w-4 sm:h-4" fill={post.is_pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(post.id)}
                    className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--status-error)' }}
                    title="Delete"
                  >
                    <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* GIPHY attribution */}
          {post.content_type === 'gif' && (
            <div className="mb-2">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Powered by GIPHY
              </span>
            </div>
          )}

          {/* Reactions */}
          {onReact && (
            <ReactionBar
              reactions={post.reactions || []}
              currentUserId={currentUserId}
              onReact={(emoji) => onReact(post.id, emoji)}
            />
          )}

          {/* Pinned indicator */}
          {post.is_pinned && (
            <div className="flex items-center gap-1 mt-2">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--christmas-gold)' }}>
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span className="text-xs" style={{ color: 'var(--christmas-gold)' }}>Pinned</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
