'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import { formatCurrency, formatDate } from '@/lib/ap-utils';
import AdminTable, { AdminColumn } from '@/components/AdminTable';

interface Row {
  job_number: string; customer_name: string | null; completed_date: string | null;
  revenue: number | null; equipment: number; equipment_pct: number | null; invoice_count: number;
}
function monthToDate(): DateRange {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(now) };
}

export default function EquipmentByJobPage() {
  const perms = useAPPermissions();
  const [range, setRange] = useState<DateRange>(monthToDate());
  const [payPeriods, setPayPeriods] = useState<{ start: string; end: string }[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [unresolved, setUnresolved] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveMsg, setResolveMsg] = useState<string | null>(null);

  const canManage = perms.canManagePayments;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ start: range.start, end: range.end });
      const res = await fetch(`/api/reports/equipment-by-job?${p.toString()}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `Failed (${res.status})`); }
      const data = await res.json();
      setRows(data.rows || []);
      setUnresolved(data.unresolved || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { if (!perms.isLoading) load(); }, [load, perms.isLoading]);
  useEffect(() => {
    if (perms.isLoading) return;
    fetch('/api/payroll-periods').then(r => r.ok ? r.json() : []).then(setPayPeriods).catch(() => {});
  }, [perms.isLoading]);

  const resolveLinks = async () => {
    setResolving(true); setResolveMsg(null); setError(null);
    try {
      const res = await fetch('/api/supplier-invoices/resolve-links', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Resolve failed');
      setResolveMsg(`Resolved ${j.resolved} invoice${j.resolved === 1 ? '' : 's'} → ${j.linked} linked to an install job.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resolve failed');
    } finally { setResolving(false); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.job_number.toLowerCase().includes(q) || (r.customer_name || '').toLowerCase().includes(q));
  }, [rows, search]);

  const totalEquip = filtered.reduce((s, r) => s + r.equipment, 0);
  const totalRev = filtered.reduce((s, r) => s + (r.revenue || 0), 0);
  const blendedPct = totalRev > 0 ? (totalEquip / totalRev) * 100 : null;

  const cols = useMemo<AdminColumn<Row>[]>(() => [
    { key: 'job_number', label: 'Job #', sortable: true, width: 100, sortValue: r => Number(r.job_number) || r.job_number,
      render: r => <a href={`https://go.servicetitan.com/#/Job/Index/${r.job_number}`} target="_blank" rel="noopener noreferrer" className="hover:underline font-semibold" style={{ color: 'var(--christmas-green)' }}>{r.job_number}</a>,
      footer: rows => <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Totals · {rows.length}</span> },
    { key: 'customer', label: 'Customer', sortable: true, width: 180, sortValue: r => (r.customer_name || '').toLowerCase(),
      render: r => <span className="truncate block" style={{ color: 'var(--text-primary)' }} title={r.customer_name || ''}>{r.customer_name || '—'}</span> },
    { key: 'completed', label: 'Completed', sortable: true, width: 110, sortValue: r => r.completed_date || '',
      render: r => <span style={{ color: 'var(--text-secondary)' }}>{r.completed_date ? formatDate(r.completed_date) : '—'}</span> },
    { key: 'invoices', label: 'Invoices', sortable: true, align: 'right', width: 80, sortValue: r => r.invoice_count,
      render: r => <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.invoice_count}</span> },
    { key: 'revenue', label: 'Revenue', sortable: true, align: 'right', width: 120, sortValue: r => r.revenue ?? -1,
      render: r => <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.revenue != null ? formatCurrency(r.revenue) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</span>,
      footer: rows => formatCurrency(rows.reduce((s, r) => s + (r.revenue || 0), 0)) },
    { key: 'equipment', label: 'Equipment $', sortable: true, align: 'right', width: 120, sortValue: r => r.equipment,
      render: r => <span className="tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(r.equipment)}</span>,
      footer: rows => formatCurrency(rows.reduce((s, r) => s + r.equipment, 0)) },
    { key: 'pct', label: 'Equip % of Rev', sortable: true, align: 'right', width: 110, sortValue: r => r.equipment_pct ?? -1,
      render: r => r.equipment_pct != null ? <span className="tabular-nums" style={{ color: '#d29922' }}>{r.equipment_pct.toFixed(1)}%</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>,
      footer: () => { const ti = filtered.reduce((s, r) => s + (r.revenue || 0), 0); const te = filtered.reduce((s, r) => s + r.equipment, 0); return ti > 0 ? `${((te / ti) * 100).toFixed(1)}%` : '—'; } },
  ], [filtered]);

  if (!perms.isLoading && !perms.canManagePayments) {
    return <div className="p-8 text-sm" style={{ color: 'var(--text-muted)' }}>You don&apos;t have permission to view this report.</div>;
  }

  const selectStyle = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' };
  const cardStyle = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' };

  return (
    <div className="p-4 lg:p-6 max-w-[1100px] mx-auto">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Equipment by Job</h1>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(210,153,34,.16)', color: '#d29922' }}>HVAC Install</span>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        Equipment cost (from Shearer invoices, linked via the sales estimate&apos;s project) against each install job&apos;s revenue.
      </p>

      <div className="flex items-center flex-wrap gap-2 mb-1">
        <DateRangePicker value={range} onChange={r => setRange(r)} defaultPreset="mtd" payPeriods={payPeriods} />
        <input type="text" placeholder="Search job #, customer…" value={search} onChange={e => setSearch(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm" style={{ ...selectStyle, minWidth: 200 }} />
        {canManage && (
          <button onClick={resolveLinks} disabled={resolving} className="ml-auto rounded-lg px-3 py-2 text-sm font-medium"
            style={{ backgroundColor: unresolved > 0 ? 'var(--christmas-green)' : 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: unresolved > 0 ? 'var(--christmas-cream)' : 'var(--text-secondary)' }}>
            {resolving ? 'Linking…' : unresolved > 0 ? `Resolve ${unresolved} new link${unresolved === 1 ? '' : 's'}` : 'Re-resolve links'}
          </button>
        )}
      </div>
      <div className="text-[11px] mb-4" style={{ color: 'var(--text-muted)' }}>Date filter = install job completed date. Links Shearer PO → estimate project → install job.</div>

      {resolveMsg && <div className="rounded-lg p-3 mb-4 text-sm" style={{ backgroundColor: 'rgba(58,143,87,0.12)', border: '1px solid var(--christmas-green)', color: '#6fd394' }}>{resolveMsg}</div>}
      {error && <div className="rounded-lg p-3 mb-4 text-sm" style={{ backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', color: '#f85149' }}>{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Install Jobs</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{filtered.length}</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>with linked equipment</div>
        </div>
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Equipment $</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalEquip)}</div>
        </div>
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Revenue</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalRev)}</div>
        </div>
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Equip % of Revenue</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: '#d29922' }}>{blendedPct != null ? `${blendedPct.toFixed(1)}%` : '—'}</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>blended</div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg p-8 text-center text-sm" style={{ ...cardStyle, color: 'var(--text-muted)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg p-8 text-center text-sm" style={{ ...cardStyle, color: 'var(--text-muted)' }}>
          No equipment linked to install jobs in this range.{unresolved > 0 && canManage ? ` ${unresolved} invoice(s) need linking — click "Resolve" above.` : ''}
        </div>
      ) : (
        <AdminTable<Row> tableId="equipment-by-job" columns={cols} rows={filtered} rowKey={r => r.job_number} showSearch={false} emptyMessage="No jobs match." />
      )}

      <div className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
        Equipment $ = Shearer invoice cost linked to the job. Revenue = ST invoice revenue, or job total while in progress. &ldquo;Resolve links&rdquo; connects new Shearer POs to install jobs via ServiceTitan.
      </div>
    </div>
  );
}
