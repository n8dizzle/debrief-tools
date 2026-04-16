'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCurrency, getStatusLabel, getStatusColor } from '@/lib/bpp-utils';
import { BPPDashboardStats } from '@/lib/supabase';

export default function DashboardPage() {
  const [stats, setStats] = useState<BPPDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center" style={{ color: 'var(--text-muted)' }}>Loading dashboard...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
        Failed to load dashboard data.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>Tax Tracker</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Business Personal Property Rendition</p>
        </div>
        <Link href="/assets" className="btn btn-primary gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Asset
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card" style={{ borderLeft: '3px solid var(--status-info)' }}>
          <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total Assets</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{stats.total_assets}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{stats.disposed_count} disposed</div>
        </div>
        <div className="card" style={{ borderLeft: '3px solid var(--christmas-green)' }}>
          <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Historical Cost</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{formatCurrency(stats.total_historical_cost)}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Original purchase value</div>
        </div>
        <div className="card" style={{ borderLeft: '3px solid var(--christmas-gold)' }}>
          <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Depreciated Value</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{formatCurrency(stats.total_depreciated_value)}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Current market estimate</div>
        </div>
        <div className="card" style={{ borderLeft: `3px solid ${stats.current_rendition ? getStatusColor(stats.current_rendition.status) : 'var(--status-warning)'}` }}>
          <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{new Date().getFullYear()} Rendition</div>
          {stats.current_rendition ? (
            <>
              <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{getStatusLabel(stats.current_rendition.status)}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {stats.current_rendition.extension_filed ? 'Extended to May 15' : 'Due April 15'}
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold" style={{ color: 'var(--status-warning)' }}>Not Started</div>
              <Link href="/renditions" className="text-xs mt-1 underline" style={{ color: 'var(--christmas-green-light)' }}>Create rendition</Link>
            </>
          )}
        </div>
      </div>

      {/* Categories Breakdown */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>Assets by Category</h2>
        {stats.categories.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No assets yet. <Link href="/assets" className="underline">Add your first asset</Link> or <Link href="/import" className="underline">import from CSV</Link>.</p>
        ) : (
          <div className="table-wrapper">
            <table className="bpp-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="text-right">Assets</th>
                  <th className="text-right">Historical Cost</th>
                  <th className="text-right">Depreciated Value</th>
                  <th className="text-right">Depreciation</th>
                </tr>
              </thead>
              <tbody>
                {stats.categories.filter(c => c.asset_count > 0).map(cat => {
                  const depPct = cat.historical_cost > 0
                    ? ((1 - cat.depreciated_value / cat.historical_cost) * 100).toFixed(0)
                    : '0';
                  return (
                    <tr key={cat.id}>
                      <td style={{ color: 'var(--text-primary)' }}>{cat.name}</td>
                      <td className="text-right" style={{ color: 'var(--text-secondary)' }}>{cat.asset_count}</td>
                      <td className="text-right" style={{ color: 'var(--text-primary)' }}>{formatCurrency(cat.historical_cost)}</td>
                      <td className="text-right" style={{ color: 'var(--christmas-green-light)' }}>{formatCurrency(cat.depreciated_value)}</td>
                      <td className="text-right" style={{ color: 'var(--text-muted)' }}>{depPct}%</td>
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: 600 }}>
                  <td style={{ color: 'var(--christmas-cream)' }}>Total</td>
                  <td className="text-right" style={{ color: 'var(--christmas-cream)' }}>{stats.total_assets}</td>
                  <td className="text-right" style={{ color: 'var(--christmas-cream)' }}>{formatCurrency(stats.total_historical_cost)}</td>
                  <td className="text-right" style={{ color: 'var(--christmas-green)' }}>{formatCurrency(stats.total_depreciated_value)}</td>
                  <td className="text-right" style={{ color: 'var(--text-muted)' }}>
                    {stats.total_historical_cost > 0
                      ? ((1 - stats.total_depreciated_value / stats.total_historical_cost) * 100).toFixed(0)
                      : '0'}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Assets */}
      {stats.recent_assets.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>Recently Added</h2>
            <Link href="/assets" className="text-sm" style={{ color: 'var(--christmas-green-light)' }}>View all</Link>
          </div>
          <div className="table-wrapper">
            <table className="bpp-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Category</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Total Cost</th>
                  <th>Year</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_assets.map(asset => (
                  <tr key={asset.id}>
                    <td>
                      <Link href={`/assets/${asset.id}`} style={{ color: 'var(--christmas-green-light)' }}>
                        {asset.description}
                      </Link>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{(asset.category as any)?.name || ''}</td>
                    <td className="text-right" style={{ color: 'var(--text-secondary)' }}>{asset.quantity}</td>
                    <td className="text-right" style={{ color: 'var(--text-primary)' }}>{formatCurrency(Number(asset.total_cost))}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{asset.year_acquired}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
