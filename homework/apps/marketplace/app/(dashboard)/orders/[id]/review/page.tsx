'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { use } from 'react';

interface OrderItem {
  id: string;
  status: string;
  service: { id: string; name: string; slug: string };
  contractor: { id: string; business_name: string; logo_url: string | null };
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  items: OrderItem[];
}

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Below Average',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--hw-text)]">{label}</label>
      <div className="mt-1 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(star)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <svg
              className={`h-7 w-7 ${
                star <= (hover || value) ? 'text-yellow-400' : 'text-gray-200'
              }`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
        <span className="ml-2 text-sm text-[var(--hw-text-secondary)]">
          {RATING_LABELS[hover || value] || 'Select rating'}
        </span>
      </div>
    </div>
  );
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Review form state - one review per order item
  const [selectedItemId, setSelectedItemId] = useState('');
  const [ratingOverall, setRatingOverall] = useState(0);
  const [ratingQuality, setRatingQuality] = useState(0);
  const [ratingPunctuality, setRatingPunctuality] = useState(0);
  const [ratingCommunication, setRatingCommunication] = useState(0);
  const [ratingValue, setRatingValue] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        // Auto-select first completed item
        const completedItems = (data.order.items || []).filter(
          (item: OrderItem) => item.status === 'completed'
        );
        if (completedItems.length > 0) {
          setSelectedItemId(completedItems[0].id);
        }
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (ratingOverall === 0) {
      setError('Overall rating is required');
      return;
    }
    if (!selectedItemId) {
      setError('Please select a service to review');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: selectedItemId,
          rating_overall: ratingOverall,
          rating_quality: ratingQuality || undefined,
          rating_punctuality: ratingPunctuality || undefined,
          rating_communication: ratingCommunication || undefined,
          rating_value: ratingValue || undefined,
          title: title || undefined,
          body: body || undefined,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push(`/orders/${orderId}`), 2000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to submit review');
      }
    } catch {
      setError('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl animate-pulse">
        <div className="h-8 w-48 rounded bg-[var(--hw-bg-tertiary)]" />
        <div className="mt-6 h-96 rounded-xl bg-[var(--hw-bg-tertiary)]" />
      </div>
    );
  }

  if (!order || order.status !== 'completed') {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <div className="rounded-xl border border-[var(--hw-border)] bg-white p-8 dark:bg-[var(--hw-bg)]">
          <p className="text-[var(--hw-text-secondary)]">
            Reviews can only be left for completed orders.
          </p>
          <Link href={`/orders/${orderId}`} className="mt-4 inline-block text-sm font-medium text-primary">
            Back to Order
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <div className="rounded-xl border border-green-200 bg-green-50 p-8">
          <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-green-800">Thank you for your review!</h2>
          <p className="mt-2 text-sm text-green-600">Your feedback helps other homeowners and contractors.</p>
        </div>
      </div>
    );
  }

  const completedItems = order.items.filter((item) => item.status === 'completed');
  const selectedItem = completedItems.find((item) => item.id === selectedItemId);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/orders/${orderId}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Order
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-[var(--hw-text)]">Leave a Review</h1>
      <p className="mt-1 text-sm text-[var(--hw-text-secondary)]">Order #{order.order_number}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Service selection (if multiple items) */}
        {completedItems.length > 1 && (
          <div className="rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg)]">
            <h2 className="text-sm font-semibold text-[var(--hw-text)]">Select Service to Review</h2>
            <div className="mt-3 space-y-2">
              {completedItems.map((item) => (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    selectedItemId === item.id
                      ? 'border-primary bg-primary/5'
                      : 'border-[var(--hw-border)] hover:border-primary/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="item"
                    value={item.id}
                    checked={selectedItemId === item.id}
                    onChange={() => setSelectedItemId(item.id)}
                    className="sr-only"
                  />
                  <div>
                    <p className="text-sm font-medium text-[var(--hw-text)]">{item.service.name}</p>
                    <p className="text-xs text-[var(--hw-text-secondary)]">by {item.contractor.business_name}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Selected service info (single item) */}
        {completedItems.length === 1 && selectedItem && (
          <div className="rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg)]">
            <p className="text-sm font-semibold text-[var(--hw-text)]">{selectedItem.service.name}</p>
            <p className="text-xs text-[var(--hw-text-secondary)]">by {selectedItem.contractor.business_name}</p>
          </div>
        )}

        {/* Ratings */}
        <div className="rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg)]">
          <h2 className="text-sm font-semibold text-[var(--hw-text)]">Ratings</h2>
          <div className="mt-4 space-y-5">
            <StarRating value={ratingOverall} onChange={setRatingOverall} label="Overall *" />
            <StarRating value={ratingQuality} onChange={setRatingQuality} label="Quality of Work" />
            <StarRating value={ratingPunctuality} onChange={setRatingPunctuality} label="Punctuality" />
            <StarRating value={ratingCommunication} onChange={setRatingCommunication} label="Communication" />
            <StarRating value={ratingValue} onChange={setRatingValue} label="Value for Money" />
          </div>
        </div>

        {/* Written review */}
        <div className="rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg)]">
          <h2 className="text-sm font-semibold text-[var(--hw-text)]">Your Review</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--hw-text)]">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sum up your experience in a few words"
                maxLength={100}
                className="mt-1 w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2 text-sm text-[var(--hw-text)] placeholder-[var(--hw-text-tertiary)] outline-none focus:border-primary dark:bg-[var(--hw-bg)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--hw-text)]">Details</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Tell others about your experience..."
                rows={4}
                maxLength={2000}
                className="mt-1 w-full resize-none rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2 text-sm text-[var(--hw-text)] placeholder-[var(--hw-text-tertiary)] outline-none focus:border-primary dark:bg-[var(--hw-bg)]"
              />
              <p className="mt-1 text-right text-xs text-[var(--hw-text-tertiary)]">
                {body.length}/2000
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        <div className="flex items-center justify-between">
          <Link href={`/orders/${orderId}`} className="text-sm font-medium text-[var(--hw-text-secondary)] hover:text-[var(--hw-text)]">
            Skip for now
          </Link>
          <button
            type="submit"
            disabled={submitting || ratingOverall === 0}
            className="rounded-lg bg-primary px-8 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </form>
    </div>
  );
}
