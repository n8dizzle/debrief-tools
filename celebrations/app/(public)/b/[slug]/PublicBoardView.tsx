'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CelBoard, CelPost } from '@/lib/supabase';
import BoardHeader from '@/components/BoardHeader';
import PostCard from '@/components/PostCard';

interface PublicBoardViewProps {
  board: CelBoard;
  initialPosts: CelPost[];
}

export default function PublicBoardView({ board, initialPosts }: PublicBoardViewProps) {
  const [posts] = useState(initialPosts);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {/* Simple header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--christmas-green)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Christmas Air Celebrations
          </span>
        </div>
      </div>

      <BoardHeader
        board={board}
        postCount={posts.length}
        onContribute={() => {
          window.location.href = `/b/${board.slug}/contribute`;
        }}
      />

      {/* Masonry grid */}
      {posts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            No messages yet. Be the first to contribute!
          </p>
          <Link
            href={`/b/${board.slug}/contribute`}
            className="btn btn-primary mt-4 inline-flex"
          >
            Add Your Message
          </Link>
        </div>
      ) : (
        <div className="masonry-grid">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
            />
          ))}
        </div>
      )}
    </div>
  );
}
