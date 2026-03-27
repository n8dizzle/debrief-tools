'use client';

import { useState, useEffect, useCallback } from 'react';

interface ContractorProfile {
  id: string;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
}

interface StripeStatus {
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements: {
    currently_due?: string[];
    eventually_due?: string[];
    past_due?: string[];
    disabled_reason?: string | null;
  } | null;
}

interface OrderItem {
  id: string;
  order_id: string;
  contractor_payout: number | null;
  completed_at: string | null;
  status: string;
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

interface MonthlyEarning {
  month: string;
  label: string;
  total: number;
  count: number;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getMonthlyEarnings(items: OrderItem[]): MonthlyEarning[] {
  const monthMap = new Map<string, MonthlyEarning>();

  for (const item of items) {
    if (!item.completed_at || !item.contractor_payout) continue;
    const d = new Date(item.completed_at);
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    const existing = monthMap.get(key);
    if (existing) {
      existing.total += item.contractor_payout;
      existing.count += 1;
    } else {
      monthMap.set(key, {
        month: key,
        label,
        total: item.contractor_payout,
        count: 1,
      });
    }
  }

  return Array.from(monthMap.values()).sort((a, b) =>
    b.month.localeCompare(a.month)
  );
}

export default function PayoutsPage() {
  const [contractor, setContractor] = useState<ContractorProfile | null>(null);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [completedItems, setCompletedItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectLoading, setConnectLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [error, setError] = useState('');

  const stripeConnected =
    contractor?.stripe_charges_enabled && contractor?.stripe_payouts_enabled;

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setContractor(data.contractor);
      }
    } catch {
      // silently fail
    }
  }, []);

  const fetchStripeStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/stripe-connect/status');
      if (res.ok) {
        const data = await res.json();
        setStripeStatus(data);
        await fetchProfile();
      }
    } catch {
      // silently fail
    } finally {
      setStatusLoading(false);
    }
  }, [fetchProfile]);

  const fetchCompletedOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?status=completed&limit=100');
      if (res.ok) {
        const data = await res.json();
        setCompletedItems(data.order_items || []);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchProfile();
      setLoading(false);
    }
    init();
  }, [fetchProfile]);

  useEffect(() => {
    if (contractor?.stripe_account_id) {
      fetchStripeStatus();
      fetchCompletedOrders();
    } else if (contractor) {
      fetchCompletedOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractor?.stripe_account_id]);

  async function handleConnectStripe() {
    setConnectLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe-connect/onboard', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to start Stripe onboarding');
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Failed to connect with Stripe. Please try again.');
    } finally {
      setConnectLoading(false);
    }
  }

  async function handleOpenDashboard() {
    setDashboardLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe-connect/dashboard');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to open Stripe dashboard');
        return;
      }
      window.open(data.url, '_blank');
    } catch {
      setError('Failed to open Stripe dashboard. Please try again.');
    } finally {
      setDashboardLoading(false);
    }
  }

  const monthlyEarnings = getMonthlyEarnings(completedItems);
  const thisMonthKey = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();
  const lastMonthKey = (() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`;
  })();
  const thisMonthEarnings =
    monthlyEarnings.find((m) => m.month === thisMonthKey)?.total || 0;
  const lastMonthEarnings =
    monthlyEarnings.find((m) => m.month === lastMonthKey)?.total || 0;
  const totalEarnings = completedItems.reduce(
    (sum, item) => sum + (item.contractor_payout || 0),
    0
  );

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid var(--border-default)',
              borderTopColor: 'var(--hw-blue)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 1rem',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Loading...
          </div>
        </div>
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
            color: 'var(--text-primary)',
            margin: '0 0 0.25rem',
          }}
        >
          Payouts
        </h1>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            margin: 0,
          }}
        >
          Track your earnings and manage payout settings.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            background: 'var(--status-error-bg)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            color: 'var(--status-error)',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--status-error)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Stripe Connect Status Card */}
      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: stripeConnected
                ? 'var(--status-success-bg)'
                : 'var(--status-warning-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {stripeConnected ? (
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="var(--status-success)"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="var(--status-warning)"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            )}
          </div>
          <div>
            <div
              style={{
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {stripeConnected
                ? 'Stripe Connected'
                : contractor?.stripe_account_id
                  ? 'Stripe Setup Incomplete'
                  : 'Stripe Not Connected'}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {stripeConnected
                ? 'Payouts are deposited to your bank account weekly on Fridays.'
                : contractor?.stripe_account_id
                  ? 'Complete your Stripe onboarding to start receiving payouts.'
                  : 'Connect your Stripe account to receive payouts for completed jobs.'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {stripeConnected && (
            <>
              <button
                className="btn-secondary"
                onClick={handleOpenDashboard}
                disabled={dashboardLoading}
                style={{ fontSize: '0.8125rem' }}
              >
                {dashboardLoading ? 'Opening...' : 'Open Stripe Dashboard'}
              </button>
              <button
                className="btn-secondary"
                onClick={fetchStripeStatus}
                disabled={statusLoading}
                style={{ fontSize: '0.8125rem' }}
              >
                {statusLoading ? 'Refreshing...' : 'Refresh Status'}
              </button>
            </>
          )}
          {!stripeConnected && contractor?.stripe_account_id && (
            <>
              <button
                className="btn-primary"
                onClick={handleConnectStripe}
                disabled={connectLoading}
              >
                {connectLoading ? 'Redirecting...' : 'Continue Setup'}
              </button>
              <button
                className="btn-secondary"
                onClick={fetchStripeStatus}
                disabled={statusLoading}
                style={{ fontSize: '0.8125rem' }}
              >
                {statusLoading ? 'Refreshing...' : 'Refresh Status'}
              </button>
            </>
          )}
          {!contractor?.stripe_account_id && (
            <button
              className="btn-primary"
              onClick={handleConnectStripe}
              disabled={connectLoading}
            >
              {connectLoading ? 'Redirecting...' : 'Connect with Stripe'}
            </button>
          )}
        </div>
      </div>

      {/* Pending Requirements Notice */}
      {stripeStatus &&
        !stripeConnected &&
        contractor?.stripe_account_id &&
        stripeStatus.requirements?.currently_due &&
        stripeStatus.requirements.currently_due.length > 0 && (
          <div
            style={{
              background: 'var(--status-warning-bg)',
              border: '1px solid rgba(234, 179, 8, 0.2)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              color: 'var(--status-warning)',
              fontSize: '0.875rem',
            }}
          >
            <strong>Action required:</strong> Stripe needs additional information
            to enable payouts. Click &quot;Continue Setup&quot; to complete your
            account.
          </div>
        )}

      {/* CTA card for not-yet-connected users */}
      {!contractor?.stripe_account_id && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--status-info-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <svg
              width="28"
              height="28"
              fill="none"
              stroke="var(--status-info)"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
              />
            </svg>
          </div>
          <h3
            style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 0.5rem',
            }}
          >
            Set up Stripe to receive payouts
          </h3>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              margin: '0 0 1.5rem',
              maxWidth: '400px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Connect your Stripe account to receive direct deposits for completed
            jobs. Payouts are processed weekly on Fridays.
          </p>
          <button
            className="btn-primary"
            style={{ padding: '0.75rem 2rem' }}
            onClick={handleConnectStripe}
            disabled={connectLoading}
          >
            {connectLoading ? 'Redirecting...' : 'Connect with Stripe'}
          </button>
        </div>
      )}

      {/* Show earnings content if connected OR if there are completed orders */}
      {(stripeConnected || completedItems.length > 0) && (
        <>
          {/* Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div className="card">
              <div
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.375rem',
                }}
              >
                Total Earnings
              </div>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                {formatCents(totalEarnings)}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.25rem',
                }}
              >
                {completedItems.length} completed{' '}
                {completedItems.length === 1 ? 'job' : 'jobs'}
              </div>
            </div>
            <div className="card">
              <div
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.375rem',
                }}
              >
                This Month
              </div>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--status-success)',
                }}
              >
                {formatCents(thisMonthEarnings)}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.25rem',
                }}
              >
                {monthlyEarnings.find((m) => m.month === thisMonthKey)?.count || 0}{' '}
                {(monthlyEarnings.find((m) => m.month === thisMonthKey)?.count || 0) === 1
                  ? 'job'
                  : 'jobs'}
              </div>
            </div>
            <div className="card">
              <div
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.375rem',
                }}
              >
                Last Month
              </div>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                {formatCents(lastMonthEarnings)}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.25rem',
                }}
              >
                {monthlyEarnings.find((m) => m.month === lastMonthKey)?.count || 0}{' '}
                {(monthlyEarnings.find((m) => m.month === lastMonthKey)?.count || 0) === 1
                  ? 'job'
                  : 'jobs'}
              </div>
            </div>
          </div>

          {/* Monthly Earnings Breakdown */}
          {monthlyEarnings.length > 0 && (
            <div
              className="card"
              style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}
            >
              <div
                style={{
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
                  Monthly Earnings
                </h2>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th style={{ textAlign: 'center' }}>Jobs</th>
                      <th style={{ textAlign: 'right' }}>Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyEarnings.map((m) => (
                      <tr key={m.month}>
                        <td
                          style={{
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {m.label}
                        </td>
                        <td
                          style={{
                            textAlign: 'center',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {m.count}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            color: 'var(--status-success)',
                          }}
                        >
                          {formatCents(m.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payout History Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
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
                Payout History
              </h2>
            </div>
            {completedItems.length === 0 ? (
              <div
                style={{
                  padding: '3rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.875rem',
                }}
              >
                No completed jobs yet. Payouts will appear here after you
                complete your first job.
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Service</th>
                      <th>Customer</th>
                      <th>Completed</th>
                      <th style={{ textAlign: 'right' }}>Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span
                            style={{
                              fontWeight: 500,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {item.orders?.order_number || '--'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-primary)' }}>
                          {item.catalog_services?.name || '--'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {item.orders?.user_profiles?.full_name || '--'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {formatDate(item.completed_at)}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            color: 'var(--status-success)',
                          }}
                        >
                          {item.contractor_payout
                            ? formatCents(item.contractor_payout)
                            : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
