'use client';

import { useState, useEffect, useCallback } from 'react';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import { formatCurrency } from '@/lib/ap-utils';
import MarginGrid, { MarginRow } from '@/components/MarginGrid';
import MarginDeltaChart from '@/components/MarginDeltaChart';
import CostEditorDrawer from '@/components/CostEditorDrawer';

interface MarginSummary {
  job_count: number;
  priced_count: number;
  pending_count: number;
  total_revenue: number;
  total_adjusted_cost: number;
  total_adjusted_gross_margin: number;
  avg_adjusted_gm_pct: number | null;
}

function monthToDate(): DateRange {
  const now = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(now) };
}

type GroupBy = 'none' | 'trade' | 'contractor' | 'job_type';

export default function MarginPage() {
  const perms = useAPPermissions();
  const [range, setRange] = useState<DateRange>(monthToDate());
  const [trade, setTrade] = useState<'all' | 'hvac' | 'plumbing'>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [rows, setRows] = useState<MarginRow[]>([]);
  const [summary, setSummary] = useState<MarginSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerRow, setDrawerRow] = useState<MarginRow | null>(null);

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    p.set('start', range.start);
    p.set('end', range.end);
    if (trade !== 'all') p.set('trade', trade);
    if (groupBy !== 'none') p.set('group_by', groupBy);
    return p;
  }, [range, trade, groupBy]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/margin?${buildParams().toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setRows(data.rows || []);
      setSummary(data.summary || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load margin data');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    if (perms.isLoading) return;
    load();
  }, [load, perms.isLoading]);

  // Keep the drawer's row in sync with refreshed data after an adjustment edit.
  const refreshAndSyncDrawer = useCallback(async () => {
    await load();
  }, [load]);

  useEffect(() => {
    if (!drawerRow) return;
    const updated = rows.find((r) => r.id === drawerRow.id);
    if (updated && updated !== drawerRow) setDrawerRow(updated);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = () => {
    const p = buildParams();
    p.set('format', 'csv');
    window.open(`/api/margin?${p.toString()}`, '_blank');
  };

  if (!perms.isLoading && !perms.canViewMargin) {
    return (
      <div className="p-8 text-sm" style={{ color: 'var(--text-muted)' }}>
        You don&apos;t have permission to view gross margin. Contact an administrator for the
        <span className="font-mono"> can_view_margin </span> permission.
      </div>
    );
  }

  const pct = (f: number | null | undefined) => (f == null ? '—' : `${(f * 100).toFixed(1)}%`);

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Gross Margin</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            True margin on install jobs — ServiceTitan costs plus contractor pay and your adjustments.
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="rounded-lg px-3 py-2 text-sm font-medium"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center flex-wrap gap-3 mb-4">
        <DateRangePicker value={range} onChange={(r) => setRange(r)} defaultPreset="mtd" dataDelay={3} />
        <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          {(['all', 'hvac', 'plumbing'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTrade(t)}
              className="px-3 py-1 rounded text-sm capitalize"
              style={{
                backgroundColor: trade === t ? 'var(--christmas-green)' : 'transparent',
                color: trade === t ? 'var(--christmas-cream)' : 'var(--text-secondary)',
              }}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          className="rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          <option value="none">No grouping</option>
          <option value="trade">Group by trade</option>
          <option value="contractor">Group by contractor</option>
          <option value="job_type">Group by job type</option>
        </select>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Revenue', value: formatCurrency(summary.total_revenue) },
            { label: 'Adjusted cost', value: formatCurrency(summary.total_adjusted_cost) },
            { label: 'Adjusted gross margin', value: formatCurrency(summary.total_adjusted_gross_margin) },
            { label: 'Avg adjusted GM%', value: pct(summary.avg_adjusted_gm_pct) },
          ].map((c) => (
            <div key={c.label} className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.label}</div>
              <div className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {summary && summary.pending_count > 0 && (
        <div className="text-xs mb-3" style={{ color: '#d29922' }}>
          {summary.pending_count} job{summary.pending_count === 1 ? '' : 's'} awaiting ServiceTitan cost sync — excluded from totals.
        </div>
      )}

      {error && (
        <div className="rounded-lg p-3 mb-4 text-sm" style={{ backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', color: '#f85149' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg p-8 text-center text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
          Loading…
        </div>
      ) : (
        <div className="space-y-4">
          <MarginDeltaChart rows={rows} />
          <MarginGrid rows={rows} grouped={groupBy !== 'none'} onRowClick={setDrawerRow} />
        </div>
      )}

      <CostEditorDrawer
        row={drawerRow}
        canEdit={perms.canManagePayments}
        onClose={() => setDrawerRow(null)}
        onChanged={refreshAndSyncDrawer}
      />
    </div>
  );
}
