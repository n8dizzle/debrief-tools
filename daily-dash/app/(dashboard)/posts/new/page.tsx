'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import PostComposer from '@/components/PostComposer';
import { hasPermission } from '@/lib/permissions';

export default function NewPostPage() {
  const { data: session, status } = useSession();

  const canManagePosts = session?.user
    ? hasPermission(
        session.user.role as 'employee' | 'manager' | 'owner',
        session.user.permissions,
        'daily_dash',
        'can_manage_gbp_posts'
      )
    : false;

  if (status === 'loading') {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <svg
          className="w-8 h-8 animate-spin"
          style={{ color: 'var(--christmas-green)' }}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  if (!canManagePosts) {
    return (
      <div className="p-6">
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--christmas-cream)' }}>
            Access Restricted
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            You don&apos;t have permission to create GBP posts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/posts"
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              Create New Post
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Publish to all Google Business locations
            </p>
          </div>
        </div>
      </div>

      {/* Composer */}
      <div
        className="rounded-xl p-6"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <PostComposer />
      </div>
    </div>
  );
}
