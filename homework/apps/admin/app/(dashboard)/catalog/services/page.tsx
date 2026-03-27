'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface ServiceItem {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  productizability: number;
  pricing_type: string;
  launch_wave: number;
  is_active: boolean;
  is_featured: boolean;
  homefit_rules: Record<string, any> | null;
  category: { id: string; name: string; slug: string };
  department: { id: string; name: string; slug: string };
}

interface Department {
  id: string;
  name: string;
  slug: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  department_id: string;
}

function TableSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-32 bg-[var(--admin-surface)] rounded animate-pulse" />
          <div className="h-4 w-48 bg-[var(--admin-surface)] rounded animate-pulse mt-2" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-9 w-48 bg-[var(--admin-surface)] rounded animate-pulse" />
        <div className="h-9 w-36 bg-[var(--admin-surface)] rounded animate-pulse" />
        <div className="h-9 w-28 bg-[var(--admin-surface)] rounded animate-pulse" />
        <div className="h-9 w-32 bg-[var(--admin-surface)] rounded animate-pulse" />
      </div>
      <div className="admin-card p-0">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[var(--admin-border)]">
            <div className="h-4 w-40 bg-[var(--admin-surface)] rounded animate-pulse" />
            <div className="h-4 w-20 bg-[var(--admin-surface)] rounded animate-pulse" />
            <div className="h-4 w-20 bg-[var(--admin-surface)] rounded animate-pulse" />
            <div className="h-4 w-16 bg-[var(--admin-surface)] rounded animate-pulse" />
            <div className="h-4 w-16 bg-[var(--admin-surface)] rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

function departmentBadgeClass(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('lot')) return 'badge-green';
  if (lower.includes('exterior')) return 'badge-blue';
  if (lower.includes('interior')) return 'badge-purple';
  return 'badge-gray';
}

function prodBadgeClass(value: number): string {
  if (value >= 4) return 'badge-green';
  if (value >= 3) return 'badge-blue';
  if (value >= 2) return 'badge-yellow';
  return 'badge-red';
}

function waveBadgeClass(wave: number): string {
  if (wave === 1) return 'badge-green';
  if (wave === 2) return 'badge-blue';
  if (wave === 3) return 'badge-purple';
  if (wave === 4) return 'badge-yellow';
  return 'badge-gray';
}

function pricingBadgeClass(type: string): string {
  if (type === 'instant_price') return 'badge-green';
  if (type === 'configurator') return 'badge-blue';
  if (type === 'photo_estimate') return 'badge-yellow';
  if (type === 'onsite_estimate') return 'badge-purple';
  return 'badge-gray';
}

function formatPricingType(type: string): string {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [waveFilter, setWaveFilter] = useState('all');
  const [pricingFilter, setPricingFilter] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      const [svcRes, deptRes, catRes] = await Promise.all([
        fetch('/api/catalog/services'),
        fetch('/api/catalog/departments'),
        fetch('/api/catalog/categories'),
      ]);
      if (!svcRes.ok) throw new Error('Failed to load services');
      const [svcData, deptData, catData] = await Promise.all([
        svcRes.json(),
        deptRes.json(),
        catRes.json(),
      ]);
      setServices(svcData);
      setDepartments(deptData);
      setCategories(catData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter categories by selected department
  const filteredCategories = departmentFilter === 'all'
    ? categories
    : categories.filter((c) => c.department_id === departmentFilter);

  // Reset category filter when department changes
  useEffect(() => {
    setCategoryFilter('all');
  }, [departmentFilter]);

  const filtered = services.filter((svc) => {
    if (search) {
      const q = search.toLowerCase();
      if (!svc.name.toLowerCase().includes(q) && !svc.category.name.toLowerCase().includes(q)) return false;
    }
    if (departmentFilter !== 'all' && svc.department.id !== departmentFilter) return false;
    if (categoryFilter !== 'all' && svc.category.id !== categoryFilter) return false;
    if (waveFilter !== 'all' && svc.launch_wave !== Number(waveFilter)) return false;
    if (pricingFilter !== 'all' && svc.pricing_type !== pricingFilter) return false;
    return true;
  });

  if (loading) return <TableSkeleton />;

  if (error) {
    return (
      <div className="p-6">
        <div className="admin-card text-center py-12">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-secondary mt-4 text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--admin-text)]">Services</h1>
          <p className="text-sm text-[var(--admin-text-muted)] mt-1">
            {services.length} services in catalog
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-input max-w-xs"
        />
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="admin-select"
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="admin-select"
        >
          <option value="all">All Categories</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={waveFilter}
          onChange={(e) => setWaveFilter(e.target.value)}
          className="admin-select"
        >
          <option value="all">All Waves</option>
          <option value="1">Wave 1</option>
          <option value="2">Wave 2</option>
          <option value="3">Wave 3</option>
          <option value="4">Wave 4</option>
        </select>
        <select
          value={pricingFilter}
          onChange={(e) => setPricingFilter(e.target.value)}
          className="admin-select"
        >
          <option value="all">All Pricing Types</option>
          <option value="instant_price">Instant Price</option>
          <option value="configurator">Configurator</option>
          <option value="photo_estimate">Photo Estimate</option>
          <option value="onsite_estimate">Onsite Estimate</option>
          <option value="custom">Custom</option>
        </select>
        <span className="text-sm text-[var(--admin-text-muted)] ml-auto">
          {filtered.length} results
        </span>
      </div>

      {/* Table */}
      <div className="admin-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Category</th>
                <th>Department</th>
                <th>Productizability</th>
                <th>Wave</th>
                <th>Pricing Type</th>
                <th>HomeFit</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-[var(--admin-text-muted)]">
                    No services found
                  </td>
                </tr>
              ) : (
                filtered.map((svc) => {
                  const hasHomeFit = svc.homefit_rules && Object.keys(svc.homefit_rules).length > 0;
                  return (
                    <tr key={svc.id}>
                      <td>
                        <Link
                          href={`/catalog/services/${svc.id}`}
                          className="font-medium text-[var(--admin-text)] hover:text-[var(--admin-primary)] transition-colors"
                        >
                          {svc.name}
                        </Link>
                      </td>
                      <td>{svc.category.name}</td>
                      <td>
                        <span className={`badge ${departmentBadgeClass(svc.department.name)}`}>
                          {svc.department.name}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${prodBadgeClass(svc.productizability)}`}>
                          {svc.productizability}/5
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${waveBadgeClass(svc.launch_wave)}`}>
                          Wave {svc.launch_wave}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${pricingBadgeClass(svc.pricing_type)}`}>
                          {formatPricingType(svc.pricing_type)}
                        </span>
                      </td>
                      <td>
                        {hasHomeFit ? (
                          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-[var(--admin-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${svc.is_active ? 'badge-green' : 'badge-gray'}`}>
                          {svc.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
