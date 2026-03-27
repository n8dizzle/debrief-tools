'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface OrderItem {
  id: string;
  status: string;
  price_snapshot: number;
  contractor_payout: number;
  platform_fee: number;
  service: {
    id: string;
    name: string;
    slug: string;
    short_description: string;
    image_url: string | null;
    category: { id: string; name: string; slug: string };
  };
  contractor: {
    id: string;
    business_name: string;
    logo_url: string | null;
    rating_overall: number | null;
    review_count: number;
  };
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
  updated_at: string;
  home: {
    id: string;
    address_line_1: string;
    address_line_2: string | null;
    city: string;
    state: string;
    zip_code: string;
  };
  items: OrderItem[];
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

const STATUS_STEPS = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

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

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  }).format(new Date(dateStr));
}

function getStepIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : -1;
}

function OrderDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="animate-pulse">
        <div className="h-4 w-20 rounded bg-[var(--hw-bg-tertiary)]" />
        <div className="mt-4 h-7 w-48 rounded bg-[var(--hw-bg-tertiary)]" />
        <div className="mt-2 h-4 w-32 rounded bg-[var(--hw-bg-tertiary)]" />

        {/* Progress bar skeleton */}
        <div className="mt-8 rounded-xl border border-[var(--hw-border)] bg-white p-6 dark:bg-[var(--hw-bg)]">
          <div className="h-5 w-32 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="mt-4 flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-2 flex-1 rounded-full bg-[var(--hw-bg-tertiary)]" />
            ))}
          </div>
          <div className="mt-2 flex justify-between">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-3 w-14 rounded bg-[var(--hw-bg-tertiary)]" />
            ))}
          </div>
        </div>

        {/* Items skeleton */}
        <div className="mt-6 rounded-xl border border-[var(--hw-border)] bg-white p-6 dark:bg-[var(--hw-bg)]">
          <div className="h-5 w-24 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="mt-4 space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="h-14 w-14 rounded-lg bg-[var(--hw-bg-tertiary)]" />
                <div className="flex-1">
                  <div className="h-4 w-40 rounded bg-[var(--hw-bg-tertiary)]" />
                  <div className="mt-2 h-3 w-28 rounded bg-[var(--hw-bg-tertiary)]" />
                </div>
                <div className="h-4 w-16 rounded bg-[var(--hw-bg-tertiary)]" />
              </div>
            ))}
          </div>
        </div>

        {/* Payment skeleton */}
        <div className="mt-6 rounded-xl border border-[var(--hw-border)] bg-white p-6 dark:bg-[var(--hw-bg)]">
          <div className="h-5 w-36 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="mt-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-20 rounded bg-[var(--hw-bg-tertiary)]" />
                <div className="h-3 w-14 rounded bg-[var(--hw-bg-tertiary)]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (res.ok) {
          const data = await res.json();
          setOrder(data.order);
        } else if (res.status === 404) {
          setError('Order not found');
        } else {
          setError('Failed to load order');
        }
      } catch (err) {
        console.error('Failed to fetch order:', err);
        setError('Failed to load order');
      } finally {
        setLoading(false);
      }
    }
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  if (loading) {
    return <OrderDetailSkeleton />;
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-5xl">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Orders
        </Link>
        <div className="mt-8 rounded-xl border border-dashed border-[var(--hw-border)] bg-white p-12 text-center dark:bg-[var(--hw-bg)]">
          <svg className="mx-auto h-12 w-12 text-[var(--hw-text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h2 className="mt-4 text-lg font-semibold text-[var(--hw-text)]">{error || 'Order not found'}</h2>
          <p className="mt-2 text-sm text-[var(--hw-text-secondary)]">
            The order you are looking for does not exist or you do not have access to it.
          </p>
        </div>
      </div>
    );
  }

  const currentStepIndex = getStepIndex(order.status);
  const isCancelled = order.status === 'cancelled';
  const isRefunded = order.status === 'refunded';
  const isCompleted = order.status === 'completed';

  return (
    <div className="mx-auto max-w-5xl">
      {/* Back link */}
      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Orders
      </Link>

      {/* Order header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--hw-text)]">{order.order_number}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
              {formatStatus(order.status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--hw-text-secondary)]">
            Placed {formatDateTime(order.created_at)}
          </p>
        </div>
        {isCompleted && (
          <Link
            href={`/orders/${orderId}/review`}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Leave a Review
          </Link>
        )}
      </div>

      {/* Status progress tracker */}
      {!isCancelled && !isRefunded && (
        <div className="mt-6 rounded-xl border border-[var(--hw-border)] bg-white p-6 dark:bg-[var(--hw-bg)]">
          <h2 className="text-sm font-semibold text-[var(--hw-text)]">Order Progress</h2>
          <div className="mt-4">
            {/* Progress bar */}
            <div className="flex gap-1.5">
              {STATUS_STEPS.map((step, idx) => {
                const isReached = currentStepIndex >= idx;
                return (
                  <div
                    key={step.key}
                    className={`h-2 flex-1 rounded-full transition-colors ${
                      isReached ? 'bg-primary' : 'bg-[var(--hw-bg-tertiary)]'
                    }`}
                  />
                );
              })}
            </div>
            {/* Step labels */}
            <div className="mt-2 flex justify-between">
              {STATUS_STEPS.map((step, idx) => {
                const isReached = currentStepIndex >= idx;
                const isCurrent = currentStepIndex === idx;
                return (
                  <span
                    key={step.key}
                    className={`text-xs ${
                      isCurrent
                        ? 'font-semibold text-primary'
                        : isReached
                        ? 'font-medium text-[var(--hw-text)]'
                        : 'text-[var(--hw-text-tertiary)]'
                    }`}
                  >
                    {step.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Cancelled/Refunded banner */}
      {(isCancelled || isRefunded) && (
        <div className={`mt-6 rounded-xl border p-4 ${
          isCancelled
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-orange-200 bg-orange-50 text-orange-700'
        }`}>
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-sm font-medium">
              {isCancelled ? 'This order has been cancelled.' : 'This order has been refunded.'}
            </span>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Line items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-[var(--hw-border)] bg-white p-6 dark:bg-[var(--hw-bg)]">
            <h2 className="text-sm font-semibold text-[var(--hw-text)]">
              Services ({order.items.length})
            </h2>
            <div className="mt-4 divide-y divide-[var(--hw-border)]">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  {/* Service image or placeholder */}
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {item.service.image_url ? (
                      <img
                        src={item.service.image_url}
                        alt={item.service.name}
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                    ) : (
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11.42 15.17l-5.384 3.169 1.028-5.998L2.1 7.59l6.019-.874L11.42 1.5l3.3 5.216 6.019.874-4.964 4.751 1.028 5.998z"
                        />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--hw-text)]">{item.service.name}</h3>
                    <p className="mt-0.5 text-xs text-[var(--hw-text-secondary)]">
                      by {item.contractor.business_name}
                    </p>
                    {item.service.short_description && (
                      <p className="mt-1 text-xs text-[var(--hw-text-tertiary)]">
                        {item.service.short_description}
                      </p>
                    )}
                    {item.contractor.rating_overall && (
                      <div className="mt-1.5 flex items-center gap-1 text-xs text-[var(--hw-text-secondary)]">
                        <svg className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {item.contractor.rating_overall.toFixed(1)} ({item.contractor.review_count} reviews)
                      </div>
                    )}
                    <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-700'}`}>
                      {formatStatus(item.status)}
                    </span>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-semibold text-[var(--hw-text)]">
                      {formatCents(item.price_snapshot)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Service address */}
          <div className="rounded-xl border border-[var(--hw-border)] bg-white p-6 dark:bg-[var(--hw-bg)]">
            <h2 className="text-sm font-semibold text-[var(--hw-text)]">Service Address</h2>
            <div className="mt-3 flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-[var(--hw-text)]">{order.home.address_line_1}</p>
                {order.home.address_line_2 && (
                  <p className="text-sm text-[var(--hw-text)]">{order.home.address_line_2}</p>
                )}
                <p className="text-sm text-[var(--hw-text-secondary)]">
                  {order.home.city}, {order.home.state} {order.home.zip_code}
                </p>
              </div>
            </div>
            {order.scheduled_date && (
              <div className="mt-4 flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--hw-text-secondary)]">Scheduled Date</p>
                  <p className="text-sm text-[var(--hw-text)]">{formatDate(order.scheduled_date)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment summary sidebar */}
        <div>
          <div className="sticky top-24 rounded-xl border border-[var(--hw-border)] bg-white p-6 dark:bg-[var(--hw-bg)]">
            <h2 className="text-sm font-semibold text-[var(--hw-text)]">Payment Summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between text-[var(--hw-text-secondary)]">
                <span>Subtotal</span>
                <span>{formatCents(order.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-[var(--hw-text-secondary)]">
                <span>Platform fee</span>
                <span>{formatCents(order.platform_fee)}</span>
              </div>
              {order.tax > 0 && (
                <div className="flex items-center justify-between text-[var(--hw-text-secondary)]">
                  <span>Tax</span>
                  <span>{formatCents(order.tax)}</span>
                </div>
              )}
              <div className="border-t border-[var(--hw-border)] pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--hw-text)]">Total</span>
                  <span className="text-lg font-bold text-[var(--hw-text)]">
                    {formatCents(order.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Order info */}
            <div className="mt-6 space-y-2 border-t border-[var(--hw-border)] pt-4 text-xs text-[var(--hw-text-secondary)]">
              <div className="flex justify-between">
                <span>Order placed</span>
                <span>{formatDate(order.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>Last updated</span>
                <span>{formatDate(order.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
