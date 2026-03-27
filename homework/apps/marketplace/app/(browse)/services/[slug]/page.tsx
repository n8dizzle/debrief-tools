'use client';

import Link from 'next/link';
import { useEffect, useState, use, useCallback } from 'react';

interface ServiceVariable {
  id: string;
  name: string;
  label: string;
  description: string | null;
  variable_type: 'select' | 'number' | 'boolean';
  options: { value: string; label: string; price_adjustment_cents: number }[] | null;
  is_required: boolean;
  affects_pricing: boolean;
  display_order: number;
}

interface ServiceAddon {
  id: string;
  name: string;
  description: string | null;
  suggested_price: number;
  display_order: number;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  department?: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
  };
}

interface ServiceDetail {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  long_description: string | null;
  pricing_type?: string;
  productizability?: string;
  base_price_cents: number | null;
  estimated_duration_minutes: number | null;
  is_featured: boolean;
  image_url: string | null;
  scope_includes: string[] | null;
  scope_excludes: string[] | null;
  meta: Record<string, unknown> | null;
  category?: Category;
  variables?: ServiceVariable[];
  addons?: ServiceAddon[];
}

interface Contractor {
  id: string;
  company_name: string;
  logo_url: string | null;
  avg_rating: number | null;
  total_reviews: number;
  total_jobs_completed: number;
  tier: string;
  base_price_cents: number;
  years_in_business: number | null;
}

interface Review {
  id: string;
  rating_overall: number;
  title: string | null;
  body: string | null;
  created_at: string;
  reviewer: {
    raw_user_meta_data?: { full_name?: string };
  };
  service: {
    name: string;
  } | null;
  contractor_response: string | null;
}

interface ReviewStats {
  average_rating: number;
  total_reviews: number;
  rating_distribution: Record<number, number>;
}

const PRICING_TYPE_LABELS: Record<string, string> = {
  instant_price: 'Instant Price',
  configurator: 'Configure & Price',
  photo_estimate: 'Photo Estimate',
  onsite_estimate: 'Onsite Estimate',
  custom: 'Custom Quote',
};

const PRICING_TYPE_COLORS: Record<string, string> = {
  instant_price: 'bg-green-100 text-green-700',
  configurator: 'bg-blue-100 text-blue-700',
  photo_estimate: 'bg-purple-100 text-purple-700',
  onsite_estimate: 'bg-orange-100 text-orange-700',
  custom: 'bg-gray-100 text-gray-700',
};

function getPricingType(service: ServiceDetail): string {
  return service.pricing_type || service.productizability || 'instant_price';
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours} hr`;
  return `${hours} hr ${remaining} min`;
}

function formatCents(cents: number): string {
  const dollars = cents / 100;
  if (Number.isInteger(dollars)) return `$${dollars}`;
  return `$${dollars.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Chicago',
  }).format(new Date(dateStr));
}

function StarRating({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-xs text-[var(--hw-text-tertiary)]">No ratings</span>;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-4 w-4 ${star <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-sm font-medium text-[var(--hw-text)]">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Variable configurator state
  const [selectedVariables, setSelectedVariables] = useState<Record<string, string | number | boolean>>({});
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  // Contractor comparison
  const [zipCode, setZipCode] = useState('');
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [contractorsLoading, setContractorsLoading] = useState(false);
  const [contractorsError, setContractorsError] = useState<string | null>(null);
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsHasMore, setReviewsHasMore] = useState(false);

  // Fetch service
  useEffect(() => {
    async function fetchService() {
      try {
        const res = await fetch(`/api/services/${slug}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Service not found');
          } else {
            setError('Failed to load service');
          }
          return;
        }
        const data = await res.json();
        setService(data.service || data);
      } catch (err) {
        console.error('Failed to fetch service:', err);
        setError('Failed to load service');
      } finally {
        setLoading(false);
      }
    }
    fetchService();
  }, [slug]);

  // Fetch reviews
  useEffect(() => {
    if (!service?.id) return;

    async function fetchReviews(page: number) {
      setReviewsLoading(true);
      try {
        const res = await fetch(`/api/reviews?service_id=${service!.id}&page=${page}&limit=10`);
        if (!res.ok) return;
        const data = await res.json();
        const newReviews: Review[] = data.reviews || [];
        setReviews((prev) => (page === 1 ? newReviews : [...prev, ...newReviews]));
        const pagination = data.pagination;
        setReviewsHasMore(pagination ? pagination.page < pagination.total_pages : false);
        if (data.stats) {
          setReviewStats(data.stats);
        }
      } catch (err) {
        console.error('Failed to fetch reviews:', err);
      } finally {
        setReviewsLoading(false);
      }
    }

    fetchReviews(reviewsPage);
  }, [service?.id, reviewsPage]);

  // Calculate price
  const calculateTotal = useCallback(() => {
    if (!service) return 0;
    let total = service.base_price_cents || 0;

    // Variable adjustments
    if (service.variables) {
      for (const variable of service.variables) {
        const val = selectedVariables[variable.name];
        if (val !== undefined && variable.options) {
          const option = variable.options.find((o) => o.value === String(val));
          if (option) {
            total += option.price_adjustment_cents;
          }
        }
      }
    }

    // Addon prices
    if (service.addons) {
      for (const addon of service.addons) {
        if (selectedAddonIds.includes(addon.id)) {
          total += addon.suggested_price;
        }
      }
    }

    return total;
  }, [service, selectedVariables, selectedAddonIds]);

  async function fetchContractors() {
    if (!zipCode || zipCode.length !== 5) return;
    setContractorsLoading(true);
    setContractorsError(null);
    try {
      const res = await fetch(`/api/services/${slug}/contractors?zip_code=${zipCode}`);
      if (!res.ok) {
        setContractorsError('Failed to load contractors');
        return;
      }
      const data = await res.json();
      setContractors(data.contractors || []);
      if ((data.contractors || []).length === 0) {
        setContractorsError('No contractors available in your area for this service.');
      }
    } catch (err) {
      console.error('Failed to fetch contractors:', err);
      setContractorsError('Failed to load contractors');
    } finally {
      setContractorsLoading(false);
    }
  }

  function handleVariableChange(name: string, value: string | number | boolean) {
    setSelectedVariables((prev) => ({ ...prev, [name]: value }));
  }

  function toggleAddon(addonId: string) {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <div className="h-4 w-48 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="mt-6 h-8 w-96 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="mt-4 h-4 w-full rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="mt-2 h-4 w-3/4 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="mt-8 h-48 w-full rounded-xl bg-[var(--hw-bg-tertiary)]" />
        </div>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6 lg:px-8">
        <svg className="mx-auto h-16 w-16 text-[var(--hw-text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <h2 className="mt-4 text-xl font-bold text-[var(--hw-text)]">{error || 'Service not found'}</h2>
        <p className="mt-2 text-sm text-[var(--hw-text-secondary)]">
          The service you are looking for may have been removed or is temporarily unavailable.
        </p>
        <Link href="/browse" className="mt-6 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
          Browse all services
        </Link>
      </div>
    );
  }

  const pricingType = getPricingType(service);
  const dept = service.category?.department;
  const totalCents = calculateTotal();
  const isBookable = pricingType === 'instant_price' || pricingType === 'configurator';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-[var(--hw-text-secondary)]">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span>/</span>
        <Link href="/browse" className="hover:text-primary">Browse</Link>
        {dept && (
          <>
            <span>/</span>
            <Link href={`/browse/${dept.slug}`} className="hover:text-primary">{dept.name}</Link>
          </>
        )}
        {service.category && (
          <>
            <span>/</span>
            <Link
              href={`/browse/${dept?.slug || ''}?category=${service.category.slug}`}
              className="hover:text-primary"
            >
              {service.category.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-[var(--hw-text)]">{service.name}</span>
      </nav>

      {/* Service header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${PRICING_TYPE_COLORS[pricingType] || 'bg-gray-100 text-gray-700'}`}>
              {PRICING_TYPE_LABELS[pricingType] || pricingType}
            </span>
            {service.is_featured && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                Featured
              </span>
            )}
          </div>
          <h1 className="mt-3 text-2xl font-bold text-[var(--hw-text)] sm:text-3xl">
            {service.name}
          </h1>
          <p className="mt-3 text-[var(--hw-text-secondary)]">
            {service.short_description}
          </p>
          {service.estimated_duration_minutes && (
            <div className="mt-3 flex items-center gap-1.5 text-sm text-[var(--hw-text-secondary)]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Estimated duration: {formatDuration(service.estimated_duration_minutes)}
            </div>
          )}
        </div>

        {/* Price card */}
        {isBookable && service.base_price_cents != null && (
          <div className="w-full rounded-xl border border-[var(--hw-border)] bg-white p-6 shadow-sm dark:bg-[var(--hw-bg-secondary)] lg:w-72">
            <div className="text-center">
              <p className="text-sm text-[var(--hw-text-secondary)]">
                {pricingType === 'configurator' ? 'Starting at' : 'Price'}
              </p>
              <p className="mt-1 text-3xl font-bold text-[var(--hw-text)]">
                {formatCents(totalCents)}
              </p>
            </div>
            <button
              disabled={!selectedContractorId && contractors.length > 0}
              className="mt-4 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add to Cart
            </button>
            <p className="mt-2 text-center text-xs text-[var(--hw-text-tertiary)]">
              Select a contractor below to add to cart
            </p>
          </div>
        )}

        {!isBookable && (
          <div className="w-full rounded-xl border border-[var(--hw-border)] bg-white p-6 shadow-sm dark:bg-[var(--hw-bg-secondary)] lg:w-72">
            <div className="text-center">
              <p className="text-lg font-bold text-[var(--hw-text)]">
                {pricingType === 'photo_estimate' ? 'Free Photo Estimate' : pricingType === 'onsite_estimate' ? 'Free Onsite Estimate' : 'Get a Quote'}
              </p>
              <p className="mt-1 text-sm text-[var(--hw-text-secondary)]">
                Enter your zip code to find pros in your area
              </p>
            </div>
            <button className="mt-4 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark">
              Get Quotes
            </button>
          </div>
        )}
      </div>

      {/* Long description */}
      {service.long_description && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-[var(--hw-text)]">About This Service</h2>
          <div className="mt-3 text-sm leading-relaxed text-[var(--hw-text-secondary)]">
            {service.long_description.split('\n').map((paragraph, i) => (
              <p key={i} className={i > 0 ? 'mt-3' : ''}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Scope includes/excludes */}
      {(service.scope_includes?.length || service.scope_excludes?.length) && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {service.scope_includes && service.scope_includes.length > 0 && (
            <div className="rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg-secondary)]">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--hw-text)]">
                <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                What&apos;s Included
              </h3>
              <ul className="mt-3 space-y-2">
                {service.scope_includes.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--hw-text-secondary)]">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {service.scope_excludes && service.scope_excludes.length > 0 && (
            <div className="rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg-secondary)]">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--hw-text)]">
                <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Not Included
              </h3>
              <ul className="mt-3 space-y-2">
                {service.scope_excludes.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--hw-text-secondary)]">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Variables configurator */}
      {service.variables && service.variables.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-[var(--hw-text)]">Configure Your Service</h2>
          <p className="mt-1 text-sm text-[var(--hw-text-secondary)]">
            Customize the details to get an accurate price.
          </p>
          <div className="mt-4 space-y-4">
            {service.variables.map((variable) => (
              <div key={variable.id} className="rounded-xl border border-[var(--hw-border)] bg-white p-4 dark:bg-[var(--hw-bg-secondary)]">
                <label className="flex items-center gap-1 text-sm font-medium text-[var(--hw-text)]">
                  {variable.label || variable.name}
                  {variable.is_required && <span className="text-red-500">*</span>}
                </label>
                {variable.description && (
                  <p className="mt-0.5 text-xs text-[var(--hw-text-tertiary)]">{variable.description}</p>
                )}

                {variable.variable_type === 'select' && variable.options && (
                  <select
                    value={String(selectedVariables[variable.name] ?? '')}
                    onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                    className="mt-2 w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2 text-sm text-[var(--hw-text)]"
                  >
                    <option value="">Select...</option>
                    {variable.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                        {opt.price_adjustment_cents !== 0 && variable.affects_pricing
                          ? ` (${opt.price_adjustment_cents > 0 ? '+' : ''}${formatCents(opt.price_adjustment_cents)})`
                          : ''}
                      </option>
                    ))}
                  </select>
                )}

                {variable.variable_type === 'number' && (
                  <input
                    type="number"
                    value={selectedVariables[variable.name] !== undefined ? String(selectedVariables[variable.name]) : ''}
                    onChange={(e) => handleVariableChange(variable.name, parseInt(e.target.value, 10) || 0)}
                    className="mt-2 w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2 text-sm text-[var(--hw-text)]"
                    placeholder="Enter a value..."
                  />
                )}

                {variable.variable_type === 'boolean' && (
                  <div className="mt-2">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedVariables[variable.name] === true}
                        onChange={(e) => handleVariableChange(variable.name, e.target.checked)}
                        className="h-4 w-4 rounded border-[var(--hw-border)] text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-[var(--hw-text-secondary)]">Yes</span>
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Addons */}
      {service.addons && service.addons.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-[var(--hw-text)]">Add-ons</h2>
          <p className="mt-1 text-sm text-[var(--hw-text-secondary)]">
            Enhance your service with these optional extras.
          </p>
          <div className="mt-4 space-y-3">
            {service.addons.map((addon) => (
              <label
                key={addon.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                  selectedAddonIds.includes(addon.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-[var(--hw-border)] bg-white hover:border-primary/30 dark:bg-[var(--hw-bg-secondary)]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedAddonIds.includes(addon.id)}
                  onChange={() => toggleAddon(addon.id)}
                  className="mt-0.5 h-4 w-4 rounded border-[var(--hw-border)] text-primary focus:ring-primary"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--hw-text)]">{addon.name}</span>
                    <span className="text-sm font-semibold text-[var(--hw-text)]">
                      +{formatCents(addon.suggested_price)}
                    </span>
                  </div>
                  {addon.description && (
                    <p className="mt-0.5 text-xs text-[var(--hw-text-secondary)]">{addon.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Contractor comparison */}
      <div className="mt-10 rounded-xl border border-[var(--hw-border)] bg-white p-6 dark:bg-[var(--hw-bg-secondary)]">
        <h2 className="text-lg font-semibold text-[var(--hw-text)]">
          {isBookable ? 'Compare Contractors' : 'Find Pros in Your Area'}
        </h2>
        <p className="mt-1 text-sm text-[var(--hw-text-secondary)]">
          Enter your zip code to see available contractors and their pricing.
        </p>

        <div className="mt-4 flex gap-3">
          <input
            type="text"
            maxLength={5}
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value.replace(/\D/g, ''))}
            placeholder="ZIP code"
            className="w-32 rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2 text-sm text-[var(--hw-text)] placeholder-[var(--hw-text-tertiary)]"
          />
          <button
            onClick={fetchContractors}
            disabled={zipCode.length !== 5 || contractorsLoading}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {contractorsLoading ? 'Searching...' : 'See Prices'}
          </button>
        </div>

        {/* Loading */}
        {contractorsLoading && (
          <div className="mt-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-[var(--hw-border)] p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[var(--hw-bg-tertiary)]" />
                  <div className="flex-1">
                    <div className="h-4 w-40 rounded bg-[var(--hw-bg-tertiary)]" />
                    <div className="mt-1 h-3 w-24 rounded bg-[var(--hw-bg-tertiary)]" />
                  </div>
                  <div className="h-6 w-16 rounded bg-[var(--hw-bg-tertiary)]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {contractorsError && !contractorsLoading && (
          <div className="mt-6 rounded-lg bg-[var(--hw-bg-tertiary)] p-4 text-center">
            <p className="text-sm text-[var(--hw-text-secondary)]">{contractorsError}</p>
          </div>
        )}

        {/* Contractor list */}
        {!contractorsLoading && contractors.length > 0 && (
          <div className="mt-6 space-y-3">
            {contractors.map((contractor) => (
              <div
                key={contractor.id}
                onClick={() => setSelectedContractorId(contractor.id)}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  selectedContractorId === contractor.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-[var(--hw-border)] hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Logo placeholder */}
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--hw-bg-tertiary)] text-sm font-bold text-[var(--hw-text-secondary)]">
                    {contractor.company_name.charAt(0)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[var(--hw-text)]">
                        {contractor.company_name}
                      </h3>
                      {contractor.tier === 'elite' && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          Elite
                        </span>
                      )}
                      {contractor.tier === 'preferred' && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                          Preferred
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-4">
                      <StarRating rating={contractor.avg_rating} />
                      <span className="text-xs text-[var(--hw-text-tertiary)]">
                        {contractor.total_reviews} review{contractor.total_reviews !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-[var(--hw-text-tertiary)]">
                        {contractor.total_jobs_completed} jobs
                      </span>
                      {contractor.years_in_business && (
                        <span className="text-xs text-[var(--hw-text-tertiary)]">
                          {contractor.years_in_business} yr{contractor.years_in_business !== 1 ? 's' : ''} in business
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-lg font-bold text-[var(--hw-text)]">
                      {formatCents(contractor.base_price_cents)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedContractorId(contractor.id);
                      }}
                      className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
                        selectedContractorId === contractor.id
                          ? 'bg-primary text-white'
                          : 'border border-primary text-primary hover:bg-primary/5'
                      }`}
                    >
                      {selectedContractorId === contractor.id ? 'Selected' : 'Select'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Customer Reviews */}
      <div className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-[var(--hw-text)]">
            Customer Reviews
            {reviewStats && (
              <span className="ml-2 text-sm font-normal text-[var(--hw-text-secondary)]">
                ({reviewStats.total_reviews} review{reviewStats.total_reviews !== 1 ? 's' : ''})
              </span>
            )}
          </h2>
          {reviewStats && reviewStats.total_reviews > 0 && (
            <div className="flex items-center gap-2">
              <StarRating rating={reviewStats.average_rating} />
            </div>
          )}
        </div>

        {/* Rating distribution */}
        {reviewStats && reviewStats.total_reviews > 0 && (
          <div className="mt-4 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviewStats.rating_distribution[star] || 0;
              const pct = reviewStats.total_reviews > 0 ? (count / reviewStats.total_reviews) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-8 text-right text-[var(--hw-text-secondary)]">{star} star</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--hw-bg-tertiary)]">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-xs text-[var(--hw-text-tertiary)]">{count}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Reviews list */}
        {reviews.length > 0 && (
          <div className="mt-6 space-y-5">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg-secondary)]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <StarRating rating={review.rating_overall} />
                    {review.title && (
                      <h3 className="mt-2 text-sm font-bold text-[var(--hw-text)]">{review.title}</h3>
                    )}
                  </div>
                  <span className="text-xs text-[var(--hw-text-tertiary)]">
                    {formatDate(review.created_at)}
                  </span>
                </div>

                {review.body && (
                  <p className="mt-2 text-sm leading-relaxed text-[var(--hw-text-secondary)]">
                    {review.body}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-3 text-xs text-[var(--hw-text-tertiary)]">
                  <span>{review.reviewer?.raw_user_meta_data?.full_name || 'Homeowner'}</span>
                  {review.service && (
                    <>
                      <span className="text-[var(--hw-border)]">|</span>
                      <span>{review.service.name}</span>
                    </>
                  )}
                </div>

                {review.contractor_response && (
                  <div className="mt-3 rounded-lg bg-[var(--hw-bg-tertiary)] p-3">
                    <p className="text-xs font-semibold text-[var(--hw-text)]">Contractor Response</p>
                    <p className="mt-1 text-sm text-[var(--hw-text-secondary)]">
                      {review.contractor_response}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Loading state */}
        {reviewsLoading && (
          <div className="mt-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-[var(--hw-border)] p-5">
                <div className="h-4 w-24 rounded bg-[var(--hw-bg-tertiary)]" />
                <div className="mt-3 h-3 w-full rounded bg-[var(--hw-bg-tertiary)]" />
                <div className="mt-2 h-3 w-3/4 rounded bg-[var(--hw-bg-tertiary)]" />
              </div>
            ))}
          </div>
        )}

        {/* Show more button */}
        {reviewsHasMore && !reviewsLoading && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setReviewsPage((prev) => prev + 1)}
              className="rounded-lg border border-[var(--hw-border)] px-6 py-2.5 text-sm font-semibold text-[var(--hw-text)] transition-colors hover:bg-[var(--hw-bg-tertiary)]"
            >
              Show More
            </button>
          </div>
        )}

        {/* Empty state */}
        {!reviewsLoading && reviews.length === 0 && (
          <div className="mt-6 rounded-xl border border-[var(--hw-border)] bg-white p-8 text-center dark:bg-[var(--hw-bg-secondary)]">
            <svg className="mx-auto h-12 w-12 text-[var(--hw-text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <p className="mt-3 text-sm font-medium text-[var(--hw-text)]">No reviews yet</p>
            <p className="mt-1 text-xs text-[var(--hw-text-secondary)]">
              Be the first to leave a review after booking this service.
            </p>
          </div>
        )}
      </div>

      {/* Sticky bottom bar for mobile */}
      {isBookable && service.base_price_cents != null && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-[var(--hw-border)] bg-white p-4 shadow-lg dark:bg-[var(--hw-bg)] lg:hidden">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <div>
              <p className="text-xs text-[var(--hw-text-secondary)]">Total</p>
              <p className="text-xl font-bold text-[var(--hw-text)]">{formatCents(totalCents)}</p>
            </div>
            <button
              disabled={!selectedContractorId && contractors.length > 0}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add to Cart
            </button>
          </div>
        </div>
      )}

      {/* Bottom spacer for mobile sticky bar */}
      {isBookable && <div className="h-20 lg:hidden" />}
    </div>
  );
}
