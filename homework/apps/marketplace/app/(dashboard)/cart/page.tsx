'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface CartItem {
  id: string;
  quantity: number;
  selected_variables: Record<string, string> | null;
  selected_addons: string[] | null;
  preferred_date: string | null;
  preferred_time_slot: string | null;
  notes: string | null;
  created_at: string;
  service: {
    id: string;
    name: string;
    slug: string;
    short_description: string;
    image_url: string | null;
    pricing_type: string;
    category: {
      id: string;
      name: string;
      slug: string;
      department: { id: string; name: string; slug: string };
    };
  };
  contractor: {
    id: string;
    business_name: string;
    logo_url: string | null;
    rating_overall: number | null;
    review_count: number;
  };
  home: {
    id: string;
    address_line_1: string;
    city: string;
    state: string;
    zip_code: string;
  };
}

const PLATFORM_FEE_RATE = 0.15;

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Chicago',
  }).format(new Date(dateStr));
}

function CartItemSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg)]">
      <div className="flex gap-4">
        <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-[var(--hw-bg-tertiary)]" />
        <div className="flex-1">
          <div className="h-4 w-48 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="mt-2 h-3 w-32 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="mt-2 h-3 w-24 rounded bg-[var(--hw-bg-tertiary)]" />
        </div>
        <div className="h-5 w-16 rounded bg-[var(--hw-bg-tertiary)]" />
      </div>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg)]">
      <div className="h-5 w-32 rounded bg-[var(--hw-bg-tertiary)]" />
      <div className="mt-4 space-y-3">
        <div className="flex justify-between">
          <div className="h-3 w-16 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="h-3 w-12 rounded bg-[var(--hw-bg-tertiary)]" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 w-24 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="h-3 w-12 rounded bg-[var(--hw-bg-tertiary)]" />
        </div>
        <div className="border-t border-[var(--hw-border)] pt-3">
          <div className="flex justify-between">
            <div className="h-4 w-12 rounded bg-[var(--hw-bg-tertiary)]" />
            <div className="h-4 w-16 rounded bg-[var(--hw-bg-tertiary)]" />
          </div>
        </div>
      </div>
      <div className="mt-5 h-10 w-full rounded-lg bg-[var(--hw-bg-tertiary)]" />
    </div>
  );
}

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    fetchCart();
  }, []);

  async function fetchCart() {
    try {
      const res = await fetch('/api/cart');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch cart:', err);
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(id: string) {
    setRemovingId(id);
    try {
      const res = await fetch(`/api/cart/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error('Failed to remove item:', err);
    } finally {
      setRemovingId(null);
    }
  }

  async function handleCheckout() {
    if (items.length === 0) return;
    setCheckingOut(true);
    try {
      // Group items by home - create one order per home
      const homeId = items[0].home.id;
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home_id: homeId }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/checkout/${data.order.id}`);
      } else {
        const err = await res.json();
        console.error('Checkout failed:', err.error);
      }
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setCheckingOut(false);
    }
  }

  // Note: actual pricing comes from contractor_prices at checkout time.
  // For display we show a placeholder; the API computes real totals on POST /api/orders.
  // Here we just show item count and a "pricing calculated at checkout" note.
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-[var(--hw-text)]">Your Cart</h1>
      <p className="mt-1 text-sm text-[var(--hw-text-secondary)]">
        {loading ? 'Loading...' : `${itemCount} ${itemCount === 1 ? 'item' : 'items'} in your cart`}
      </p>

      {loading ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <CartItemSkeleton />
            <CartItemSkeleton />
          </div>
          <SummarySkeleton />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-[var(--hw-border)] bg-white p-12 text-center dark:bg-[var(--hw-bg)]">
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
              d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121 0 2.09-.773 2.21-1.886L21 5.25H5.106m-2.72 0l.386 1.437m0 0a14.937 14.937 0 011.332 5.577l.174 1.242m0 0a14.939 14.939 0 01.544 3.994m-2.05-5.236h13.054"
            />
          </svg>
          <h2 className="mt-4 text-lg font-semibold text-[var(--hw-text)]">Your cart is empty</h2>
          <p className="mt-2 text-sm text-[var(--hw-text-secondary)]">
            Browse our catalog to find the perfect service for your home.
          </p>
          <Link
            href="/browse"
            className="mt-5 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Browse Services
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Cart items */}
          <div className="space-y-4 lg:col-span-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border border-[var(--hw-border)] bg-white p-5 transition-opacity dark:bg-[var(--hw-bg)] ${
                  removingId === item.id ? 'opacity-50' : ''
                }`}
              >
                <div className="flex gap-4">
                  {/* Service image or placeholder */}
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {item.service.image_url ? (
                      <img
                        src={item.service.image_url}
                        alt={item.service.name}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ) : (
                      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11.42 15.17l-5.384 3.169 1.028-5.998L2.1 7.59l6.019-.874L11.42 1.5l3.3 5.216 6.019.874-4.964 4.751 1.028 5.998z"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Service details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--hw-text)]">{item.service.name}</h3>
                    <p className="mt-0.5 text-xs text-[var(--hw-text-secondary)]">
                      by {item.contractor.business_name}
                    </p>

                    {/* Selected variables */}
                    {item.selected_variables && Object.keys(item.selected_variables).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(item.selected_variables).map(([key, value]) => (
                          <span
                            key={key}
                            className="rounded-full bg-[var(--hw-bg-tertiary)] px-2 py-0.5 text-xs text-[var(--hw-text-secondary)]"
                          >
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Selected addons */}
                    {item.selected_addons && item.selected_addons.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {item.selected_addons.map((addon) => (
                          <span
                            key={addon}
                            className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                          >
                            + {addon}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Preferred date */}
                    {item.preferred_date && (
                      <p className="mt-2 text-xs text-[var(--hw-text-secondary)]">
                        <svg className="mr-1 inline h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                        {formatDate(item.preferred_date)}
                        {item.preferred_time_slot && ` - ${item.preferred_time_slot}`}
                      </p>
                    )}

                    {/* Quantity */}
                    {item.quantity > 1 && (
                      <p className="mt-1 text-xs text-[var(--hw-text-secondary)]">
                        Qty: {item.quantity}
                      </p>
                    )}

                    {/* Home address */}
                    <p className="mt-2 text-xs text-[var(--hw-text-tertiary)]">
                      <svg className="mr-1 inline h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      {item.home.address_line_1}, {item.home.city}, {item.home.state} {item.home.zip_code}
                    </p>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={removingId === item.id}
                    className="flex-shrink-0 self-start rounded-lg p-2 text-[var(--hw-text-tertiary)] transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    aria-label="Remove item"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Order summary sidebar */}
          <div>
            <div className="sticky top-24 rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg)]">
              <h2 className="text-lg font-semibold text-[var(--hw-text)]">Order Summary</h2>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between text-[var(--hw-text-secondary)]">
                  <span>Items ({itemCount})</span>
                  <span>Calculated at checkout</span>
                </div>
                <div className="flex items-center justify-between text-[var(--hw-text-secondary)]">
                  <span>Platform fee (15%)</span>
                  <span>Included</span>
                </div>
                <div className="border-t border-[var(--hw-border)] pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--hw-text)]">Total</span>
                    <span className="text-sm text-[var(--hw-text-secondary)]">At checkout</span>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-[var(--hw-text-tertiary)]">
                Final pricing will be calculated based on your selected options and current contractor rates.
              </p>

              <button
                onClick={handleCheckout}
                disabled={items.length === 0 || checkingOut}
                className="mt-5 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checkingOut ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  'Proceed to Checkout'
                )}
              </button>

              <Link
                href="/browse"
                className="mt-3 block text-center text-sm font-medium text-primary hover:text-primary-dark"
              >
                Continue browsing
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
