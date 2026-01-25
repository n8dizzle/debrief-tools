'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { hasPermission } from '@/lib/permissions';
import type { GBPPost } from '@/lib/supabase';

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', label: 'Draft' },
    publishing: { bg: 'rgba(250, 204, 21, 0.15)', text: '#FACC15', label: 'Publishing' },
    published: { bg: 'rgba(74, 222, 128, 0.15)', text: '#4ADE80', label: 'Published' },
    failed: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', label: 'Failed' },
  };

  const { bg, text, label } = config[status] || config.draft;

  return (
    <span
      className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}

function PostTypeBadge({ type }: { type: string }) {
  const config: Record<string, { icon: string; label: string }> = {
    STANDARD: { icon: '📝', label: 'Update' },
    EVENT: { icon: '📅', label: 'Event' },
    OFFER: { icon: '🏷️', label: 'Offer' },
  };

  const { icon, label } = config[type] || config.STANDARD;

  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
      {icon} {label}
    </span>
  );
}

export default function PostsPage() {
  const { data: session } = useSession();
  const [posts, setPosts] = useState<GBPPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManagePosts = session?.user
    ? hasPermission(
        session.user.role as 'employee' | 'manager' | 'owner',
        session.user.permissions,
        'marketing_hub',
        'can_manage_gbp_posts'
      )
    : false;

  useEffect(() => {
    if (!canManagePosts) {
      setIsLoading(false);
      return;
    }

    const fetchPosts = async () => {
      try {
        const response = await fetch('/api/gbp/posts');
        const data = await response.json();

        if (response.ok) {
          setPosts(data.posts || []);
        } else {
          setError(data.error || 'Failed to load posts');
        }
      } catch {
        setError('Failed to load posts');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, [canManagePosts]);

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
            You don&apos;t have permission to manage GBP posts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Google Business Posts
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Create and publish posts to all 8 locations
          </p>
        </div>

        <Link
          href="/posts/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Post
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
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
      )}

      {/* Empty State */}
      {!isLoading && posts.length === 0 && (
        <div
          className="rounded-xl p-12 text-center"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="text-5xl mb-4">📢</div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--christmas-cream)' }}>
            No posts yet
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Create your first post to publish to all Google Business locations.
          </p>
          <Link
            href="/posts/new"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Your First Post
          </Link>
        </div>
      )}

      {/* Posts List */}
      {!isLoading && posts.length > 0 && (
        <div className="space-y-3">
          {posts.map((post) => {
            const publishedCount = post.locations?.filter((l) => l.status === 'published').length || 0;
            const totalLocations = post.locations?.length || 0;

            return (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="block rounded-xl p-5 transition-colors hover:bg-white/5"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  {post.media_urls && post.media_urls.length > 0 ? (
                    <div
                      className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <img
                        src={post.media_urls[0]}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className="w-16 h-16 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      📝
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <StatusBadge status={post.status} />
                      <PostTypeBadge type={post.topic_type} />
                    </div>

                    <p
                      className="text-sm line-clamp-2 mb-2"
                      style={{ color: 'var(--christmas-cream)' }}
                    >
                      {post.summary}
                    </p>

                    <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>
                        {new Date(post.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      {post.status === 'published' && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#4ADE80' }} />
                          {publishedCount}/{totalLocations} locations
                        </span>
                      )}
                      {post.created_by_user && (
                        <span>by {post.created_by_user.name || post.created_by_user.email}</span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
