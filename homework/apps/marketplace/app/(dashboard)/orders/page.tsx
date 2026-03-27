'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface OrderItem {
  id: string;
  status: string;
  price_snapshot: number;
  service: { id: string; name: string; slug: string; image_url: string | null };
  contractor: { id: string; business_name: string; logo_url: string | null };
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  platform_fee: number;
  tax: number;
  total: number;
  scheduled_date: string | null;
  created_at: string;
  home: {
    id: string;
    address_line_1: string;
    city: string;
    state: string;
    zip_code: string;
  };
  items: OrderItem[];
}

interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-700',
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

function OrderRowSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--hw-border)] bg-white p-4 dark:bg-[var(--hw-bg)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[var(--hw-bg-tertiary)]" />
          <div>
            <div className="h-4 w-28 rounded bg-[var(--hw-bg-tertiary)]" />
            <div className="mt-1.5 h-3 w-40 rounded bg-[var(--hw-bg-tertiary)]" />
          </div>
        </div>
        <div className="text-right">
          <div className="h-4 w-16 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="mt-1.5 h-5 w-20 rounded-full bg-[var(--hw-bg-tertiary)]" />
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('per_page', '10');
      if (statusFilter) {
        params.set('status', statusFilter);
      }

      const res = await fetch(`/api/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setPagination(data.pagination || null);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }

  const statusOptions = [
    { value: '', label: 'All Orders' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--hw-text)]">Orders</h1>
          <p className="mt-1 text-sm text-[var(--hw-text-secondary)]">
            Track and manage your service orders.
          </p>
        </div>
        <Link
          href="/browse"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          New Order
        </Link>
      </div>

      {/* Filters */}
      <div className="mt-6">
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-primary text-white'
                  : 'bg-[var(--hw-bg-tertiary)] text-[var(--hw-text-secondary)] hover:bg-[var(--hw-border)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders list */}
      <div className="mt-6 space-y-3">
        {loading ? (
          <>
            <OrderRowSkeleton />
            <OrderRowSkeleton />
            <OrderRowSkeleton />
            <OrderRowSkeleton />
          </>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--hw-border)] bg-white p-12 text-center dark:bg-[var(--hw-bg)]">
            <svg
              className="mx-auto h-12 w-12 text-[var(--hw-text-tertiary)]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
              />
            </svg>
            <h2 className="mt-4 text-lg font-semibold text-[var(--hw-text)]">
              {statusFilter ? 'No orders match this filter' : 'No orders yet'}
            </h2>
            <p className="mt-2 text-sm text-[var(--hw-text-secondary)]">
              {statusFilter
                ? 'Try a different filter or browse services to place a new order.'
                : 'Browse our catalog and book your first home service.'}
            </p>
            {!statusFilter && (
              <Link
                href="/browse"
                className="mt-5 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Browse Services
              </Link>
            )}
          </div>
        ) : (
          orders.map((order) => (
            <button
              key={order.id}
              onClick={() => router.push(`/orders/${order.id}`)}
              className="block w-full rounded-xl border border-[var(--hw-border)] bg-white p-4 text-left transition-all hover:shadow-sm dark:bg-[var(--hw-bg)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--hw-text)]">
                        {order.order_number}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
                        {formatStatus(order.status)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[var(--hw-text-secondary)]">
                      {order.items?.length || 0} {(order.items?.length || 0) === 1 ? 'service' : 'services'}
                      {order.items?.[0]?.service?.name && ` - ${order.items[0].service.name}`}
                      {(order.items?.length || 0) > 1 && ` +${(order.items?.length || 0) - 1} more`}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold text-[var(--hw-text)]">
                    {formatCents(order.total)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--hw-text-tertiary)]">
                    {formatDate(order.created_at)}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-[var(--hw-text-secondary)]">
            Showing {(pagination.page - 1) * pagination.per_page + 1}-
            {Math.min(pagination.page * pagination.per_page, pagination.total)} of{' '}
            {pagination.total} orders
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-[var(--hw-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--hw-text-secondary)] transition-colors hover:bg-[var(--hw-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[var(--hw-bg)]"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
              disabled={page >= pagination.total_pages}
              className="rounded-lg border border-[var(--hw-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--hw-text-secondary)] transition-colors hover:bg-[var(--hw-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[var(--hw-bg)]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
