'use client';

import { useEffect, useState } from 'react';

interface DashboardData {
  catalog: {
    departments: number;
    categories: number;
    total_services: number;
    active_services: number;
    featured_services: number;
    services_by_wave: Record<string, number>;
    services_by_pricing_type: Record<string, number>;
  };
  contractors: {
    total: number;
    pending: number;
    approved: number;
    suspended: number;
  };
  orders: {
    total: number;
    total_revenue: number;
  };
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="h-7 w-40 bg-[var(--admin-surface)] rounded animate-pulse" />
        <div className="h-4 w-64 bg-[var(--admin-surface)] rounded animate-pulse mt-2" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card">
            <div className="h-3 w-24 bg-[var(--admin-surface)] rounded animate-pulse" />
            <div className="h-8 w-16 bg-[var(--admin-surface)] rounded animate-pulse mt-2" />
            <div className="h-3 w-32 bg-[var(--admin-surface)] rounded animate-pulse mt-2" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="admin-card h-64 animate-pulse" />
        <div className="admin-card h-64 animate-pulse" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) throw new Error('Failed to load dashboard data');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="p-6">
        <div className="admin-card text-center py-12">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-secondary mt-4 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (cents: number) => {
    if (cents >= 100000) {
      return `$${(cents / 100000).toFixed(0)}K`;
    }
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const inactiveServices = data.catalog.total_services - data.catalog.active_services;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--admin-text)]">Dashboard</h1>
        <p className="text-sm text-[var(--admin-text-muted)] mt-1">
          Platform overview and key metrics
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Total Services</p>
              <p className="stat-value">{data.catalog.total_services}</p>
              <p className="stat-change text-[var(--admin-text-muted)]">
                {data.catalog.active_services} active / {inactiveServices} inactive
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Contractors</p>
              <p className="stat-value">{data.contractors.approved}</p>
              <p className="stat-change text-[var(--admin-text-muted)]">
                {data.contractors.pending > 0 ? (
                  <span className="text-yellow-400">{data.contractors.pending} pending review</span>
                ) : (
                  `${data.contractors.total} total`
                )}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Total Orders</p>
              <p className="stat-value">{data.orders.total.toLocaleString()}</p>
              <p className="stat-change text-[var(--admin-text-muted)]">
                All time
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Revenue</p>
              <p className="stat-value">{formatCurrency(data.orders.total_revenue)}</p>
              <p className="stat-change text-[var(--admin-text-muted)]">
                From completed orders
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Actions */}
        <div className="admin-card">
          <h2 className="text-base font-semibold text-[var(--admin-text)] mb-4">
            Pending Actions
          </h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--admin-surface)]">
              <div className="flex items-center gap-3">
                <span className="status-dot status-dot-pending" />
                <span className="text-sm text-[var(--admin-text)]">Contractor applications</span>
              </div>
              <span className={`badge ${data.contractors.pending > 0 ? 'badge-yellow' : 'badge-gray'}`}>
                {data.contractors.pending}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--admin-surface)]">
              <div className="flex items-center gap-3">
                <span className="status-dot status-dot-rejected" />
                <span className="text-sm text-[var(--admin-text)]">Suspended contractors</span>
              </div>
              <span className={`badge ${data.contractors.suspended > 0 ? 'badge-red' : 'badge-gray'}`}>
                {data.contractors.suspended}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--admin-surface)]">
              <div className="flex items-center gap-3">
                <span className="status-dot status-dot-active" />
                <span className="text-sm text-[var(--admin-text)]">Featured services</span>
              </div>
              <span className="badge badge-blue">
                {data.catalog.featured_services}
              </span>
            </div>
          </div>
        </div>

        {/* Catalog Breakdown */}
        <div className="admin-card">
          <h2 className="text-base font-semibold text-[var(--admin-text)] mb-4">
            Catalog Breakdown
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--admin-surface)]">
              <span className="text-sm text-[var(--admin-text)]">Departments</span>
              <span className="text-sm font-medium text-[var(--admin-text)]">
                {data.catalog.departments}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--admin-surface)]">
              <span className="text-sm text-[var(--admin-text)]">Categories</span>
              <span className="text-sm font-medium text-[var(--admin-text)]">
                {data.catalog.categories}
              </span>
            </div>
            {Object.entries(data.catalog.services_by_wave)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([wave, count]) => {
                const label = wave === 'unassigned' ? 'Unassigned' : `Wave ${wave.replace('wave_', '')}`;
                const badgeClass =
                  wave === 'wave_1' ? 'badge-green' :
                  wave === 'wave_2' ? 'badge-blue' :
                  wave === 'wave_3' ? 'badge-purple' :
                  wave === 'wave_4' ? 'badge-yellow' : 'badge-gray';
                return (
                  <div key={wave} className="flex items-center justify-between p-3 rounded-lg bg-[var(--admin-surface)]">
                    <span className="text-sm text-[var(--admin-text)]">{label}</span>
                    <span className={`badge ${badgeClass}`}>{count}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
