'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface OrderItem {
  id: string;
  status: string;
  price_snapshot: number;
  contractor_payout: number;
  platform_fee: number;
  service: { id: string; name: string; slug: string; image_url: string | null };
  contractor: { id: string; business_name: string; logo_url: string | null };
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
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

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [cardElement, setCardElement] = useState<unknown>(null);
  const [stripeInstance, setStripeInstance] = useState<unknown>(null);
  const [clientSecret, setClientSecret] = useState('');

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
      } else {
        setError('Order not found');
      }
    } catch {
      setError('Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Initialize Stripe payment intent when order loads
  useEffect(() => {
    if (!order || order.payment_status !== 'pending') return;

    async function initPayment() {
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: order!.id }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to initialize payment');
          return;
        }

        const data = await res.json();
        setClientSecret(data.client_secret);

        // Mount Stripe Elements
        const stripe = await stripePromise;
        if (!stripe) {
          setError('Stripe not configured');
          return;
        }

        setStripeInstance(stripe);
        const elements = stripe.elements({ clientSecret: data.client_secret });
        const card = elements.create('payment');
        card.mount('#payment-element');
        setCardElement({ stripe, elements, card });
      } catch {
        setError('Failed to initialize payment');
      }
    }

    initPayment();
  }, [order]);

  async function handlePayment() {
    if (!cardElement || !clientSecret) return;

    setPaying(true);
    setError('');

    try {
      const { stripe, elements } = cardElement as { stripe: any; elements: any };
      const { error: paymentError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/orders/${orderId}?payment=success`,
        },
      });

      if (paymentError) {
        setError(paymentError.message || 'Payment failed');
        setPaying(false);
      }
      // If no error, Stripe redirects to return_url
    } catch {
      setError('Payment processing failed');
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="mt-6 h-64 rounded-xl bg-[var(--hw-bg-tertiary)]" />
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8">
          <h1 className="text-xl font-semibold text-red-800">Error</h1>
          <p className="mt-2 text-red-600">{error}</p>
          <button
            onClick={() => router.push('/orders')}
            className="mt-4 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white"
          >
            View Orders
          </button>
        </div>
      </div>
    );
  }

  if (!order) return null;

  // If already paid, redirect to order detail
  if (order.payment_status === 'captured') {
    router.push(`/orders/${orderId}`);
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-[var(--hw-text)]">Complete Payment</h1>
      <p className="mt-1 text-sm text-[var(--hw-text-secondary)]">
        Order #{order.order_number}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Payment form */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-[var(--hw-border)] bg-white p-6 dark:bg-[var(--hw-bg)]">
            <h2 className="text-lg font-semibold text-[var(--hw-text)]">Payment Method</h2>

            {/* Stripe Elements mount point */}
            <div id="payment-element" className="mt-4 min-h-[150px]" />

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              onClick={handlePayment}
              disabled={paying || !clientSecret}
              className="mt-5 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {paying ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                `Pay ${formatCents(order.total)}`
              )}
            </button>

            <p className="mt-3 text-center text-xs text-[var(--hw-text-tertiary)]">
              Your payment is secured by Stripe. You won&apos;t be charged until work is completed.
            </p>
          </div>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg)]">
            <h2 className="text-base font-semibold text-[var(--hw-text)]">Order Summary</h2>

            <div className="mt-4 space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {item.service.image_url ? (
                      <img
                        src={item.service.image_url}
                        alt={item.service.name}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384 3.169 1.028-5.998L2.1 7.59l6.019-.874L11.42 1.5l3.3 5.216 6.019.874-4.964 4.751 1.028 5.998z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--hw-text)] truncate">{item.service.name}</p>
                    <p className="text-xs text-[var(--hw-text-tertiary)]">{item.contractor.business_name}</p>
                  </div>
                  <span className="text-xs font-medium text-[var(--hw-text)]">
                    {formatCents(item.price_snapshot)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-[var(--hw-border)] pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-[var(--hw-text-secondary)]">
                <span>Subtotal</span>
                <span>{formatCents(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[var(--hw-text-secondary)]">
                <span>Service fee</span>
                <span>{formatCents(order.platform_fee)}</span>
              </div>
              {order.tax > 0 && (
                <div className="flex justify-between text-[var(--hw-text-secondary)]">
                  <span>Tax</span>
                  <span>{formatCents(order.tax)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[var(--hw-border)] pt-2">
                <span className="font-semibold text-[var(--hw-text)]">Total</span>
                <span className="font-semibold text-[var(--hw-text)]">{formatCents(order.total)}</span>
              </div>
            </div>

            {/* Service address */}
            {order.home && (
              <div className="mt-4 rounded-lg bg-[var(--hw-bg-tertiary)] p-3">
                <p className="text-xs font-medium text-[var(--hw-text-secondary)]">Service Address</p>
                <p className="mt-1 text-xs text-[var(--hw-text)]">
                  {order.home.address_line_1}, {order.home.city}, {order.home.state} {order.home.zip_code}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
