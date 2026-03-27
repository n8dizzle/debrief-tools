'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Department {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  category_count?: number;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  department?: Department;
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
  launch_wave?: number;
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

const DEPARTMENT_COLORS: Record<string, string> = {
  'the-lot': 'bg-emerald-100 text-emerald-700',
  'the-exterior': 'bg-blue-100 text-blue-700',
  'the-interior': 'bg-amber-100 text-amber-700',
};

const DEPARTMENT_ICONS: Record<string, React.ReactNode> = {
  'the-lot': (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  ),
  'the-exterior': (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
    </svg>
  ),
  'the-interior': (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
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

function getDeptBadgeColor(slug: string | undefined): string {
  if (!slug) return 'bg-gray-100 text-gray-700';
  return DEPARTMENT_COLORS[slug] || 'bg-gray-100 text-gray-700';
}

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
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-[var(--hw-bg-tertiary)]" />
        <div className="flex-1">
          <div className="h-4 w-3/4 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="mt-2 h-3 w-full rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="mt-1 h-3 w-2/3 rounded bg-[var(--hw-bg-tertiary)]" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-16 rounded-full bg-[var(--hw-bg-tertiary)]" />
        <div className="h-5 w-20 rounded-full bg-[var(--hw-bg-tertiary)]" />
      </div>
      <div className="mt-3 h-4 w-24 rounded bg-[var(--hw-bg-tertiary)]" />
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 w-48 bg-slate-200 rounded mb-4" /><div className="grid grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-48 bg-slate-100 rounded-xl" />)}</div></div>}>
      <BrowseContent />
    </Suspense>
  );
}

function BrowseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [deptLoading, setDeptLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedDepartment, setSelectedDepartment] = useState(searchParams.get('department') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedPricingType, setSelectedPricingType] = useState(searchParams.get('pricing_type') || '');
  const [selectedWave, setSelectedWave] = useState(searchParams.get('wave') || '');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  const [showFilters, setShowFilters] = useState(false);

  // Fetch departments
  useEffect(() => {
    async function fetchDepartments() {
      try {
        const res = await fetch('/api/departments');
        if (res.ok) {
          const data = await res.json();
          setDepartments(data.departments || data || []);
        }
      } catch (err) {
        console.error('Failed to fetch departments:', err);
      } finally {
        setDeptLoading(false);
      }
    }
    fetchDepartments();
  }, []);

  // Fetch services
  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDepartment) params.set('department', selectedDepartment);
      if (selectedCategory) params.set('category', selectedCategory);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (selectedPricingType) params.set('pricing_type', selectedPricingType);
      if (selectedWave) params.set('wave', selectedWave);
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
  }, [selectedDepartment, selectedCategory, searchQuery, selectedPricingType, selectedWave, currentPage]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedDepartment) params.set('department', selectedDepartment);
    if (selectedCategory) params.set('category', selectedCategory);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (selectedPricingType) params.set('pricing_type', selectedPricingType);
    if (selectedWave) params.set('wave', selectedWave);
    if (currentPage > 1) params.set('page', String(currentPage));

    const qs = params.toString();
    const newUrl = qs ? `/browse?${qs}` : '/browse';
    router.replace(newUrl, { scroll: false });
  }, [selectedDepartment, selectedCategory, searchQuery, selectedPricingType, selectedWave, currentPage, router]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setCurrentPage(1);
  }

  function clearFilters() {
    setSelectedDepartment('');
    setSelectedCategory('');
    setSelectedPricingType('');
    setSelectedWave('');
    setSearchQuery('');
    setCurrentPage(1);
  }

  const hasActiveFilters = selectedDepartment || selectedCategory || selectedPricingType || selectedWave || searchQuery;

  return (
    <div>
      {/* Page header */}
      <div className="border-b border-[var(--hw-border)] bg-[var(--hw-bg-secondary)]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-[var(--hw-text)] sm:text-3xl">
            Browse Services
          </h1>
          <p className="mt-2 text-[var(--hw-text-secondary)]">
            Find the right service for your home from our curated catalog.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="mt-6 max-w-2xl">
            <div className="flex overflow-hidden rounded-xl border border-[var(--hw-border)] bg-white shadow-sm dark:bg-[var(--hw-bg)]">
              <div className="flex flex-1 items-center gap-3 px-4 py-3">
                <svg
                  className="h-5 w-5 flex-shrink-0 text-[var(--hw-text-tertiary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm text-[var(--hw-text)] placeholder-[var(--hw-text-tertiary)] outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                    className="text-[var(--hw-text-tertiary)] hover:text-[var(--hw-text)]"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="m-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Department cards */}
        {!deptLoading && departments.length > 0 && !selectedDepartment && (
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {departments.map((dept) => (
              <button
                key={dept.id}
                onClick={() => { setSelectedDepartment(dept.slug); setCurrentPage(1); }}
                className="group flex items-center gap-4 rounded-xl border border-[var(--hw-border)] bg-white p-4 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md dark:bg-[var(--hw-bg-secondary)]"
              >
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${getDeptBadgeColor(dept.slug)}`}>
                  {DEPARTMENT_ICONS[dept.slug] || (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-[var(--hw-text)] group-hover:text-primary">
                    {dept.name}
                  </h3>
                  {dept.description && (
                    <p className="mt-0.5 truncate text-xs text-[var(--hw-text-secondary)]">
                      {dept.description}
                    </p>
                  )}
                </div>
                <svg className="h-4 w-4 flex-shrink-0 text-[var(--hw-text-tertiary)] transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Filter sidebar - desktop */}
          <aside className="hidden w-64 flex-shrink-0 lg:block">
            <div className="sticky top-20 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--hw-text)]">Filters</h2>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-xs font-medium text-primary hover:text-primary-dark">
                    Clear all
                  </button>
                )}
              </div>

              {/* Department filter */}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--hw-text-tertiary)]">
                  Department
                </h3>
                <div className="space-y-1">
                  <button
                    onClick={() => { setSelectedDepartment(''); setSelectedCategory(''); setCurrentPage(1); }}
                    className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                      !selectedDepartment ? 'bg-primary/10 font-medium text-primary' : 'text-[var(--hw-text-secondary)] hover:bg-[var(--hw-bg-tertiary)]'
                    }`}
                  >
                    All Departments
                  </button>
                  {departments.map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() => { setSelectedDepartment(dept.slug); setSelectedCategory(''); setCurrentPage(1); }}
                      className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                        selectedDepartment === dept.slug ? 'bg-primary/10 font-medium text-primary' : 'text-[var(--hw-text-secondary)] hover:bg-[var(--hw-bg-tertiary)]'
                      }`}
                    >
                      {dept.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pricing type filter */}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--hw-text-tertiary)]">
                  Pricing Type
                </h3>
                <div className="space-y-1">
                  <button
                    onClick={() => { setSelectedPricingType(''); setCurrentPage(1); }}
                    className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                      !selectedPricingType ? 'bg-primary/10 font-medium text-primary' : 'text-[var(--hw-text-secondary)] hover:bg-[var(--hw-bg-tertiary)]'
                    }`}
                  >
                    All Types
                  </button>
                  {Object.entries(PRICING_TYPE_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setSelectedPricingType(key); setCurrentPage(1); }}
                      className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                        selectedPricingType === key ? 'bg-primary/10 font-medium text-primary' : 'text-[var(--hw-text-secondary)] hover:bg-[var(--hw-bg-tertiary)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wave filter */}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--hw-text-tertiary)]">
                  Launch Wave
                </h3>
                <div className="space-y-1">
                  <button
                    onClick={() => { setSelectedWave(''); setCurrentPage(1); }}
                    className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                      !selectedWave ? 'bg-primary/10 font-medium text-primary' : 'text-[var(--hw-text-secondary)] hover:bg-[var(--hw-bg-tertiary)]'
                    }`}
                  >
                    All Waves
                  </button>
                  {[1, 2, 3, 4].map((wave) => (
                    <button
                      key={wave}
                      onClick={() => { setSelectedWave(String(wave)); setCurrentPage(1); }}
                      className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                        selectedWave === String(wave) ? 'bg-primary/10 font-medium text-primary' : 'text-[var(--hw-text-secondary)] hover:bg-[var(--hw-bg-tertiary)]'
                      }`}
                    >
                      Wave {wave}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Mobile filter toggle */}
          <div className="flex items-center justify-between lg:hidden">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--hw-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--hw-text-secondary)] shadow-sm hover:bg-[var(--hw-bg-secondary)] dark:bg-[var(--hw-bg-secondary)]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Filters
              {hasActiveFilters && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white">
                  !
                </span>
              )}
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs font-medium text-primary hover:text-primary-dark">
                Clear all
              </button>
            )}
          </div>

          {/* Mobile filter panel */}
          {showFilters && (
            <div className="rounded-xl border border-[var(--hw-border)] bg-white p-4 shadow-sm dark:bg-[var(--hw-bg-secondary)] lg:hidden">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--hw-text-tertiary)]">Department</label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => { setSelectedDepartment(e.target.value); setSelectedCategory(''); setCurrentPage(1); }}
                    className="w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2 text-sm text-[var(--hw-text)]"
                  >
                    <option value="">All</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.slug}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--hw-text-tertiary)]">Pricing</label>
                  <select
                    value={selectedPricingType}
                    onChange={(e) => { setSelectedPricingType(e.target.value); setCurrentPage(1); }}
                    className="w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2 text-sm text-[var(--hw-text)]"
                  >
                    <option value="">All</option>
                    {Object.entries(PRICING_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--hw-text-tertiary)]">Wave</label>
                  <select
                    value={selectedWave}
                    onChange={(e) => { setSelectedWave(e.target.value); setCurrentPage(1); }}
                    className="w-full rounded-lg border border-[var(--hw-border)] bg-white px-3 py-2 text-sm text-[var(--hw-text)]"
                  >
                    <option value="">All</option>
                    {[1, 2, 3, 4].map((w) => (
                      <option key={w} value={w}>Wave {w}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Main content */}
          <div className="min-w-0 flex-1">
            {/* Active filter pills */}
            {hasActiveFilters && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {selectedDepartment && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {departments.find((d) => d.slug === selectedDepartment)?.name || selectedDepartment}
                    <button onClick={() => { setSelectedDepartment(''); setSelectedCategory(''); setCurrentPage(1); }}>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {selectedPricingType && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {PRICING_TYPE_LABELS[selectedPricingType]}
                    <button onClick={() => { setSelectedPricingType(''); setCurrentPage(1); }}>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {selectedWave && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    Wave {selectedWave}
                    <button onClick={() => { setSelectedWave(''); setCurrentPage(1); }}>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    &quot;{searchQuery}&quot;
                    <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }}>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Results count */}
            {pagination && (
              <p className="mb-4 text-sm text-[var(--hw-text-secondary)]">
                {pagination.total} service{pagination.total !== 1 ? 's' : ''} found
              </p>
            )}

            {/* Service grid */}
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ServiceCardSkeleton key={i} />
                ))}
              </div>
            ) : services.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--hw-border)] bg-[var(--hw-bg-secondary)] py-16 text-center">
                <svg className="h-12 w-12 text-[var(--hw-text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <h3 className="mt-4 text-lg font-semibold text-[var(--hw-text)]">No services found</h3>
                <p className="mt-1 text-sm text-[var(--hw-text-secondary)]">
                  Try adjusting your filters or search query.
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {services.map((service) => {
                  const pricingType = getPricingType(service);
                  const deptSlug = service.category?.department?.slug;

                  return (
                    <Link
                      key={service.id}
                      href={`/services/${service.slug}`}
                      className="group rounded-xl border border-[var(--hw-border)] bg-white p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md dark:bg-[var(--hw-bg-secondary)]"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${getDeptBadgeColor(deptSlug)}`}>
                          {deptSlug && DEPARTMENT_ICONS[deptSlug] ? (
                            <div className="h-5 w-5">
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384 3.18 1.41-5.996-4.656-4.024 6.14-.514L11.42 2l2.49 5.816 6.14.514-4.656 4.024 1.41 5.996-5.384-3.18z" />
                              </svg>
                            </div>
                          ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384 3.18 1.41-5.996-4.656-4.024 6.14-.514L11.42 2l2.49 5.816 6.14.514-4.656 4.024 1.41 5.996-5.384-3.18z" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-[var(--hw-text)] group-hover:text-primary">
                            {service.name}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--hw-text-secondary)]">
                            {service.short_description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {service.category?.department && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getDeptBadgeColor(deptSlug)}`}>
                            {service.category.department.name}
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRICING_TYPE_COLORS[pricingType] || 'bg-gray-100 text-gray-700'}`}>
                          {PRICING_TYPE_LABELS[pricingType] || pricingType}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-bold text-[var(--hw-text)]">
                          {formatPrice(service.base_price_cents, pricingType)}
                        </span>
                        {service.estimated_duration_minutes && (
                          <span className="text-xs text-[var(--hw-text-tertiary)]">
                            {formatDuration(service.estimated_duration_minutes)}
                          </span>
                        )}
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
                  onClick={() => setCurrentPage(currentPage - 1)}
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
                      onClick={() => setCurrentPage(pageNum)}
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
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="rounded-lg border border-[var(--hw-border)] px-3 py-2 text-sm font-medium text-[var(--hw-text-secondary)] transition-colors hover:bg-[var(--hw-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
