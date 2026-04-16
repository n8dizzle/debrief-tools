'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCurrency, getStatusLabel, getStatusColor, formatLocalDate } from '@/lib/bpp-utils';
import { useBPPPermissions } from '@/hooks/useBPPPermissions';
import { BPPRendition } from '@/lib/supabase';

export default function RenditionsPage() {
  const { canFileRenditions } = useBPPPermissions();
  const [renditions, setRenditions] = useState<BPPRendition[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchRenditions = () => {
    fetch('/api/renditions')
      .then(r => r.json())
      .then(setRenditions)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRenditions(); }, []);

  const handleCreate = async () => {
    const year = prompt('Tax year for rendition:', String(new Date().getFullYear()));
    if (!year) return;

    setCreating(true);
    try {
      const res = await fetch('/api/renditions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tax_year: parseInt(year), county: 'Harris' }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to create');
        return;
      }
      fetchRenditions();
    } catch { alert('Failed to create rendition'); }
    finally { setCreating(false); }
  };

  const handleFileExtension = async (id: string) => {
    if (!confirm('Mark extension as filed? This sets the new due date to May 15.')) return;
    const rendition = renditions.find(r => r.id === id);
    if (!rendition) return;

    await fetch(`/api/renditions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...rendition,
        extension_filed: true,
        extension_date: `${rendition.tax_year}-05-15`,
      }),
    });
    fetchRenditions();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>Renditions</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Annual BPP tax rendition filings</p>
        </div>
        {canFileRenditions && (
          <button onClick={handleCreate} className="btn btn-primary gap-2" disabled={creating}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {creating ? 'Creating...' : 'New Rendition'}
          </button>
        )}
      </div>

      <div className="card p-0">
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : renditions.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
            No renditions yet. Create one for the current tax year.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="bpp-table">
              <thead>
                <tr>
                  <th>Tax Year</th>
                  <th>County</th>
                  <th>Status</th>
                  <th className="text-right">Historical Cost</th>
                  <th className="text-right">Market Value</th>
                  <th>Due Date</th>
                  <th>Extension</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {renditions.map(r => (
                  <tr key={r.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.tax_year}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{r.county}</td>
                    <td>
                      <span className={`badge badge-${r.status}`}>{getStatusLabel(r.status)}</span>
                    </td>
                    <td className="text-right" style={{ color: 'var(--text-primary)' }}>
                      {r.total_historical_cost ? formatCurrency(r.total_historical_cost) : '-'}
                    </td>
                    <td className="text-right" style={{ color: 'var(--christmas-green-light)' }}>
                      {r.total_market_value ? formatCurrency(r.total_market_value) : '-'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{r.due_date || '-'}</td>
                    <td>
                      {r.extension_filed ? (
                        <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                          Extended to {r.extension_date}
                        </span>
                      ) : (
                        canFileRenditions && r.status === 'draft' && (
                          <button onClick={() => handleFileExtension(r.id)} className="text-xs underline" style={{ color: 'var(--christmas-green-light)' }}>
                            File Extension
                          </button>
                        )
                      )}
                    </td>
                    <td className="text-right">
                      <Link href={`/renditions/${r.id}`} className="text-xs underline" style={{ color: 'var(--christmas-green-light)' }}>
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
