'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, getStatusLabel, getStatusColor, formatLocalDate } from '@/lib/bpp-utils';
import { useBPPPermissions } from '@/hooks/useBPPPermissions';
import { BPPRenditionSummary } from '@/lib/supabase';

export default function RenditionDetailPage() {
  const { renditionId } = useParams();
  const router = useRouter();
  const { canFileRenditions } = useBPPPermissions();
  const [rendition, setRendition] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/renditions/${renditionId}`)
      .then(r => r.json())
      .then(setRendition)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [renditionId]);

  const handleMarkFiled = async () => {
    const today = formatLocalDate(new Date());
    if (!confirm(`Mark this rendition as filed on ${today}?`)) return;

    await fetch(`/api/renditions/${renditionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'filed', filed_date: today, notes: rendition.notes }),
    });

    // Refresh
    const res = await fetch(`/api/renditions/${renditionId}`);
    setRendition(await res.json());
  };

  const handleExport = () => {
    window.open(`/api/renditions/${renditionId}/export`, '_blank');
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div style={{ color: 'var(--text-muted)' }}>Loading...</div></div>;
  }

  if (!rendition) {
    return <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Rendition not found.</div>;
  }

  const summary: BPPRenditionSummary[] = rendition.summary || [];
  const grandHistorical = summary.reduce((s, c) => s + c.total_historical_cost, 0);
  const grandDepreciated = summary.reduce((s, c) => s + c.total_depreciated_value, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Link href="/renditions" style={{ color: 'var(--christmas-green-light)' }}>Renditions</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-secondary)' }}>{rendition.tax_year} - {rendition.county} County</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {rendition.tax_year} Rendition — {rendition.county} County
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`badge badge-${rendition.status}`}>{getStatusLabel(rendition.status)}</span>
            {rendition.extension_filed && (
              <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                Extended to {rendition.extension_date}
              </span>
            )}
            {rendition.filed_date && (
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Filed {rendition.filed_date}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn btn-secondary gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
          {canFileRenditions && rendition.status === 'draft' && (
            <button onClick={handleMarkFiled} className="btn btn-primary text-sm">Mark as Filed</button>
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card" style={{ borderLeft: '3px solid var(--christmas-green)' }}>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total Historical Cost</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{formatCurrency(grandHistorical)}</div>
        </div>
        <div className="card" style={{ borderLeft: '3px solid var(--christmas-gold)' }}>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total Market Value</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{formatCurrency(grandDepreciated)}</div>
        </div>
        <div className="card" style={{ borderLeft: '3px solid var(--status-info)' }}>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total Depreciation</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {grandHistorical > 0 ? `${((1 - grandDepreciated / grandHistorical) * 100).toFixed(1)}%` : '0%'}
          </div>
        </div>
      </div>

      {/* Summary by Category */}
      {summary.length === 0 ? (
        <div className="card text-center py-8" style={{ color: 'var(--text-muted)' }}>
          No assets to report. <Link href="/assets" className="underline" style={{ color: 'var(--christmas-green-light)' }}>Add assets</Link> first.
        </div>
      ) : (
        summary.map(cat => (
          <div key={cat.category_id} className="card">
            <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>{cat.category_name}</h2>
            <div className="table-wrapper">
              <table className="bpp-table">
                <thead>
                  <tr>
                    <th>Year Acquired</th>
                    <th className="text-right">Items</th>
                    <th className="text-right">Historical Cost</th>
                    <th className="text-right">Market Value</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.items.map(item => (
                    <tr key={item.year_acquired}>
                      <td style={{ color: 'var(--text-primary)' }}>{item.year_acquired}</td>
                      <td className="text-right" style={{ color: 'var(--text-secondary)' }}>{item.count}</td>
                      <td className="text-right" style={{ color: 'var(--text-primary)' }}>{formatCurrency(item.historical_cost)}</td>
                      <td className="text-right" style={{ color: 'var(--christmas-green-light)' }}>{formatCurrency(item.depreciated_value)}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 600 }}>
                    <td style={{ color: 'var(--christmas-cream)' }}>Subtotal</td>
                    <td className="text-right" style={{ color: 'var(--text-secondary)' }}>{cat.items.reduce((s, i) => s + i.count, 0)}</td>
                    <td className="text-right" style={{ color: 'var(--christmas-cream)' }}>{formatCurrency(cat.total_historical_cost)}</td>
                    <td className="text-right" style={{ color: 'var(--christmas-green)' }}>{formatCurrency(cat.total_depreciated_value)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {summary.length > 0 && (
        <div className="card" style={{ borderTop: '2px solid var(--christmas-green)' }}>
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold" style={{ color: 'var(--christmas-cream)' }}>Grand Total</span>
            <div className="text-right">
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Historical: {formatCurrency(grandHistorical)}</div>
              <div className="text-xl font-bold" style={{ color: 'var(--christmas-green)' }}>Market: {formatCurrency(grandDepreciated)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {rendition.notes && (
        <div className="card">
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--christmas-cream)' }}>Notes</h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{rendition.notes}</p>
        </div>
      )}
    </div>
  );
}
