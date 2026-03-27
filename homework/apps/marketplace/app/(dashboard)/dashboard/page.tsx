'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_cents: number;
  created_at: string;
  items?: { service?: { name: string } }[];
}

interface Home {
  id: string;
  nickname: string | null;
  address_line1: string;
  city: string;
  state: string;
  zip_code: string;
}

interface DashboardData {
  orders: Order[];
  homes: Home[];
  activeOrderCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_payment: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-orange-100 text-orange-700',
};

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Chicago',
  }).format(new Date(dateStr));
}

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg)]">
      <div className="h-3 w-20 rounded bg-[var(--hw-bg-tertiary)]" />
      <div className="mt-2 h-8 w-12 rounded bg-[var(--hw-bg-tertiary)]" />
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        // Fetch orders and homes in parallel
        const [ordersRes, homesRes] = await Promise.all([
          fetch('/api/orders?per_page=5'),
          fetch('/api/homes'),
        ]);

        const orders: Order[] = [];
        const homes: Home[] = [];
        let activeOrderCount = 0;

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          orders.push(...(ordersData.orders || ordersData.data || []));
          activeOrderCount = (ordersData.orders || ordersData.data || []).filter(
            (o: Order) => !['completed', 'cancelled', 'refunded'].includes(o.status)
          ).length;
        }

        if (homesRes.ok) {
          const homesData = await homesRes.json();
          homes.push(...(homesData.homes || homesData.data || []));
        }

        setData({ orders, homes, activeOrderCount });
      } catch (err) {
        console.error('Failed to fetch dashboard:', err);
        setData({ orders: [], homes: [], activeOrderCount: 0 });
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-[var(--hw-text)]">Dashboard</h1>
      <p className="mt-1 text-sm text-[var(--hw-text-secondary)]">
        Welcome back! Here is a summary of your account.
      </p>

      {/* Stat cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <div className="rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg)]">
              <p className="text-sm text-[var(--hw-text-secondary)]">Active Orders</p>
              <p className="mt-1 text-3xl font-bold text-[var(--hw-text)]">
                {data?.activeOrderCount || 0}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg)]">
              <p className="text-sm text-[var(--hw-text-secondary)]">My Homes</p>
              <p className="mt-1 text-3xl font-bold text-[var(--hw-text)]">
                {data?.homes.length || 0}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg)]">
              <p className="text-sm text-[var(--hw-text-secondary)]">Total Orders</p>
              <p className="mt-1 text-3xl font-bold text-[var(--hw-text)]">
                {data?.orders.length || 0}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Recent orders */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--hw-text)]">Recent Orders</h2>
            <Link href="/orders" className="text-sm font-medium text-primary hover:text-primary-dark">
              View all
            </Link>
          </div>

          {loading ? (
            <div className="mt-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border border-[var(--hw-border)] bg-white p-4 dark:bg-[var(--hw-bg)]">
                  <div className="h-4 w-32 rounded bg-[var(--hw-bg-tertiary)]" />
                  <div className="mt-2 h-3 w-20 rounded bg-[var(--hw-bg-tertiary)]" />
                </div>
              ))}
            </div>
          ) : !data?.orders.length ? (
            <div className="mt-4 rounded-xl border border-dashed border-[var(--hw-border)] bg-white p-8 text-center dark:bg-[var(--hw-bg)]">
              <svg className="mx-auto h-10 w-10 text-[var(--hw-text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
              <p className="mt-3 text-sm text-[var(--hw-text-secondary)]">No orders yet</p>
              <Link
                href="/browse"
                className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Browse services
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {data.orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="block rounded-xl border border-[var(--hw-border)] bg-white p-4 transition-all hover:shadow-sm dark:bg-[var(--hw-bg)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--hw-text)]">
                      {order.order_number}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
                      {formatStatus(order.status)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-[var(--hw-text-secondary)]">
                      {formatDate(order.created_at)}
                    </span>
                    <span className="text-sm font-medium text-[var(--hw-text)]">
                      {formatCents(order.total_cents)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Homes */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--hw-text)]">My Homes</h2>
            <Link href="/homes" className="text-sm font-medium text-primary hover:text-primary-dark">
              View all
            </Link>
          </div>

          {loading ? (
            <div className="mt-4 space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border border-[var(--hw-border)] bg-white p-4 dark:bg-[var(--hw-bg)]">
                  <div className="h-4 w-40 rounded bg-[var(--hw-bg-tertiary)]" />
                  <div className="mt-2 h-3 w-32 rounded bg-[var(--hw-bg-tertiary)]" />
                </div>
              ))}
            </div>
          ) : !data?.homes.length ? (
            <div className="mt-4 rounded-xl border border-dashed border-[var(--hw-border)] bg-white p-8 text-center dark:bg-[var(--hw-bg)]">
              <svg className="mx-auto h-10 w-10 text-[var(--hw-text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
              <p className="mt-3 text-sm text-[var(--hw-text-secondary)]">No homes added yet</p>
              <p className="mt-1 text-xs text-[var(--hw-text-tertiary)]">
                Add a home to get personalized service recommendations.
              </p>
              <Link
                href="/homes/new"
                className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Add your home
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {data.homes.map((home) => (
                <Link
                  key={home.id}
                  href={`/homes/${home.id}`}
                  className="block rounded-xl border border-[var(--hw-border)] bg-white p-4 transition-all hover:shadow-sm dark:bg-[var(--hw-bg)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--hw-text)]">
                        {home.nickname || home.address_line1}
                      </h3>
                      <p className="text-xs text-[var(--hw-text-secondary)]">
                        {home.address_line1}, {home.city}, {home.state} {home.zip_code}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
              <Link
                href="/homes/new"
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--hw-border)] p-3 text-sm font-medium text-[var(--hw-text-secondary)] transition-colors hover:border-primary hover:text-primary"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add another home
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Recommended services CTA */}
      <div className="mt-8 rounded-xl bg-gradient-to-r from-primary to-primary-dark p-6 text-white">
        <h2 className="text-lg font-bold">Discover Services for Your Home</h2>
        <p className="mt-1 text-sm text-blue-100">
          Browse our catalog of 100+ standardized services and find trusted pros in your area.
        </p>
        <Link
          href="/browse"
          className="mt-4 inline-block rounded-lg bg-white px-5 py-2 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-blue-50"
        >
          Browse services
        </Link>
      </div>
    </div>
  );
}
