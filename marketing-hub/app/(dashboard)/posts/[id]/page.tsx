'use client';

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { hasPermission } from '@/lib/permissions';
import type { GBPPost } from '@/lib/supabase';

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', label: 'Draft' },
    publishing: { bg: 'rgba(250, 204, 21, 0.15)', text: '#FACC15', label: 'Publishing' },
    published: { bg: 'rgba(74, 222, 128, 0.15)', text: '#4ADE80', label: 'Published' },
    failed: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', label: 'Failed' },
    pending: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', label: 'Pending' },
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
    <span className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--text-muted)' }}>
      {icon} {label}
    </span>
  );
}

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [post, setPost] = useState<GBPPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    success: boolean;
    published: number;
    failed: number;
    total: number;
  } | null>(null);

  const canManagePosts = session?.user
    ? hasPermission(
        session.user.role as 'employee' | 'manager' | 'owner',
        session.user.permissions,
        'marketing_hub',
        'can_manage_gbp_posts'
      )
    : false;

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!canManagePosts) {
      setIsLoading(false);
      return;
    }

    const fetchPost = async () => {
      try {
        const response = await fetch(`/api/gbp/posts/${id}`);
        const data = await response.json();

        if (response.ok) {
          setPost(data);
        } else {
          setError(data.error || 'Failed to load post');
        }
      } catch {
        setError('Failed to load post');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [id, canManagePosts, sessionStatus]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post? If published, it will also be removed from Google.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/gbp/posts/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/posts');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete post');
      }
    } catch {
      setError('Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishResult(null);
    setError(null);

    try {
      const response = await fetch(`/api/gbp/posts/${id}/publish`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setPublishResult({
          success: data.success,
          published: data.published,
          failed: data.failed,
          total: data.total,
        });

        // Refresh post data
        const postResponse = await fetch(`/api/gbp/posts/${id}`);
        if (postResponse.ok) {
          const postData = await postResponse.json();
          setPost(postData);
        }
      } else {
        setError(data.error || 'Failed to publish post');
      }
    } catch {
      setError('Failed to publish post');
    } finally {
      setIsPublishing(false);
    }
  };

  if (sessionStatus === 'loading' || isLoading) {
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
            You don&apos;t have permission to view GBP posts.
          </p>
        </div>
      </div>
    );
  }

  if (error && !post) {
    return (
      <div className="p-6">
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--christmas-cream)' }}>
            Error
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            {error}
          </p>
          <Link
            href="/posts"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
          >
            Back to Posts
          </Link>
        </div>
      </div>
    );
  }

  if (!post) return null;

  const publishedCount = post.locations?.filter((l) => l.status === 'published').length || 0;
  const totalLocations = post.locations?.length || 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/posts"
          className="p-2 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              Post Details
            </h1>
            <StatusBadge status={post.status} />
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Created {new Date(post.created_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Publish Result */}
      {publishResult && (
        <div
          className="mb-6 p-4 rounded-lg"
          style={{
            backgroundColor: publishResult.success ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: publishResult.success ? '#4ADE80' : '#EF4444',
          }}
        >
          <div className="font-medium mb-1">
            {publishResult.success ? 'Post Published!' : 'Publishing Completed with Errors'}
          </div>
          <div className="text-sm opacity-80">
            {publishResult.published} of {publishResult.total} locations published successfully.
            {publishResult.failed > 0 && ` ${publishResult.failed} failed.`}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Post Content Card */}
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <PostTypeBadge type={post.topic_type} />
            </div>

            {/* Media */}
            {post.media_urls && post.media_urls.length > 0 && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {post.media_urls.map((url, idx) => (
                    <div
                      key={idx}
                      className="w-24 h-24 rounded-lg overflow-hidden"
                      style={{ border: '1px solid var(--border-subtle)' }}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content */}
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--christmas-cream)' }}>
              {post.summary}
            </p>

            {/* Event Details */}
            {post.topic_type === 'EVENT' && post.event_title && (
              <div
                className="mt-4 p-4 rounded-lg"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                  Event Details
                </div>
                <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                  {post.event_title}
                </div>
                {post.event_start_date && (
                  <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(post.event_start_date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {post.event_end_date && post.event_end_date !== post.event_start_date && (
                      <> - {new Date(post.event_end_date).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}</>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Offer Details */}
            {post.topic_type === 'OFFER' && (post.coupon_code || post.redeem_url || post.terms_conditions) && (
              <div
                className="mt-4 p-4 rounded-lg"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                  Offer Details
                </div>
                {post.coupon_code && (
                  <div className="mb-2">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Coupon: </span>
                    <span className="font-mono font-medium" style={{ color: 'var(--christmas-cream)' }}>
                      {post.coupon_code}
                    </span>
                  </div>
                )}
                {post.redeem_url && (
                  <div className="mb-2">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Redeem URL: </span>
                    <a
                      href={post.redeem_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm underline"
                      style={{ color: 'var(--christmas-green)' }}
                    >
                      {post.redeem_url}
                    </a>
                  </div>
                )}
                {post.terms_conditions && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Terms: {post.terms_conditions}
                  </div>
                )}
              </div>
            )}

            {/* CTA */}
            {post.cta_type && (
              <div className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                Button: {post.cta_type}
                {post.cta_url && (
                  <a
                    href={post.cta_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 underline"
                    style={{ color: 'var(--christmas-green)' }}
                  >
                    {post.cta_url}
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Location Status */}
          {post.locations && post.locations.length > 0 && (
            <div
              className="rounded-xl p-6"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
                Location Status ({publishedCount}/{totalLocations})
              </h3>

              <div className="space-y-2">
                {post.locations.map((loc) => (
                  <div
                    key={loc.id}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                        style={{
                          backgroundColor:
                            loc.status === 'published'
                              ? 'rgba(74, 222, 128, 0.2)'
                              : loc.status === 'failed'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : 'rgba(148, 163, 184, 0.2)',
                          color:
                            loc.status === 'published'
                              ? '#4ADE80'
                              : loc.status === 'failed'
                              ? '#EF4444'
                              : '#94A3B8',
                        }}
                      >
                        {loc.status === 'published' ? '✓' : loc.status === 'failed' ? '✗' : '○'}
                      </div>
                      <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
                          {loc.location?.short_name || loc.location?.name || 'Unknown Location'}
                        </div>
                        {loc.error_message && (
                          <div className="text-xs text-red-400 mt-0.5">{loc.error_message}</div>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={loc.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Actions */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              Actions
            </h3>

            <div className="space-y-3">
              {post.status === 'draft' && (
                <>
                  <button
                    onClick={handlePublish}
                    disabled={isPublishing}
                    className="w-full py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
                  >
                    {isPublishing ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Publishing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Publish to All Locations
                      </>
                    )}
                  </button>

                  <Link
                    href={`/posts/new?edit=${post.id}`}
                    className="w-full py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Draft
                  </Link>
                </>
              )}

              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#EF4444',
                }}
              >
                {isDeleting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Post
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Info */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>
              Information
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Created by</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {post.created_by_user?.name || post.created_by_user?.email || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Created</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {new Date(post.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Last updated</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {new Date(post.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
