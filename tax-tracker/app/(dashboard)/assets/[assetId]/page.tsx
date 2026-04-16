'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, formatCurrencyPrecise, calculateAssetAge, getConditionLabel, getConditionColor } from '@/lib/bpp-utils';
import { calculateDepreciatedValue, getDepreciationPercent } from '@/lib/depreciation';
import { useBPPPermissions } from '@/hooks/useBPPPermissions';

export default function AssetDetailPage() {
  const { assetId } = useParams();
  const router = useRouter();
  const { canManageAssets } = useBPPPermissions();
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/assets/${assetId}`)
      .then(res => res.json())
      .then(setAsset)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [assetId]);

  const handleDelete = async () => {
    if (!confirm('Permanently delete this asset? This cannot be undone.')) return;
    await fetch(`/api/assets/${assetId}`, { method: 'DELETE' });
    router.push('/assets');
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div style={{ color: 'var(--text-muted)' }}>Loading...</div></div>;
  }

  if (!asset) {
    return <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Asset not found.</div>;
  }

  const currentYear = new Date().getFullYear();
  const age = calculateAssetAge(asset.year_acquired);
  const schedules = asset.depreciation_schedules || [];
  const depValue = calculateDepreciatedValue(Number(asset.total_cost), asset.year_acquired, schedules, currentYear);

  // Build depreciation timeline
  const timeline = [];
  for (let yr = asset.year_acquired; yr <= currentYear + 2; yr++) {
    const assetAge = yr - asset.year_acquired;
    const pct = getDepreciationPercent(schedules, assetAge);
    const value = Number(asset.total_cost) * (pct / 100);
    timeline.push({ year: yr, age: assetAge, percent: pct, value, isCurrent: yr === currentYear });
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Link href="/assets" style={{ color: 'var(--christmas-green-light)' }}>Assets</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-secondary)' }}>{asset.description}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{asset.description}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {asset.category?.name} {asset.subcategory ? `/ ${asset.subcategory}` : ''}
          </p>
        </div>
        {canManageAssets && (
          <div className="flex gap-2">
            <Link href="/assets" className="btn btn-secondary text-sm">Back</Link>
            <button onClick={handleDelete} className="btn text-sm" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>Delete</button>
          </div>
        )}
      </div>

      {asset.disposed && (
        <div className="card" style={{ borderColor: 'var(--status-error)', borderWidth: 1 }}>
          <p style={{ color: '#f87171' }}>This asset has been disposed{asset.disposed_date ? ` on ${asset.disposed_date}` : ''}.</p>
        </div>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Financial Details */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>Financial Details</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Quantity</div>
                <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{asset.quantity}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Unit Cost</div>
                <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrencyPrecise(asset.unit_cost)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total Cost</div>
                <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(Number(asset.total_cost))}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Depreciated Value</div>
                <div className="text-lg font-semibold" style={{ color: 'var(--christmas-green)' }}>{formatCurrency(depValue)}</div>
              </div>
            </div>
          </div>

          {/* Depreciation Timeline */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>Depreciation Timeline</h2>
            <div className="table-wrapper">
              <table className="bpp-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Age</th>
                    <th className="text-right">% of Cost</th>
                    <th className="text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map(row => (
                    <tr key={row.year} style={row.isCurrent ? { background: 'rgba(93, 138, 102, 0.15)' } : {}}>
                      <td style={{ color: row.isCurrent ? 'var(--christmas-green)' : 'var(--text-secondary)', fontWeight: row.isCurrent ? 600 : 400 }}>
                        {row.year} {row.isCurrent && '(current)'}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.age} yr</td>
                      <td className="text-right" style={{ color: 'var(--text-secondary)' }}>{row.percent}%</td>
                      <td className="text-right" style={{ color: row.isCurrent ? 'var(--christmas-green)' : 'var(--text-primary)' }}>{formatCurrency(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>Asset Info</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Year Acquired</dt>
                <dd style={{ color: 'var(--text-primary)' }}>{asset.year_acquired}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Age</dt>
                <dd style={{ color: 'var(--text-primary)' }}>{age} years</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Condition</dt>
                <dd>
                  <span className="badge" style={{ backgroundColor: `${getConditionColor(asset.condition)}20`, color: getConditionColor(asset.condition) }}>
                    {getConditionLabel(asset.condition)}
                  </span>
                </dd>
              </div>
              {asset.location && (
                <div>
                  <dt className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Location</dt>
                  <dd style={{ color: 'var(--text-primary)' }}>{asset.location}</dd>
                </div>
              )}
              {asset.serial_number && (
                <div>
                  <dt className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Serial / VIN</dt>
                  <dd style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{asset.serial_number}</dd>
                </div>
              )}
              {asset.notes && (
                <div>
                  <dt className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Notes</dt>
                  <dd className="text-sm" style={{ color: 'var(--text-secondary)' }}>{asset.notes}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
