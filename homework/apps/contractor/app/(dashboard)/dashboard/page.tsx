'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardStats {
  pending_orders: number;
  active_orders: number;
  completed_this_month: number;
  month_earnings: number;
  total_earnings: number;
  rating: number | null;
  review_count: number;
  jobs_completed: number;
  stripe_connected: boolean;
}

interface RecentOrder {
  id: string;
  status: string;
  price_snapshot: number | null;
  contractor_payout: number | null;
  scheduled_date: string | null;
  completed_at: string | null;
  catalog_services: {
    id: string;
    name: string;
  } | null;
  orders: {
    id: string;
    order_number: string;
    user_profiles: {
      full_name: string;
    } | null;
  } | null;
}

const statusColors: Record<string, string> = {
  pending: 'badge-warning',
  assigned: 'badge-warning',
  confirmed: 'badge-info',
  scheduled: 'badge-info',
  in_progress: 'badge-info',
  completed: 'badge-success',
  cancelled: 'badge-error',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  confirmed: 'Confirmed',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to load dashboard');
        }
        const data = await res.json();
        setStats(data.stats);
        setRecentOrders(data.recent_orders || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--border-default)',
            borderTopColor: 'var(--hw-blue)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ color: 'var(--status-error)', marginBottom: '0.5rem' }}>{error}</div>
        <button className="btn-secondary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  const summaryCards = [
    {
      label: 'Pending Orders',
      value: String(stats?.pending_orders || 0),
      change: 'Awaiting confirmation',
      changeType: stats?.pending_orders ? 'warning' : 'neutral',
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Active Orders',
      value: String(stats?.active_orders || 0),
      change: 'In progress',
      changeType: 'neutral' as const,
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
        </svg>
      ),
    },
    {
      label: 'Completed This Month',
      value: String(stats?.completed_this_month || 0),
      change: stats?.month_earnings ? formatCents(stats.month_earnings) + ' earned' : 'No earnings yet',
      changeType: stats?.completed_this_month ? 'positive' : 'neutral',
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Total Earnings',
      value: formatCents(stats?.total_earnings || 0),
      change: `${stats?.jobs_completed || 0} jobs completed`,
      changeType: 'neutral' as const,
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Rating',
      value: stats?.rating != null ? stats.rating.toFixed(1) : '--',
      change: stats?.review_count ? `${stats.review_count} reviews` : 'No reviews yet',
      changeType: 'neutral' as const,
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0 0 0.25rem',
          }}
        >
          Dashboard
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
          Welcome back. Here&apos;s how your business is doing.
        </p>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {summaryCards.map((card) => (
          <div key={card.label} className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1rem',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.375rem',
                  }}
                >
                  {card.label}
                </div>
                <div
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    lineHeight: 1,
                  }}
                >
                  {card.value}
                </div>
              </div>
              <div
                style={{
                  color: 'var(--hw-blue-light)',
                  opacity: 0.7,
                }}
              >
                {card.icon}
              </div>
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color:
                  card.changeType === 'positive'
                    ? 'var(--status-success)'
                    : card.changeType === 'warning'
                    ? 'var(--status-warning)'
                    : 'var(--text-muted)',
              }}
            >
              {card.change}
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '1.5rem',
        }}
      >
        {/* Recent Orders */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-default)',
            }}
          >
            <h2
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Recent Orders
            </h2>
            <Link
              href="/orders"
              style={{
                fontSize: '0.8125rem',
                color: 'var(--hw-blue-light)',
                textDecoration: 'none',
              }}
            >
              View All
            </Link>
          </div>
          {recentOrders.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Service</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Payout</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {order.orders?.order_number || '--'}
                      </span>
                    </td>
                    <td>{order.catalog_services?.name || '--'}</td>
                    <td>{order.orders?.user_profiles?.full_name || '--'}</td>
                    <td>
                      <span className={`badge ${statusColors[order.status] || 'badge-info'}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>
                      {order.contractor_payout ? formatCents(order.contractor_payout) : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No orders yet. Once you set your prices and availability, orders will appear here.
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 1rem',
            }}
          >
            Quick Actions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <Link
              href="/pricebook"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: 'var(--bg-input)',
                borderRadius: '8px',
                textDecoration: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-input)')}
            >
              <svg width="18" height="18" fill="none" stroke="var(--hw-blue-light)" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Update Pricing
            </Link>
            <Link
              href="/availability"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: 'var(--bg-input)',
                borderRadius: '8px',
                textDecoration: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-input)')}
            >
              <svg width="18" height="18" fill="none" stroke="var(--hw-blue-light)" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              Set Availability
            </Link>
            <Link
              href="/payouts"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: 'var(--bg-input)',
                borderRadius: '8px',
                textDecoration: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-input)')}
            >
              <svg width="18" height="18" fill="none" stroke="var(--hw-blue-light)" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
              View Payouts
            </Link>
            <Link
              href="/profile"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: 'var(--bg-input)',
                borderRadius: '8px',
                textDecoration: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-input)')}
            >
              <svg width="18" height="18" fill="none" stroke="var(--hw-blue-light)" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              Edit Profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
