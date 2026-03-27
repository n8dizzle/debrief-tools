'use client';

import { useState, useEffect, useCallback } from 'react';

interface ReviewUser {
  id: string;
  raw_user_meta_data: {
    full_name?: string;
    [key: string]: unknown;
  } | null;
}

interface ReviewService {
  id: string;
  name: string;
  slug: string;
}

interface Review {
  id: string;
  rating_overall: number;
  rating_quality: number | null;
  rating_punctuality: number | null;
  rating_communication: number | null;
  rating_value: number | null;
  title: string | null;
  body: string | null;
  photos: string[] | null;
  contractor_response: string | null;
  contractor_responded_at: string | null;
  created_at: string;
  reviewer: ReviewUser | null;
  service: ReviewService | null;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      className={filled ? 'text-yellow-400' : 'text-gray-200'}
      style={{ color: filled ? '#facc15' : '#e5e7eb' }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
}

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={star <= rating ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ color: star <= rating ? '#facc15' : '#e5e7eb' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
      ))}
    </div>
  );
}

function getReviewerName(reviewer: ReviewUser | null): string {
  if (!reviewer?.raw_user_meta_data?.full_name) return 'Anonymous';
  return reviewer.raw_user_meta_data.full_name;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);

  // Response form state
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reviews');
      if (!res.ok) throw new Error('Failed to load reviews');
      const data = await res.json();
      setReviews(data.reviews || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  async function handleSubmitResponse(reviewId: string) {
    if (!responseText.trim()) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/reviews/${reviewId}/response`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractor_response: responseText }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit response');
      }

      // Update local state with the response
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                contractor_response: responseText.trim(),
                contractor_responded_at: new Date().toISOString(),
              }
            : r
        )
      );
      setRespondingTo(null);
      setResponseText('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  }

  // Summary stats
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating_overall, 0) / reviews.length
      : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating_overall === star).length,
  }));

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid var(--hw-border, var(--border-default))',
              borderTopColor: 'var(--hw-blue)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 1rem',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: 'var(--hw-text-secondary, var(--text-muted))', fontSize: '0.875rem' }}>
            Loading reviews...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="card"
        style={{ textAlign: 'center', padding: '3rem' }}
      >
        <div style={{ color: 'var(--status-error)', marginBottom: '0.5rem' }}>{error}</div>
        <button className="btn-secondary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--hw-text, var(--text-primary))',
            margin: '0 0 0.25rem',
          }}
        >
          Reviews
        </h1>
        <p style={{ color: 'var(--hw-text-secondary, var(--text-secondary))', fontSize: '0.875rem', margin: 0 }}>
          See what your customers are saying and respond to feedback.
        </p>
      </div>

      {/* Summary Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        {/* Average Rating Card */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
          }}
        >
          <div
            style={{
              fontSize: '3rem',
              fontWeight: 700,
              color: 'var(--hw-text, var(--text-primary))',
              lineHeight: 1,
              marginBottom: '0.5rem',
            }}
          >
            {reviews.length > 0 ? avgRating.toFixed(1) : '--'}
          </div>
          <StarRating rating={Math.round(avgRating)} size={20} />
          <div
            style={{
              fontSize: '0.875rem',
              color: 'var(--hw-text-secondary, var(--text-muted))',
              marginTop: '0.5rem',
            }}
          >
            {total} {total === 1 ? 'review' : 'reviews'}
          </div>
        </div>

        {/* Rating Distribution Card */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--hw-text, var(--text-primary))',
              margin: '0 0 1rem',
            }}
          >
            Rating Distribution
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {ratingDistribution.map(({ star, count }) => {
              const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--hw-text-secondary, var(--text-secondary))',
                      width: '1rem',
                      textAlign: 'right',
                    }}
                  >
                    {star}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#facc15', flexShrink: 0 }}>
                    <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                  <div
                    style={{
                      flex: 1,
                      height: '8px',
                      background: 'var(--hw-bg-tertiary, var(--bg-input))',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: '#facc15',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--hw-text-secondary, var(--text-muted))',
                      width: '2rem',
                      textAlign: 'right',
                    }}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div
          className="card"
          style={{ textAlign: 'center', padding: '3rem' }}
        >
          <svg
            width="48"
            height="48"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            viewBox="0 0 24 24"
            style={{ color: 'var(--hw-text-secondary, var(--text-muted))', margin: '0 auto 1rem' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
          <div
            style={{
              color: 'var(--hw-text-secondary, var(--text-muted))',
              fontSize: '0.9375rem',
            }}
          >
            No reviews yet. Reviews will appear here after customers rate your work.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reviews.map((review) => (
            <div
              key={review.id}
              className="card"
              style={{ padding: '1.5rem' }}
            >
              {/* Review Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '0.75rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <StarRating rating={review.rating_overall} />
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--hw-text-secondary, var(--text-muted))',
                      }}
                    >
                      {formatDate(review.created_at)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        color: 'var(--hw-text, var(--text-primary))',
                      }}
                    >
                      {getReviewerName(review.reviewer)}
                    </span>
                    {review.service && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--hw-blue-light)',
                          background: 'var(--hw-bg-tertiary, var(--bg-input))',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '9999px',
                        }}
                      >
                        {review.service.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Review Title */}
              {review.title && (
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--hw-text, var(--text-primary))',
                    margin: '0 0 0.375rem',
                  }}
                >
                  {review.title}
                </h3>
              )}

              {/* Review Body */}
              {review.body && (
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--hw-text-secondary, var(--text-secondary))',
                    lineHeight: 1.6,
                    margin: '0 0 0.75rem',
                  }}
                >
                  {review.body}
                </p>
              )}

              {/* Sub-Ratings */}
              {(review.rating_quality || review.rating_punctuality || review.rating_communication || review.rating_value) && (
                <div
                  style={{
                    display: 'flex',
                    gap: '1.5rem',
                    flexWrap: 'wrap',
                    marginBottom: '0.75rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid var(--hw-border, var(--border-default))',
                  }}
                >
                  {review.rating_quality != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--hw-text-secondary, var(--text-muted))' }}>Quality</span>
                      <StarRating rating={review.rating_quality} size={12} />
                    </div>
                  )}
                  {review.rating_punctuality != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--hw-text-secondary, var(--text-muted))' }}>Punctuality</span>
                      <StarRating rating={review.rating_punctuality} size={12} />
                    </div>
                  )}
                  {review.rating_communication != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--hw-text-secondary, var(--text-muted))' }}>Communication</span>
                      <StarRating rating={review.rating_communication} size={12} />
                    </div>
                  )}
                  {review.rating_value != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--hw-text-secondary, var(--text-muted))' }}>Value</span>
                      <StarRating rating={review.rating_value} size={12} />
                    </div>
                  )}
                </div>
              )}

              {/* Photos */}
              {review.photos && review.photos.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  {review.photos.map((photo, idx) => (
                    <img
                      key={idx}
                      src={photo}
                      alt={`Review photo ${idx + 1}`}
                      style={{
                        width: '80px',
                        height: '80px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: '1px solid var(--hw-border, var(--border-default))',
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Existing Contractor Response */}
              {review.contractor_response && (
                <div
                  style={{
                    background: 'var(--hw-bg-tertiary, var(--bg-input))',
                    border: '1px solid var(--hw-border, var(--border-default))',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginTop: '0.75rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ color: 'var(--hw-blue-light)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                    </svg>
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: 'var(--hw-text, var(--text-primary))',
                      }}
                    >
                      Your Response
                    </span>
                    {review.contractor_responded_at && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--hw-text-secondary, var(--text-muted))',
                        }}
                      >
                        {formatDate(review.contractor_responded_at)}
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--hw-text-secondary, var(--text-secondary))',
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {review.contractor_response}
                  </p>
                </div>
              )}

              {/* Respond Button / Inline Form */}
              {!review.contractor_response && (
                <div style={{ marginTop: '0.75rem' }}>
                  {respondingTo === review.id ? (
                    <div>
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        placeholder="Write your response to this review..."
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          fontSize: '0.875rem',
                          color: 'var(--hw-text, var(--text-primary))',
                          background: 'var(--hw-bg-tertiary, var(--bg-input))',
                          border: '1px solid var(--hw-border, var(--border-default))',
                          borderRadius: '8px',
                          resize: 'vertical',
                          outline: 'none',
                          fontFamily: 'inherit',
                          lineHeight: 1.5,
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--hw-blue)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--hw-border, var(--border-default))';
                        }}
                      />
                      {submitError && (
                        <div
                          style={{
                            color: 'var(--status-error)',
                            fontSize: '0.8125rem',
                            marginTop: '0.375rem',
                          }}
                        >
                          {submitError}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.625rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
                          onClick={() => {
                            setRespondingTo(null);
                            setResponseText('');
                            setSubmitError('');
                          }}
                          disabled={submitting}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn-primary"
                          style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
                          onClick={() => handleSubmitResponse(review.id)}
                          disabled={submitting || !responseText.trim()}
                        >
                          {submitting ? 'Submitting...' : 'Submit Response'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn-secondary"
                      style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
                      onClick={() => {
                        setRespondingTo(review.id);
                        setResponseText('');
                        setSubmitError('');
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                        </svg>
                        Respond
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
