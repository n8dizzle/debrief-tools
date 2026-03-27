'use client';

import { useState, useMemo } from 'react';
import { CelPost } from '@/lib/supabase';
import PostCard from './PostCard';

interface ReviewQueueProps {
  boardId: string;
  posts: CelPost[];
  approvedPosts?: CelPost[];
  onReviewComplete: () => void;
  onClose: () => void;
}

function isDuplicate(pending: CelPost, approved: CelPost): boolean {
  // Same media URL = definite duplicate
  if (pending.media_url && pending.media_url === approved.media_url) return true;

  // Same text — only flag if both are text-only (no media)
  // Avoids flagging multi-photo Slack messages as duplicates
  if (pending.text_content && pending.text_content.trim() === approved.text_content?.trim()) {
    if (!pending.media_url && !approved.media_url) return true;
  }

  return false;
}

export default function ReviewQueue({ boardId, posts, approvedPosts = [], onReviewComplete, onClose }: ReviewQueueProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  const allSelected = posts.length > 0 && selected.size === posts.length;

  // Build a set of duplicate post IDs
  const duplicateIds = useMemo(() => {
    const dupes = new Set<string>();
    for (const pending of posts) {
      for (const approved of approvedPosts) {
        if (isDuplicate(pending, approved)) {
          dupes.add(pending.id);
          break;
        }
      }
    }
    return dupes;
  }, [posts, approvedPosts]);

  const duplicateCount = duplicateIds.size;

  function toggleSelect(postId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(posts.map((p) => p.id)));
    }
  }

  function selectAllDuplicates() {
    setSelected(new Set(duplicateIds));
  }

  async function handleAction(action: 'approve' | 'reject', ids?: string[]) {
    const postIds = ids || Array.from(selected);
    if (postIds.length === 0) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/posts/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_ids: postIds, action }),
      });
      if (res.ok) {
        setSelected(new Set());
        onReviewComplete();
      }
    } catch (err) {
      console.error('Review action failed:', err);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div
        className="flex items-center justify-between p-3 rounded-lg mb-4 flex-wrap gap-2"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="accent-[var(--christmas-green)]"
            />
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </label>
          {duplicateCount > 0 && (
            <button
              onClick={selectAllDuplicates}
              className="text-xs px-2 py-1 rounded-lg"
              style={{
                background: 'rgba(234, 179, 8, 0.15)',
                color: '#eab308',
                border: '1px solid rgba(234, 179, 8, 0.3)',
              }}
            >
              Select {duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAction('approve')}
            disabled={selected.size === 0 || processing}
            className="btn btn-primary text-sm py-1 px-3"
            style={{ opacity: selected.size === 0 || processing ? 0.5 : 1 }}
          >
            Approve ({selected.size})
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={selected.size === 0 || processing}
            className="text-sm py-1 px-3 rounded"
            style={{
              background: 'var(--status-error)',
              color: '#fff',
              opacity: selected.size === 0 || processing ? 0.5 : 1,
            }}
          >
            Reject ({selected.size})
          </button>
          <button
            onClick={onClose}
            className="btn btn-secondary text-sm py-1 px-3"
          >
            Back to Board
          </button>
        </div>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
            Review queue is empty
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            All caught up! No pending posts to review.
          </p>
        </div>
      ) : (
        <div className="masonry-grid">
          {posts.map((post) => {
            const isDupe = duplicateIds.has(post.id);
            return (
              <div key={post.id} className="masonry-item relative">
                {/* Duplicate badge */}
                {isDupe && (
                  <div
                    className="absolute top-2 left-10 z-10 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      background: 'rgba(234, 179, 8, 0.9)',
                      color: '#000',
                    }}
                  >
                    Duplicate
                  </div>
                )}

                {/* Selection overlay */}
                <div
                  className="absolute top-2 left-2 z-10 cursor-pointer"
                  onClick={() => toggleSelect(post.id)}
                >
                  <div
                    className="w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors"
                    style={{
                      borderColor: selected.has(post.id) ? 'var(--christmas-green)' : 'var(--border-subtle)',
                      background: selected.has(post.id) ? 'var(--christmas-green)' : 'transparent',
                    }}
                  >
                    {selected.has(post.id) && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Individual action buttons */}
                <div className="absolute top-2 right-2 z-10 flex gap-1">
                  <button
                    onClick={() => handleAction('approve', [post.id])}
                    disabled={processing}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-white text-sm"
                    style={{ background: 'var(--christmas-green)' }}
                    title="Approve"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleAction('reject', [post.id])}
                    disabled={processing}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-white text-sm"
                    style={{ background: 'var(--status-error)' }}
                    title="Reject"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div style={isDupe ? { outline: '2px solid #eab308', borderRadius: '0.75rem' } : undefined}>
                  <PostCard post={post} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
