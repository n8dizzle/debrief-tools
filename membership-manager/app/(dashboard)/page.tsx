'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useMembershipPermissions } from '@/hooks/useMembershipPermissions';
import { formatTimestamp, formatDate } from '@/lib/mm-utils';

interface DashboardData {
  stats: {
    active_memberships: number;
    overdue_visits: number;
    expiring_30_days: number;
    fulfillment_rate: number;
    last_sync: string | null;
  };
  by_type: Record<string, number>;
  expiring_breakdown: {
    '30_days': number;
    '60_days': number;
    '90_days': number;
  };
  top_overdue: Array<{
    id: string;
    customer_name: string;
    customer_address: string;
    membership_type_name: string;
    next_visit_due_date: string;
  }>;
}

export default function DashboardPage() {
  const { canSyncData } = useMembershipPermissions();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        await loadData();
      } else {
        console.error('Sync failed');
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  const stats = data?.stats;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Dashboard
          </h1>
          {stats?.last_sync && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Last sync: {formatTimestamp(stats.last_sync)}
            </p>
          )}
        </div>
        {canSyncData && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn btn-primary"
            style={{ opacity: syncing ? 0.6 : 1 }}
          >
            {syncing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </>
            )}
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Memberships"
          value={stats?.active_memberships ?? '—'}
          loading={loading}
          color="var(--christmas-green)"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          label="Overdue Visits"
          value={stats?.overdue_visits ?? '—'}
          loading={loading}
          color="var(--status-error)"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
        <StatCard
          label="Expiring in 30 Days"
          value={stats?.expiring_30_days ?? '—'}
          loading={loading}
          color="var(--status-warning)"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Visit Fulfillment"
          value={stats ? `${stats.fulfillment_rate}%` : '—'}
          loading={loading}
          color="var(--status-success)"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Memberships by Type */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Memberships by Type
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-8 rounded animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
              ))}
            </div>
          ) : data?.by_type && Object.keys(data.by_type).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(data.by_type)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count]) => {
                  const total = stats?.active_memberships || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span style={{ color: 'var(--text-secondary)' }}>{name}</span>
                        <span style={{ color: 'var(--text-primary)' }}>{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full" style={{ background: 'var(--bg-secondary)' }}>
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${pct}%`, background: 'var(--christmas-green)' }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No membership data yet. Run a sync to get started.</p>
          )}
        </div>

        {/* Expiring Breakdown */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Expiring Soon
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 rounded animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <ExpiryBucket label="Next 30 days" count={data?.expiring_breakdown['30_days'] || 0} color="var(--status-error)" />
              <ExpiryBucket label="31-60 days" count={data?.expiring_breakdown['60_days'] || 0} color="var(--status-warning)" />
              <ExpiryBucket label="61-90 days" count={data?.expiring_breakdown['90_days'] || 0} color="var(--christmas-gold)" />
            </div>
          )}
        </div>
      </div>

      {/* Top Overdue */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            Most Overdue Visits
          </h2>
          <Link
            href="/queue"
            className="text-sm font-medium"
            style={{ color: 'var(--christmas-green-light)' }}
          >
            View Action Queue
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 rounded animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
            ))}
          </div>
        ) : data?.top_overdue && data.top_overdue.length > 0 ? (
          <div className="table-wrapper">
            <table className="mm-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Address</th>
                  <th>Type</th>
                  <th>Visit Due</th>
                </tr>
              </thead>
              <tbody>
                {data.top_overdue.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        href={`/memberships/${item.id}`}
                        className="font-medium"
                        style={{ color: 'var(--christmas-green-light)' }}
                      >
                        {item.customer_name || 'Unknown'}
                      </Link>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{item.customer_address || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{item.membership_type_name || '—'}</td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-error)' }}>
                        {formatDate(item.next_visit_due_date)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No overdue visits. Great job!</p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  loading: boolean;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
          {loading ? (
            <div className="h-8 w-16 rounded animate-pulse mt-1" style={{ background: 'var(--bg-secondary)' }} />
          ) : (
            <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
          )}
        </div>
        <div
          className="p-2 rounded-lg"
          style={{ background: `${color}15`, color }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function ExpiryBucket({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg"
      style={{ background: 'var(--bg-secondary)' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full" style={{ background: color }} />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <span className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{count}</span>
    </div>
  );
}
