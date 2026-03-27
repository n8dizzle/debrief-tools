'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Department {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  categories?: Category[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
}

interface Service {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  pricing_type?: string;
  productizability?: string;
  base_price_cents: number | null;
  estimated_duration_minutes: number | null;
  is_featured: boolean;
  image_url: string | null;
  category?: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    department?: {
      id: string;
      name: string;
      slug: string;
      icon: string | null;
    };
  };
}

interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

const DEPARTMENT_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  'the-lot': { bg: 'bg-emerald-50', text: 'text-emerald-700', accent: 'bg-emerald-600' },
  'the-exterior': { bg: 'bg-blue-50', text: 'text-blue-700', accent: 'bg-blue-600' },
  'the-interior': { bg: 'bg-amber-50', text: 'text-amber-700', accent: 'bg-amber-600' },
};

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

function getPricingType(service: Service): string {
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

function formatPrice(cents: number | null, pricingType: string): string {
  if (pricingType === 'instant_price' && cents != null) {
    return `$${(cents / 100).toFixed(0)}`;
  }
  if (pricingType === 'configurator' && cents != null) {
    return `From $${(cents / 100).toFixed(0)}`;
  }
  if (pricingType === 'photo_estimate') return 'Free Photo Estimate';
  if (pricingType === 'onsite_estimate') return 'Free Onsite Estimate';
  return 'Get Quote';
}

function ServiceCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg-secondary)]">
      <div className="h-4 w-3/4 rounded bg-[var(--hw-bg-tertiary)]" />
      <div className="mt-2 h-3 w-full rounded bg-[var(--hw-bg-tertiary)]" />
      <div className="mt-1 h-3 w-2/3 rounded bg-[var(--hw-bg-tertiary)]" />
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-20 rounded-full bg-[var(--hw-bg-tertiary)]" />
      </div>
      <div className="mt-3 h-4 w-24 rounded bg-[var(--hw-bg-tertiary)]" />
    </div>
  );
}

export default function DepartmentPage({
  params,
}: {
  params: Promise<{ departmentSlug: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 w-48 bg-slate-200 rounded mb-4" /><div className="grid grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-48 bg-slate-100 rounded-xl" />)}</div></div>}>
      <DepartmentContent params={params} />
    </Suspense>
  );
}

function DepartmentContent({
  params,
}: {
  params: Promise<{ departmentSlug: string }>;
}) {
  const { departmentSlug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [department, setDepartment] = useState<Department | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [deptLoading, setDeptLoading] = useState(true);

  const selectedCategory = searchParams.get('category') || '';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const colors = DEPARTMENT_COLORS[departmentSlug] || { bg: 'bg-gray-50', text: 'text-gray-700', accent: 'bg-gray-600' };

  // Fetch department details
  useEffect(() => {
    async function fetchDepartment() {
      try {
        const res = await fetch(`/api/departments/${departmentSlug}`);
        if (res.ok) {
          const data = await res.json();
          setDepartment(data.department || data);
        }
      } catch (err) {
        console.error('Failed to fetch department:', err);
      } finally {
        setDeptLoading(false);
      }
    }
    fetchDepartment();
  }, [departmentSlug]);

  // Fetch services
  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('department', departmentSlug);
      if (selectedCategory) params.set('category', selectedCategory);
      params.set('page', String(currentPage));
      params.set('per_page', '24');

      const res = await fetch(`/api/services?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setServices(data.services || []);
        setPagination(data.pagination || null);
      }
    } catch (err) {
      console.error('Failed to fetch services:', err);
    } finally {
      setLoading(false);
    }
  }, [departmentSlug, selectedCategory, currentPage]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  function setCategory(slug: string) {
    const params = new URLSearchParams();
    if (slug) params.set('category', slug);
    const qs = params.toString();
    router.push(`/browse/${departmentSlug}${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  function setPage(page: number) {
    const params = new URLSearchParams();
    if (selectedCategory) params.set('category', selectedCategory);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    router.push(`/browse/${departmentSlug}${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  return (
    <div>
      {/* Department header */}
      <div className={`border-b border-[var(--hw-border)] ${colors.bg}`}>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-2 text-sm text-[var(--hw-text-secondary)]">
            <Link href="/" className="hover:text-primary">Home</Link>
            <span>/</span>
            <Link href="/browse" className="hover:text-primary">Browse</Link>
            <span>/</span>
            <span className={colors.text}>{department?.name || departmentSlug}</span>
          </nav>

          {deptLoading ? (
            <div className="animate-pulse">
              <div className="h-8 w-48 rounded bg-white/60" />
              <div className="mt-2 h-4 w-96 rounded bg-white/40" />
            </div>
          ) : department ? (
            <>
              <h1 className={`text-2xl font-bold sm:text-3xl ${colors.text}`}>
                {department.name}
              </h1>
              {department.description && (
                <p className="mt-2 max-w-2xl text-[var(--hw-text-secondary)]">
                  {department.description}
                </p>
              )}
            </>
          ) : (
            <h1 className="text-2xl font-bold text-[var(--hw-text)]">Department</h1>
          )}

          {/* Category pills */}
          {department?.categories && department.categories.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() => setCategory('')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  !selectedCategory
                    ? `${colors.accent} text-white`
                    : 'bg-white text-[var(--hw-text-secondary)] shadow-sm hover:bg-[var(--hw-bg-tertiary)]'
                }`}
              >
                All
              </button>
              {department.categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.slug)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    selectedCategory === cat.slug
                      ? `${colors.accent} text-white`
                      : 'bg-white text-[var(--hw-text-secondary)] shadow-sm hover:bg-[var(--hw-bg-tertiary)]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Services */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {pagination && (
          <p className="mb-4 text-sm text-[var(--hw-text-secondary)]">
            {pagination.total} service{pagination.total !== 1 ? 's' : ''}
            {selectedCategory && department?.categories
              ? ` in ${department.categories.find((c) => c.slug === selectedCategory)?.name || selectedCategory}`
              : ''}
          </p>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ServiceCardSkeleton key={i} />
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--hw-border)] bg-[var(--hw-bg-secondary)] py-16 text-center">
            <svg className="h-12 w-12 text-[var(--hw-text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25" />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-[var(--hw-text)]">No services found</h3>
            <p className="mt-1 text-sm text-[var(--hw-text-secondary)]">
              {selectedCategory
                ? 'Try selecting a different category.'
                : 'No services available in this department yet.'}
            </p>
            {selectedCategory && (
              <button
                onClick={() => setCategory('')}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                View all in {department?.name}
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => {
              const pricingType = getPricingType(service);

              return (
                <Link
                  key={service.id}
                  href={`/services/${service.slug}`}
                  className="group rounded-xl border border-[var(--hw-border)] bg-white p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md dark:bg-[var(--hw-bg-secondary)]"
                >
                  <div className="flex items-center gap-2">
                    {service.category && (
                      <span className="rounded-full bg-[var(--hw-bg-tertiary)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--hw-text-secondary)]">
                        {service.category.name}
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${PRICING_TYPE_COLORS[pricingType] || 'bg-gray-100 text-gray-700'}`}>
                      {PRICING_TYPE_LABELS[pricingType] || pricingType}
                    </span>
                  </div>

                  <h3 className="mt-3 text-sm font-semibold text-[var(--hw-text)] group-hover:text-primary">
                    {service.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--hw-text-secondary)]">
                    {service.short_description}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-[var(--hw-border-light)] pt-3">
                    <span className="text-sm font-bold text-[var(--hw-text)]">
                      {formatPrice(service.base_price_cents, pricingType)}
                    </span>
                    <div className="flex items-center gap-3">
                      {service.estimated_duration_minutes && (
                        <span className="flex items-center gap-1 text-xs text-[var(--hw-text-tertiary)]">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatDuration(service.estimated_duration_minutes)}
                        </span>
                      )}
                      <span className="text-xs font-medium text-primary group-hover:underline">
                        View Details
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="rounded-lg border border-[var(--hw-border)] px-3 py-2 text-sm font-medium text-[var(--hw-text-secondary)] transition-colors hover:bg-[var(--hw-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(pagination.total_pages, 7) }, (_, i) => {
              let pageNum: number;
              if (pagination.total_pages <= 7) {
                pageNum = i + 1;
              } else if (currentPage <= 4) {
                pageNum = i + 1;
              } else if (currentPage >= pagination.total_pages - 3) {
                pageNum = pagination.total_pages - 6 + i;
              } else {
                pageNum = currentPage - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    pageNum === currentPage
                      ? 'bg-primary text-white'
                      : 'text-[var(--hw-text-secondary)] hover:bg-[var(--hw-bg-secondary)]'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              disabled={currentPage >= pagination.total_pages}
              onClick={() => setPage(currentPage + 1)}
              className="rounded-lg border border-[var(--hw-border)] px-3 py-2 text-sm font-medium text-[var(--hw-text-secondary)] transition-colors hover:bg-[var(--hw-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
