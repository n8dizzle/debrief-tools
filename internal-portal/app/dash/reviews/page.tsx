'use client';

import { useState } from 'react';

// Mock data - will be replaced with Google Reviews API
const mockReviewStats = {
  today: 2,
  week: 8,
  month: 34,
  averageRating: 4.8,
  totalReviews: 1247,
  responseRate: 92,
};

const mockRecentReviews = [
  {
    id: 1,
    author: 'John M.',
    rating: 5,
    text: 'Excellent service! The technician was professional and fixed our AC quickly.',
    date: '2 hours ago',
    responded: true,
  },
  {
    id: 2,
    author: 'Sarah K.',
    rating: 5,
    text: 'Great experience from start to finish. Would highly recommend!',
    date: '1 day ago',
    responded: true,
  },
  {
    id: 3,
    author: 'Mike R.',
    rating: 4,
    text: 'Good service, arrived on time. Price was fair.',
    date: '2 days ago',
    responded: false,
  },
  {
    id: 4,
    author: 'Lisa T.',
    rating: 5,
    text: 'Christmas Air has been our go-to for years. Never disappointed!',
    date: '3 days ago',
    responded: true,
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className="w-4 h-4"
          fill={star <= rating ? 'var(--christmas-gold)' : 'var(--bg-card)'}
          viewBox="0 0 24 24"
        >
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  subValue,
  icon,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'rgba(184, 149, 107, 0.2)' }}
        >
          {icon}
        </div>
      </div>
      <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="text-2xl font-bold"
          style={{ color: 'var(--christmas-cream)' }}
        >
          {value}
        </span>
        {subValue && (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="New Reviews Today"
          value={mockReviewStats.today}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-gold)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          }
        />
        <StatCard
          label="This Week"
          value={mockReviewStats.week}
          subValue="reviews"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-gold)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          label="Average Rating"
          value={mockReviewStats.averageRating}
          subValue="/ 5.0"
          icon={
            <svg className="w-5 h-5" fill="var(--christmas-gold)" viewBox="0 0 24 24">
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          }
        />
        <StatCard
          label="Response Rate"
          value={`${mockReviewStats.responseRate}%`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-gold)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          }
        />
      </div>

      {/* Recent Reviews */}
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
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {mockReviewStats.totalReviews.toLocaleString()} total reviews
          </span>
        </div>

        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {mockRecentReviews.map((review) => (
            <div
              key={review.id}
              className="p-5 hover:bg-opacity-50 transition-colors"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span
                      className="font-medium"
                      style={{ color: 'var(--christmas-cream)' }}
                    >
                      {review.author}
                    </span>
                    <StarRating rating={review.rating} />
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {review.date}
                  </span>
                </div>
                {review.responded ? (
                  <span
                    className="text-xs px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: 'rgba(74, 222, 128, 0.15)',
                      color: '#4ADE80',
                    }}
                  >
                    Responded
                  </span>
                ) : (
                  <span
                    className="text-xs px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: 'rgba(184, 149, 107, 0.15)',
                      color: 'var(--christmas-gold)',
                    }}
                  >
                    Needs Response
                  </span>
                )}
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {review.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
