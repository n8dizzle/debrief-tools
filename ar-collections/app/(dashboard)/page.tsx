'use client';

import { useEffect, useState } from 'react';
import { formatCurrency, getAgingBucketLabel } from '@/lib/ar-utils';
import { ARDashboardStats } from '@/lib/supabase';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState<ARDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/dashboard', {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard stats');
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center" style={{ color: 'var(--text-muted)' }}>
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="text-center" style={{ color: 'var(--status-error)' }}>
          {error}
        </div>
      </div>
    );
  }

  // Show placeholder data if no stats yet
  const displayStats = stats || {
    total_outstanding: 0,
    ar_collectible: 0,
    ar_not_in_control: 0,
    avg_dso: 0,
    aging_buckets: { current: 0, bucket_30: 0, bucket_60: 0, bucket_90_plus: 0 },
    install_total: 0,
    service_total: 0,
    residential_total: 0,
    commercial_total: 0,
    top_balances: [],
    recent_activity: [],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            AR Collections Dashboard
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Accounts Receivable Overview
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="btn btn-secondary"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Total Outstanding
          </div>
          <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {formatCurrency(displayStats.total_outstanding)}
          </div>
        </div>

        <div className="card">
          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            AR Collectible
          </div>
          <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--status-success)' }}>
            {formatCurrency(displayStats.ar_collectible)}
          </div>
        </div>

        <div className="card">
          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            AR Not In Control
          </div>
          <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--status-warning)' }}>
            {formatCurrency(displayStats.ar_not_in_control)}
          </div>
        </div>

        <div className="card">
          <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Average DSO
          </div>
          <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {displayStats.avg_dso} days
          </div>
        </div>
      </div>

      {/* Aging Buckets & Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aging Buckets */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Aging Breakdown
          </h2>
          <div className="space-y-4">
            {[
              { key: 'current' as const, label: 'Current (0-30 days)', value: displayStats.aging_buckets.current, color: 'var(--status-success)' },
              { key: 'bucket_30' as const, label: '31-60 days', value: displayStats.aging_buckets.bucket_30, color: 'var(--status-warning)' },
              { key: 'bucket_60' as const, label: '61-90 days', value: displayStats.aging_buckets.bucket_60, color: '#f97316' },
              { key: 'bucket_90_plus' as const, label: '90+ days', value: displayStats.aging_buckets.bucket_90_plus, color: 'var(--status-error)' },
            ].map((bucket) => {
              const percent = displayStats.total_outstanding > 0
                ? (bucket.value / displayStats.total_outstanding) * 100
                : 0;
              return (
                <div key={bucket.key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'var(--text-secondary)' }}>{bucket.label}</span>
                    <span style={{ color: bucket.color }}>{formatCurrency(bucket.value)}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${percent}%`, backgroundColor: bucket.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Install vs Service */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Install vs Service
          </h2>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--christmas-green)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Install Jobs</span>
                </div>
                <span className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                  {formatCurrency(displayStats.install_total)}
                </span>
              </div>
              <Link href="/invoices/install" className="text-sm hover:underline">
                View Install AR →
              </Link>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--status-info)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Service Jobs</span>
                </div>
                <span className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                  {formatCurrency(displayStats.service_total)}
                </span>
              </div>
              <Link href="/invoices/service" className="text-sm hover:underline">
                View Service AR →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Residential vs Commercial */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Residential vs Commercial
        </h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8b5cf6' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Residential</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {formatCurrency(displayStats.residential_total)}
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {displayStats.total_outstanding > 0
                ? `${((displayStats.residential_total / displayStats.total_outstanding) * 100).toFixed(1)}%`
                : '0%'} of total
            </div>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Commercial</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {formatCurrency(displayStats.commercial_total)}
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {displayStats.total_outstanding > 0
                ? `${((displayStats.commercial_total / displayStats.total_outstanding) * 100).toFixed(1)}%`
                : '0%'} of total
            </div>
          </div>
        </div>
      </div>

      {/* Top Balances & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Balances */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Top 5 Highest Balances
          </h2>
          {displayStats.top_balances.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              No open invoices found
            </div>
          ) : (
            <div className="space-y-3">
              {displayStats.top_balances.map((invoice, index) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                      style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {invoice.customer_name}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Invoice #{invoice.invoice_number}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold" style={{ color: 'var(--status-error)' }}>
                      {formatCurrency(invoice.balance)}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {invoice.days_outstanding} days
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Recent Activity
          </h2>
          {displayStats.recent_activity.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              No recent activity
            </div>
          ) : (
            <div className="space-y-3">
              {displayStats.recent_activity.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--christmas-green-light)' }}>
                      {note.author_initials.toUpperCase()}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(note.note_date).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
