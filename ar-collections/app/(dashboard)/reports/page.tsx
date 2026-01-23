'use client';

import { useEffect, useState } from 'react';
import { formatCurrency, formatDate, getAgingBucketLabel } from '@/lib/ar-utils';
import { ARAgingSnapshot } from '@/lib/supabase';
import { useARPermissions } from '@/hooks/useARPermissions';

export default function ReportsPage() {
  const [snapshots, setSnapshots] = useState<ARAgingSnapshot[]>([]);
  const [currentTotals, setCurrentTotals] = useState<{
    total: number;
    current: number;
    bucket_30: number;
    bucket_60: number;
    bucket_90: number;
    install: number;
    service: number;
    collectible: number;
    not_in_control: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const { canViewReports, canExportData } = useARPermissions();

  useEffect(() => {
    fetchReportData();
  }, []);

  async function fetchReportData() {
    try {
      const [snapshotsRes, dashboardRes] = await Promise.all([
        fetch('/api/reports/snapshots', { credentials: 'include' }),
        fetch('/api/dashboard', { credentials: 'include' }),
      ]);

      if (snapshotsRes.ok) {
        const data = await snapshotsRes.json();
        setSnapshots(data.snapshots || []);
      }

      if (dashboardRes.ok) {
        const data = await dashboardRes.json();
        setCurrentTotals({
          total: data.total_outstanding,
          current: data.aging_buckets.current,
          bucket_30: data.aging_buckets.bucket_30,
          bucket_60: data.aging_buckets.bucket_60,
          bucket_90: data.aging_buckets.bucket_90_plus,
          install: data.install_total,
          service: data.service_total,
          collectible: data.ar_collectible,
          not_in_control: data.ar_not_in_control,
        });
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!canViewReports) {
    return (
      <div className="card">
        <div className="text-center" style={{ color: 'var(--status-error)' }}>
          You do not have permission to view reports.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ color: 'var(--text-muted)' }}>Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            AR Reports
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Aging analysis and historical trends
          </p>
        </div>
        {canExportData && (
          <button className="btn btn-secondary">
            Export to CSV
          </button>
        )}
      </div>

      {/* Current Aging Breakdown */}
      {currentTotals && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Current Aging Breakdown
          </h2>
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="text-right">Current</th>
                  <th className="text-right">31-60 Days</th>
                  <th className="text-right">61-90 Days</th>
                  <th className="text-right">90+ Days</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium">All AR</td>
                  <td className="text-right">{formatCurrency(currentTotals.current)}</td>
                  <td className="text-right">{formatCurrency(currentTotals.bucket_30)}</td>
                  <td className="text-right">{formatCurrency(currentTotals.bucket_60)}</td>
                  <td className="text-right" style={{ color: 'var(--status-error)' }}>
                    {formatCurrency(currentTotals.bucket_90)}
                  </td>
                  <td className="text-right font-bold">{formatCurrency(currentTotals.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Breakdown by Type */}
      {currentTotals && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              By Job Type
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--christmas-green)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Install</span>
                </div>
                <span className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                  {formatCurrency(currentTotals.install)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--status-info)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Service</span>
                </div>
                <span className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                  {formatCurrency(currentTotals.service)}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              By Control Bucket
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--status-success)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>AR Collectible</span>
                </div>
                <span className="font-semibold" style={{ color: 'var(--status-success)' }}>
                  {formatCurrency(currentTotals.collectible)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--status-warning)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Not In Our Control</span>
                </div>
                <span className="font-semibold" style={{ color: 'var(--status-warning)' }}>
                  {formatCurrency(currentTotals.not_in_control)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historical Trend */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Historical Trend (Last 30 Days)
        </h2>
        {snapshots.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            No historical data available yet. Snapshots are created daily.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Current</th>
                  <th className="text-right">31-60</th>
                  <th className="text-right">61-90</th>
                  <th className="text-right">90+</th>
                  <th className="text-right">Collectible</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.slice(0, 30).map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td>{formatDate(snapshot.snapshot_date)}</td>
                    <td className="text-right">{formatCurrency(snapshot.total_outstanding)}</td>
                    <td className="text-right">{formatCurrency(snapshot.current_bucket)}</td>
                    <td className="text-right">{formatCurrency(snapshot.bucket_30)}</td>
                    <td className="text-right">{formatCurrency(snapshot.bucket_60)}</td>
                    <td className="text-right">{formatCurrency(snapshot.bucket_90_plus)}</td>
                    <td className="text-right">{formatCurrency(snapshot.ar_collectible)}</td>
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
