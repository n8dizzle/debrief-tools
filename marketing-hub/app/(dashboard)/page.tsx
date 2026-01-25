'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';

// Stat card component
function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  href,
}: {
  title: string;
  value: string;
  change?: string;
  changeLabel?: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const content = (
    <div
      className="rounded-xl p-5 transition-colors"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'var(--christmas-green)', opacity: 0.9 }}
        >
          {icon}
        </div>
        {change && (
          <span
            className="text-xs font-medium px-2 py-1 rounded-full"
            style={{
              backgroundColor: change.startsWith('+') ? 'rgba(93, 138, 102, 0.2)' : 'rgba(139, 45, 50, 0.2)',
              color: change.startsWith('+') ? 'var(--christmas-green-light)' : '#c97878',
            }}
          >
            {change}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold mb-1" style={{ color: 'var(--christmas-cream)' }}>
        {value}
      </div>
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {title}
      </div>
      {changeLabel && (
        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          {changeLabel}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}

// Quick action card
function QuickActionCard({
  title,
  description,
  icon,
  href,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl p-4 flex items-center gap-4 transition-colors hover:opacity-90"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'var(--christmas-green)', opacity: 0.9 }}
      >
        {icon}
      </div>
      <div>
        <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
          {title}
        </div>
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {description}
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Marketing Hub
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Welcome back, {session?.user?.name?.split(' ')[0] || 'there'}
          </p>
        </div>
        <button
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--christmas-green)',
            color: 'var(--christmas-cream)',
          }}
        >
          Sync All Data
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Website Sessions"
          value="--"
          change="--"
          changeLabel="vs. last period"
          href="/analytics"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          }
        />
        <StatCard
          title="GBP Profile Views"
          value="--"
          change="--"
          changeLabel="vs. last period"
          href="/performance"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          title="Social Reach"
          value="--"
          change="--"
          changeLabel="vs. last period"
          href="/social"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          }
        />
        <StatCard
          title="Tasks Due Today"
          value="--"
          changeLabel="Connect integrations to see data"
          href="/tasks"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickActionCard
            title="Create GBP Post"
            description="Publish to all 8 locations"
            href="/posts/new"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            }
          />
          <QuickActionCard
            title="View Tasks"
            description="See what's due today"
            href="/tasks"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            }
          />
          <QuickActionCard
            title="GBP Insights"
            description="View performance metrics"
            href="/performance"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div
          className="rounded-xl p-5"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Recent Activity
          </h2>
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">No recent activity</p>
            <p className="text-xs mt-1">Activity will appear here once you start using the hub</p>
          </div>
        </div>

        {/* Tasks Due */}
        <div
          className="rounded-xl p-5"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              Tasks Due Today
            </h2>
            <Link
              href="/tasks"
              className="text-sm"
              style={{ color: 'var(--christmas-green-light)' }}
            >
              View all
            </Link>
          </div>
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">No tasks due today</p>
            <Link
              href="/tasks"
              className="text-xs mt-1 inline-block"
              style={{ color: 'var(--christmas-green-light)' }}
            >
              Create a task
            </Link>
          </div>
        </div>
      </div>

      {/* Setup Banner - shown until integrations are connected */}
      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: 'rgba(93, 138, 102, 0.1)',
          border: '1px solid var(--christmas-green)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--christmas-green)' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              Complete Your Setup
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Connect Google Analytics and social media accounts to see your marketing metrics.
            </p>
          </div>
          <Link
            href="/settings"
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-block text-center"
            style={{
              backgroundColor: 'var(--christmas-green)',
              color: 'var(--christmas-cream)',
            }}
          >
            Go to Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
