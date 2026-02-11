'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCelebrationsPermissions } from '@/hooks/useCelebrationsPermissions';
import { CelBoard, CelPost } from '@/lib/supabase';
import BoardHeader from '@/components/BoardHeader';
import BoardGrid from '@/components/BoardGrid';
import PostForm from '@/components/PostForm';
import ShareModal from '@/components/ShareModal';

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
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
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
    await fetchPosts();
  }

  async function handlePinPost(postId: string, pinned: boolean) {
    await fetch(`/api/boards/${boardId}/posts/${postId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: pinned }),
    });
    await fetchPosts();
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
    </div>
  );
}
