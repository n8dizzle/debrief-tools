'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCelebrationsPermissions } from '@/hooks/useCelebrationsPermissions';
import { CelBoard, CelPost } from '@/lib/supabase';
import BoardHeader from '@/components/BoardHeader';
import BoardGrid from '@/components/BoardGrid';
import PostForm from '@/components/PostForm';
import ShareModal from '@/components/ShareModal';
import PresentMode from '@/components/PresentMode';
import ReviewQueue from '@/components/ReviewQueue';
import EditBoardModal from '@/components/EditBoardModal';

export default function BoardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const boardId = params.boardId as string;
  const { data: session } = useSession();
  const { isManager, isOwner, canManageBoards } = useCelebrationsPermissions();

  const [board, setBoard] = useState<CelBoard | null>(null);
  const [posts, setPosts] = useState<CelPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPostForm, setShowPostForm] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPresent, setShowPresent] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingPosts, setPendingPosts] = useState<CelPost[]>([]);

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards/${boardId}`);
      if (res.ok) {
        const data = await res.json();
        setBoard(data.board);
      }
    } catch (err) {
      console.error('Failed to fetch board:', err);
    }
  }, [boardId]);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards/${boardId}/posts`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts);
        if (data.pending_count !== undefined) {
          setPendingCount(data.pending_count);
        }
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    }
  }, [boardId]);

  const fetchPendingPosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards/${boardId}/posts?status=pending`);
      if (res.ok) {
        const data = await res.json();
        setPendingPosts(data.posts);
      }
    } catch (err) {
      console.error('Failed to fetch pending posts:', err);
    }
  }, [boardId]);

  useEffect(() => {
    Promise.all([fetchBoard(), fetchPosts()]).finally(() => setLoading(false));
  }, [fetchBoard, fetchPosts]);

  async function handlePostSubmit(postData: Record<string, unknown>) {
    const res = await fetch(`/api/boards/${boardId}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to create post');
    }
    await fetchPosts();
  }

  async function handleReact(postId: string, emoji: string) {
    await fetch(`/api/boards/${boardId}/posts/${postId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });
    await fetchPosts();
  }

  async function handleDeletePost(postId: string) {
    if (!confirm('Delete this post?')) return;
    await fetch(`/api/boards/${boardId}/posts/${postId}`, { method: 'DELETE' });
    // Optimistically remove from state immediately so duplicate detection updates
    setPosts(prev => prev.filter(p => p.id !== postId));
    // Then refresh from server
    fetchPosts();
  }

  async function handlePinPost(postId: string, pinned: boolean) {
    await fetch(`/api/boards/${boardId}/posts/${postId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: pinned }),
    });
    await fetchPosts();
  }

  async function handleDelete() {
    if (!confirm('Permanently delete this board and all its posts? This cannot be undone.')) return;
    await fetch(`/api/boards/${boardId}`, { method: 'DELETE' });
    router.push('/');
  }

  async function handleArchive() {
    if (!confirm('Archive this board? It will be hidden from the main list.')) return;
    await fetch(`/api/boards/${boardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });
    router.push('/');
  }

  async function handleUnarchive() {
    await fetch(`/api/boards/${boardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    await fetchBoard();
  }

  // Detect duplicate approved posts
  // Text-only matches require same slack_message_ts OR no media on either post
  // This avoids flagging multi-photo Slack messages (same text, different images) as duplicates
  const duplicateIds = useMemo(() => {
    const dupes = new Set<string>();
    for (let i = 0; i < posts.length; i++) {
      for (let j = i + 1; j < posts.length; j++) {
        const a = posts[i], b = posts[j];
        // Same media URL = definite duplicate
        if (a.media_url && a.media_url === b.media_url) {
          dupes.add(a.id);
          dupes.add(b.id);
          continue;
        }
        // Same text — only flag if both have no media (true text duplicate)
        // or if they share the same media URL (caught above)
        if (a.text_content && a.text_content.trim() === b.text_content?.trim()) {
          const bothTextOnly = !a.media_url && !b.media_url;
          if (bothTextOnly) {
            dupes.add(a.id);
            dupes.add(b.id);
          }
        }
      }
    }
    return dupes;
  }, [posts]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 rounded w-2/3 sm:w-1/3" style={{ background: 'var(--bg-card)' }} />
        <div className="h-4 rounded w-full sm:w-1/2" style={{ background: 'var(--bg-card)' }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 rounded-xl" style={{ background: 'var(--bg-card)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="text-center py-16">
        <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>Board not found</p>
      </div>
    );
  }

  return (
    <div>
      {/* Admin toolbar */}
      {canManageBoards && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto">
          {posts.length > 0 && (
            <button onClick={() => setShowPresent(true)} className="btn btn-secondary gap-2 whitespace-nowrap">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Present
            </button>
          )}

          {pendingCount > 0 && (
            <button
              onClick={() => { setShowReview(true); fetchPendingPosts(); }}
              className="btn btn-secondary gap-2 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Review
              <span
                className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold"
                style={{ background: 'var(--status-error)', color: '#fff' }}
              >
                {pendingCount}
              </span>
            </button>
          )}

          <button onClick={() => setShowEdit(true)} className="btn btn-secondary gap-2 whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>

          <button onClick={() => setShowShare(true)} className="btn btn-secondary gap-2 whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>

          {board.status === 'active' ? (
            <button onClick={handleArchive} className="btn btn-secondary gap-2 whitespace-nowrap">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Archive
            </button>
          ) : (
            <button onClick={handleUnarchive} className="btn btn-secondary gap-2 whitespace-nowrap">
              Restore
            </button>
          )}

          {isOwner && (
            <button onClick={handleDelete} className="btn btn-secondary gap-2 whitespace-nowrap" style={{ color: 'var(--status-error)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          )}
        </div>
      )}

      <BoardHeader
        board={board}
        postCount={posts.length}
        onContribute={board.status === 'active' ? () => setShowPostForm(true) : undefined}
      />

      <BoardGrid
        posts={posts}
        currentUserId={session?.user?.id}
        isManager={isManager || isOwner}
        duplicateIds={duplicateIds.size > 0 ? duplicateIds : undefined}
        onReact={handleReact}
        onDelete={handleDeletePost}
        onPin={(isManager || isOwner) ? handlePinPost : undefined}
      />

      {/* Post Form Modal */}
      {showPostForm && (
        <PostForm
          boardId={boardId}
          onSubmit={handlePostSubmit}
          onClose={() => setShowPostForm(false)}
        />
      )}

      {/* Share Modal */}
      {showShare && board && (
        <ShareModal board={board} onClose={() => setShowShare(false)} />
      )}

      {/* Present Mode */}
      {showPresent && (
        <PresentMode
          posts={posts}
          boardTitle={board.title}
          onClose={() => setShowPresent(false)}
        />
      )}

      {/* Edit Board Modal */}
      {showEdit && board && (
        <EditBoardModal
          board={board}
          onSave={(updated) => {
            setBoard({ ...updated, post_count: board.post_count });
            setShowEdit(false);
          }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Review Mode */}
      {showReview && (
        <div className="fixed inset-0 z-40" style={{ background: 'var(--bg-primary)' }}>
          <div className="max-w-6xl mx-auto p-4 sm:p-6 h-full overflow-y-auto">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              Review Queue — {board.title}
            </h2>
            <ReviewQueue
              boardId={boardId}
              posts={pendingPosts}
              approvedPosts={posts}
              onReviewComplete={() => {
                fetchPendingPosts();
                fetchPosts();
              }}
              onClose={() => setShowReview(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
