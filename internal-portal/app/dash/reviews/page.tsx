'use client';

import { useState, useEffect, useMemo } from 'react';

// Types
interface LocationStats {
  id: string;
  name: string;
  short_name: string;
  total_reviews: number;
  average_rating: number;
  reviews_this_year: number;
  reviews_this_month: number;
  reviews_this_period: number;
  period_change_percent: number | null;
}

interface ReviewStats {
  total_reviews: number;
  average_rating: number;
  reviews_this_year: number;
  reviews_this_month: number;
  reviews_today: number;
  reviews_this_week: number;
  year_goal: number;
  year_progress_percent: number;
  expected_progress_percent: number;
  pacing_status: 'ahead' | 'on_track' | 'behind';
  pacing_difference_percent: number;
  locations: LocationStats[];
  rating_distribution: Record<number, number>;
}

interface Review {
  id: string;
  location_id: string;
  google_review_id: string;
  reviewer_name: string;
  reviewer_photo_url: string | null;
  star_rating: number;
  comment: string | null;
  review_reply: string | null;
  reply_time: string | null;
  create_time: string;
  team_members_mentioned: string[] | null;
  location: {
    id: string;
    name: string;
    short_name: string;
  };
}

// Period presets
type PeriodPreset = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'custom';

function getPeriodDates(preset: PeriodPreset): { start: Date; end: Date } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (preset) {
    case 'this_month':
      return {
        start: new Date(year, month, 1),
        end: now,
      };
    case 'last_month':
      return {
        start: new Date(year, month - 1, 1),
        end: new Date(year, month, 0),
      };
    case 'this_quarter': {
      const quarterStart = Math.floor(month / 3) * 3;
      return {
        start: new Date(year, quarterStart, 1),
        end: now,
      };
    }
    case 'last_quarter': {
      const quarterStart = Math.floor(month / 3) * 3;
      return {
        start: new Date(year, quarterStart - 3, 1),
        end: new Date(year, quarterStart, 0),
      };
    }
    case 'this_year':
      return {
        start: new Date(year, 0, 1),
        end: now,
      };
    default:
      return {
        start: new Date(year, month, 1),
        end: now,
      };
  }
}

// Components
function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={sizeClass}
          fill={star <= rating ? 'var(--christmas-gold)' : 'var(--bg-card)'}
          viewBox="0 0 24 24"
        >
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ))}
    </div>
  );
}

function ProgressBar({
  current,
  expected,
  target,
  label,
}: {
  current: number;
  expected: number;
  target: number;
  label: string;
}) {
  const currentPercent = Math.min((current / target) * 100, 100);
  const expectedPercent = Math.min((expected / target) * 100, 100);
  const difference = currentPercent - expectedPercent;
  const isAhead = difference > 0;

  return (
    <div
      className="rounded-xl p-6"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
            {label}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
            {new Date(new Date().getFullYear(), 11, 31).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
        <div
          className="text-sm px-2 py-1 rounded"
          style={{
            backgroundColor: isAhead ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
            color: isAhead ? '#4ADE80' : '#F87171',
          }}
        >
          {Math.abs(Math.round(difference))}% {isAhead ? 'ahead' : 'behind'}
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4">
        <div className="text-center">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Current</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{current}</div>
        </div>

        <div className="flex-1 relative h-4 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          {/* Current progress */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{
              width: `${currentPercent}%`,
              backgroundColor: isAhead ? '#4ADE80' : '#F87171',
            }}
          />
          {/* Expected marker */}
          <div
            className="absolute inset-y-0 w-1 bg-white/30"
            style={{ left: `${expectedPercent}%` }}
          />
        </div>

        <div className="text-center">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Target</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--text-muted)' }}>{target.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

function LocationCard({
  location,
  showPeriodStats,
}: {
  location: LocationStats;
  showPeriodStats: boolean;
}) {
  const changePercent = location.period_change_percent;
  const isPositive = changePercent !== null && changePercent > 0;
  const isNegative = changePercent !== null && changePercent < 0;

  return (
    <div
      className="rounded-xl p-4 transition-all hover:scale-[1.02]"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {location.short_name}
        </span>
        {changePercent !== null && (
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: isPositive
                ? 'rgba(74, 222, 128, 0.15)'
                : isNegative
                ? 'rgba(248, 113, 113, 0.15)'
                : 'rgba(156, 163, 175, 0.15)',
              color: isPositive ? '#4ADE80' : isNegative ? '#F87171' : '#9CA3AF',
            }}
          >
            {isPositive ? '+' : ''}{Math.round(changePercent)}%
          </span>
        )}
      </div>

      <div className="text-3xl font-bold mb-2" style={{ color: 'var(--christmas-cream)' }}>
        {showPeriodStats ? location.reviews_this_period : location.reviews_this_year}
      </div>

      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {location.total_reviews.toLocaleString()} total
        {location.average_rating > 0 && (
          <span className="ml-2">
            {location.average_rating.toFixed(2)} avg
          </span>
        )}
      </div>
    </div>
  );
}

function TotalReviewsCard({ stats }: { stats: ReviewStats }) {
  return (
    <div
      className="rounded-xl p-5 row-span-2"
      style={{
        backgroundColor: 'var(--christmas-green)',
      }}
    >
      <div className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
        Total Google Reviews
      </div>
      <div className="text-5xl font-bold mb-2" style={{ color: 'var(--christmas-cream)' }}>
        {stats.total_reviews.toLocaleString()}
      </div>
      <div className="text-sm" style={{ color: 'var(--christmas-cream)', opacity: 0.8 }}>
        {stats.reviews_this_year.toLocaleString()} this year
      </div>
    </div>
  );
}

function AverageRatingCard({ stats }: { stats: ReviewStats }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col items-center justify-center row-span-2"
      style={{
        backgroundColor: 'var(--christmas-green)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-5 h-5" fill="var(--christmas-gold)" viewBox="0 0 24 24">
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        <span className="text-sm" style={{ color: 'var(--christmas-cream)' }}>Average Rating</span>
      </div>
      <div className="text-5xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
        {stats.average_rating.toFixed(2)}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const formattedDate = new Date(review.create_time).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const timeAgo = useMemo(() => {
    const now = new Date();
    const reviewDate = new Date(review.create_time);
    const diffMs = now.getTime() - reviewDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }, [review.create_time]);

  const hasTeamMentions = review.team_members_mentioned && review.team_members_mentioned.length > 0;

  return (
    <div
      className="p-5 border-b last:border-b-0"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
            style={{
              backgroundColor: 'var(--christmas-green)',
              color: 'var(--christmas-cream)',
            }}
          >
            {review.reviewer_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                {review.reviewer_name}
              </span>
              <StarRating rating={review.star_rating} />
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>{timeAgo}</span>
              <span>•</span>
              <span>{review.location.short_name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasTeamMentions && (
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                backgroundColor: 'rgba(184, 149, 107, 0.2)',
                color: 'var(--christmas-gold)',
              }}
            >
              {review.team_members_mentioned!.join(', ')}
            </span>
          )}
          {review.review_reply ? (
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                backgroundColor: 'rgba(74, 222, 128, 0.15)',
                color: '#4ADE80',
              }}
            >
              Replied
            </span>
          ) : (
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                backgroundColor: 'rgba(248, 113, 113, 0.15)',
                color: '#F87171',
              }}
            >
              Needs Reply
            </span>
          )}
        </div>
      </div>

      {review.comment && (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {review.comment}
        </p>
      )}

      {review.review_reply && (
        <div
          className="mt-3 p-3 rounded-lg text-sm"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Response from Christmas Air
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>{review.review_reply}</p>
        </div>
      )}
    </div>
  );
}

export default function ReviewsPage() {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodPreset>('this_month');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [syncing, setSyncing] = useState(false);
  const [showTeamMentionsOnly, setShowTeamMentionsOnly] = useState(false);

  const periodDates = getPeriodDates(period);

  // Fetch stats
  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          year: new Date().getFullYear().toString(),
          periodStart: periodDates.start.toISOString(),
          periodEnd: periodDates.end.toISOString(),
        });

        const response = await fetch(`/api/reviews/stats?${params}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          console.error('Stats API error:', response.status, await response.text());
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [period]);

  // Fetch reviews
  useEffect(() => {
    async function fetchReviews() {
      setReviewsLoading(true);
      try {
        const params = new URLSearchParams({
          limit: '50',
          startDate: periodDates.start.toISOString(),
          endDate: periodDates.end.toISOString(),
        });

        if (selectedLocation !== 'all') {
          params.set('locationId', selectedLocation);
        }

        if (ratingFilter !== 'all') {
          params.set('rating', ratingFilter);
        }

        if (showTeamMentionsOnly) {
          params.set('hasTeamMention', 'true');
        }

        const response = await fetch(`/api/reviews?${params}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setReviews(data.reviews || []);
        }
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      } finally {
        setReviewsLoading(false);
      }
    }

    fetchReviews();
  }, [period, selectedLocation, ratingFilter, showTeamMentionsOnly]);

  // Sync reviews
  async function handleSync() {
    setSyncing(true);
    try {
      const response = await fetch('/api/reviews/sync', { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        // Refresh data
        window.location.reload();
      } else {
        alert(`Sync failed: ${data.error}`);
      }
    } catch (error) {
      alert('Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto animate-pulse">
        <div className="h-8 w-48 rounded mb-8" style={{ backgroundColor: 'var(--bg-card)' }} />
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-xl" style={{ backgroundColor: 'var(--bg-card)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-7xl mx-auto text-center py-12">
        <p style={{ color: 'var(--text-secondary)' }}>Failed to load review data</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--christmas-cream)' }}
          >
            Google Reviews
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Track customer feedback and review performance
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodPreset)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--christmas-cream)',
            }}
          >
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="last_quarter">Last Quarter</option>
            <option value="this_year">This Year</option>
          </select>

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            style={{
              backgroundColor: 'var(--christmas-green)',
              color: 'var(--christmas-cream)',
              opacity: syncing ? 0.7 : 1,
            }}
          >
            {syncing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Reviews
              </>
            )}
          </button>
        </div>
      </div>

      {/* Year Goal Pacing */}
      <div className="mb-8">
        <div
          className="px-4 py-2 rounded-t-lg"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            {new Date().getFullYear()} Google Reviews Goal
          </h2>
        </div>
        <ProgressBar
          current={stats.reviews_this_year}
          expected={Math.round((stats.expected_progress_percent / 100) * stats.year_goal)}
          target={stats.year_goal}
          label={`${new Date().getFullYear()} Review Goal`}
        />
      </div>

      {/* Total Reviews Header */}
      <div
        className="px-4 py-2 rounded-t-lg mb-0"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--christmas-cream)' }}>
          Total Google Reviews
        </h2>
      </div>

      {/* Location Cards Grid */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4 rounded-b-xl mb-8"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderTop: 'none',
        }}
      >
        {/* Total + Average Rating */}
        <TotalReviewsCard stats={stats} />

        {/* Location Cards */}
        {stats.locations.map((location) => (
          <LocationCard
            key={location.id}
            location={location}
            showPeriodStats={period !== 'this_year'}
          />
        ))}

        {/* Average Rating */}
        <AverageRatingCard stats={stats} />
      </div>

      {/* Reviews During Period Section */}
      <div
        className="px-4 py-2 rounded-t-lg"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--christmas-cream)' }}>
          Google Reviews During Period
        </h2>
      </div>

      <div
        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 p-4 rounded-b-xl mb-8"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderTop: 'none',
        }}
      >
        {stats.locations.map((location) => (
          <div
            key={location.id}
            className="rounded-lg p-4 text-center"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {location.short_name}
              </span>
              {location.period_change_percent !== null && (
                <span
                  className="text-xs"
                  style={{
                    color: location.period_change_percent >= 0 ? '#4ADE80' : '#F87171',
                  }}
                >
                  {location.period_change_percent >= 0 ? '+' : ''}
                  {Math.round(location.period_change_percent)}%
                </span>
              )}
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {location.reviews_this_period}
            </div>
          </div>
        ))}
      </div>

      {/* Reviews List Section */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div
          className="flex items-center justify-between p-5 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(184, 149, 107, 0.2)' }}
            >
              <svg className="w-4 h-4" fill="var(--christmas-gold)" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              Recent Reviews
            </h3>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <option value="all">All Locations</option>
              {stats.locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.short_name}
                </option>
              ))}
            </select>

            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <option value="all">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>

            <button
              onClick={() => setShowTeamMentionsOnly(!showTeamMentionsOnly)}
              className="px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: showTeamMentionsOnly ? 'var(--christmas-gold)' : 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: showTeamMentionsOnly ? 'var(--bg-primary)' : 'var(--text-secondary)',
              }}
            >
              Team Mentions
            </button>
          </div>
        </div>

        {/* Reviews List */}
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {reviewsLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 mx-auto rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--christmas-gold)', borderTopColor: 'transparent' }} />
            </div>
          ) : reviews.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              No reviews found for the selected filters.
              <br />
              <span className="text-sm">
                Click "Sync Reviews" to pull the latest data from Google.
              </span>
            </div>
          ) : (
            reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
