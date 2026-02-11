'use client';

import { CelPost } from '@/lib/supabase';
import PostCard from './PostCard';

interface BoardGridProps {
  posts: CelPost[];
  currentUserId?: string;
  isManager?: boolean;
  onReact?: (postId: string, emoji: string) => void;
  onDelete?: (postId: string) => void;
  onPin?: (postId: string, pinned: boolean) => void;
}

export default function BoardGrid({ posts, currentUserId, isManager, onReact, onDelete, onPin }: BoardGridProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
          No messages yet
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Be the first to add a message to this board!
        </p>
      </div>
    );
  }

  return (
    <div className="masonry-grid">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          isManager={isManager}
          onReact={onReact}
          onDelete={onDelete}
          onPin={onPin}
        />
      ))}
    </div>
  );
}
