'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import { formatCurrency, formatDate } from '@/lib/ap-utils';
import AdminTable, { AdminColumn } from '@/components/AdminTable';

interface Row {
  id: string; st_job_id: number | null; job_number: string; estimate_job_number: string | null;
  sold_by: string | null; sold_on: string | null; components: number | null; systems: number | null;
  customer_name: string | null; job_type: string | null; completed_date: string | null;
  invoice: number | null; shearer_equipment: number | null;
  equipment_amount: number | null; material_amount: number | null; labor_amount: number | null;
}
type Amounts = Record<string, { equipment: string; material: string; labor: string }>;
type CostFilter = 'all' | 'costed' | 'uncosted';

function monthToDate(): DateRange {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(now) };
}
const ddCtl = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' } as const;

function JobTypeFilter({ all, selected, onChange }: { all: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const shown = all.filter(t => t.toLowerCase().includes(q.toLowerCase()));
  const label = selected.length === 0 ? 'All job types' : `${selected.length} job type${selected.length === 1 ? '' : 's'}`;
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="rounded-lg px-3 py-2 text-sm text-left" style={{ ...ddCtl, minWidth: 150 }}>{label} ▾</button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-1 rounded-lg p-2 w-72 max-h-80 overflow-auto" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search job types…" className="w-full rounded px-2 py-1.5 text-xs mb-2" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
            {shown.map(t => {
              const on = selected.includes(t);
              return (
                <label key={t} className="flex items-center gap-2 px-1.5 py-1 rounded text-xs cursor-pointer hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={on} onChange={() => onChange(on ? selected.filter(x => x !== t) : [...selected, t])} />{t}
                </label>
              );
            })}
            <div className="flex gap-2 mt-2">
              <button onClick={() => onChange(shown.every(t => selected.includes(t)) ? selected.filter(t => !shown.includes(t)) : Array.from(new Set([...selected, ...shown])))} className="text-xs flex-1 rounded py-1.5" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{shown.length > 0 && shown.every(t => selected.includes(t)) ? 'Deselect all' : 'Select all'}</button>
              <button onClick={() => onChange([])} className="text-xs flex-1 rounded py-1.5" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Clear</button>
              <button onClick={() => setOpen(false)} className="text-xs flex-1 rounded py-1.5" style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}>Done</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function JobCostsPage() {
  const perms = useAPPermissions();
  const [range, setRange] = useState<DateRange>(monthToDate());
  const [payPeriods, setPayPeriods] = useState<{ start: string; end: string }[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [amounts, setAmounts] = useState<Amounts>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState<string[]>([]);
  const [costFilter, setCostFilter] = useState<CostFilter>('all');
  const [nonZeroOnly, setNonZeroOnly] = useState(true);
  const [hasEquipOnly, setHasEquipOnly] = useState(true);
  const [advisorFilter, setAdvisorFilter] = useState('');
  const [laborRate, setLaborRate] = useState('');
  // Material is job-type-based: Full = $/system, Partial = $/component.
  const [fullMatRate, setFullMatRate] = useState('500');
  const [partialMatRate, setPartialMatRate] = useState('150');

  useEffect(() => { try {
    const l = localStorage.getItem('ap_std_labor_per_component'); if (l) setLaborRate(l);
    const f = localStorage.getItem('ap_full_material_per_system'); if (f != null) setFullMatRate(f);
    const p = localStorage.getItem('ap_partial_material_per_component'); if (p != null) setPartialMatRate(p);
  } catch { /* ignore */ } }, []);
  const onLaborRate = (v: string) => { const c = v.replace(/[^0-9.]/g, ''); setLaborRate(c); try { localStorage.setItem('ap_std_labor_per_component', c); } catch { /* ignore */ } };
  const onFullMat = (v: string) => { const c = v.replace(/[^0-9.]/g, ''); setFullMatRate(c); try { localStorage.setItem('ap_full_material_per_system', c); } catch { /* ignore */ } };
  const onPartialMat = (v: string) => { const c = v.replace(/[^0-9.]/g, ''); setPartialMatRate(c); try { localStorage.setItem('ap_partial_material_per_component', c); } catch { /* ignore */ } };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ start: range.start, end: range.end });
      const res = await fetch(`/api/job-costs?${p.toString()}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `Failed (${res.status})`); }
      const data = await res.json();
      const rs: Row[] = data.rows || [];
      setRows(rs);
      const a: Amounts = {};
      for (const r of rs) a[r.id] = {
        equipment: r.equipment_amount != null ? String(r.equipment_amount) : '',
        material: r.material_amount != null ? String(r.material_amount) : '',
        labor: r.labor_amount != null ? String(r.labor_amount) : '',
      };
      setAmounts(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { if (!perms.isLoading) load(); }, [load, perms.isLoading]);
  useEffect(() => {
    if (perms.isLoading) return;
    fetch('/api/payroll-periods').then(r => r.ok ? r.json() : []).then(setPayPeriods).catch(() => {});
  }, [perms.isLoading]);


  const jobTypeOptions = useMemo(() => Array.from(new Set(rows.map(r => r.job_type).filter(Boolean) as string[])).sort(), [rows]);
  const advisorOptions = useMemo(() => Array.from(new Set(rows.map(r => r.sold_by).filter(Boolean) as string[])).sort(), [rows]);
  const numOf = (s: string | undefined) => { const n = parseFloat(s || ''); return isNaN(n) ? 0 : n; };
  // Equipment = Shearer-linked actual when present, else the manual entry.
  const effEquip = (r: Row) => r.shearer_equipment != null ? r.shearer_equipment : numOf(amounts[r.id]?.equipment);
  // Standard labor = components × rate (even regardless of installer).
  const rate = numOf(laborRate);
  const stdLabor = (r: Row) => (r.components || 0) * rate;
  // Material by job type: Full = $/system × systems, Partial = $/component × components.
  const isFull = (r: Row) => /full/i.test(r.job_type || '');
  const isPartial = (r: Row) => /partial/i.test(r.job_type || '');
  const stdMaterial = (r: Row) =>
    isFull(r) ? numOf(fullMatRate) * (r.systems || 0)
      : isPartial(r) ? numOf(partialMatRate) * (r.components || 0)
        : 0;
  // Deal margin = invoice − equipment − material − labor.
  const margin = (r: Row) => r.invoice != null ? r.invoice - effEquip(r) - stdMaterial(r) - stdLabor(r) : null;
  const hasCost = (r: Row) => { const a = amounts[r.id]; return (r.shearer_equipment != null && r.shearer_equipment !== 0) || (!!a && (a.equipment !== '' || a.material !== '' || a.labor !== '')); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (q && !(`${r.job_number}`.toLowerCase().includes(q) || (r.customer_name || '').toLowerCase().includes(q) || (r.estimate_job_number || '').includes(q))) return false;
      if (jobTypeFilter.length > 0 && !(r.job_type && jobTypeFilter.includes(r.job_type))) return false;
      if (advisorFilter && r.sold_by !== advisorFilter) return false;
      if (nonZeroOnly && !(r.invoice && r.invoice > 0)) return false;
      if (hasEquipOnly && !(effEquip(r) > 0)) return false;
      if (costFilter === 'costed' && !hasCost(r)) return false;
      if (costFilter === 'uncosted' && hasCost(r)) return false;
      return true;
    });
  }, [rows, search, jobTypeFilter, advisorFilter, nonZeroOnly, hasEquipOnly, costFilter, amounts]);

  const onAmt = (id: string, field: 'equipment' | 'material' | 'labor', v: string) =>
    setAmounts(a => ({ ...a, [id]: { ...a[id], [field]: v.replace(/[^0-9.]/g, '') } }));

  const save = async (id: string, field: 'equipment' | 'material' | 'labor') => {
    const a = amounts[id]; if (!a) return;
    const key = `${field}_amount`;
    try {
      await fetch(`/api/job-costs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: a[field] === '' ? null : Number(a[field]) }) });
    } catch { /* surfaced on next load */ }
  };

  const pct = (amt: number, invoice: number | null) => invoice && invoice > 0 ? (amt / invoice) * 100 : null;
  const inputStyle = { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' };

  const moneyInput = (r: Row, field: 'equipment' | 'material' | 'labor') => (
    <input type="text" inputMode="decimal" value={amounts[r.id]?.[field] ?? ''} placeholder="0.00"
      onChange={e => onAmt(r.id, field, e.target.value)} onBlur={() => save(r.id, field)}
      className="w-24 rounded px-2 py-1 text-sm text-right tabular-nums" style={inputStyle} />
  );

  const cols = useMemo<AdminColumn<Row>[]>(() => [
    { key: 'job_number', label: 'Job #', sortable: true, width: 95, sortValue: r => Number(r.job_number) || r.job_number,
      render: r => r.st_job_id ? <a href={`https://go.servicetitan.com/#/Job/Index/${r.st_job_id}`} target="_blank" rel="noopener noreferrer" className="hover:underline font-semibold" style={{ color: 'var(--christmas-green)', whiteSpace: 'nowrap' }}>{r.job_number}</a> : <span style={{ fontWeight: 600 }}>{r.job_number}</span>,
      footer: rows => <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Totals · {rows.length}</span> },
    { key: 'estimate', label: 'Estimate #', sortable: true, width: 100, sortValue: r => r.estimate_job_number || '',
      render: r => r.estimate_job_number
        ? <a href={`https://go.servicetitan.com/#/Job/Index/${r.estimate_job_number}`} target="_blank" rel="noopener noreferrer" className="hover:underline tabular-nums font-semibold" style={{ color: '#6fd394' }}>{r.estimate_job_number}</a>
        : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'sold_by', label: 'Sold By', sortable: true, width: 140, sortValue: r => (r.sold_by || '').toLowerCase(),
      render: r => r.sold_by ? <span style={{ color: 'var(--text-primary)' }}>{r.sold_by}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'components', label: 'Components', sortable: true, align: 'right', width: 95, sortValue: r => r.components ?? -1,
      render: r => r.components != null ? <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{r.components}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>,
      footer: rows => String(rows.reduce((s, r) => s + (r.components || 0), 0)) },
    { key: 'systems', label: 'Systems', sortable: true, align: 'right', width: 80, sortValue: r => r.systems ?? -1,
      render: r => r.systems != null ? <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.systems}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>,
      footer: rows => String(rows.reduce((s, r) => s + (r.systems || 0), 0)) },
    { key: 'customer', label: 'Customer', sortable: true, width: 160, sortValue: r => (r.customer_name || '').toLowerCase(),
      render: r => <span className="truncate block" style={{ color: 'var(--text-primary)' }} title={r.customer_name || ''}>{r.customer_name || '—'}</span> },
    { key: 'type', label: 'Type', sortable: true, width: 150, sortValue: r => (r.job_type || '').toLowerCase(),
      render: r => <span className="truncate block" style={{ color: 'var(--text-secondary)' }} title={r.job_type || ''}>{r.job_type || '—'}</span> },
    { key: 'completed', label: 'Completed', sortable: true, width: 105, sortValue: r => r.completed_date || '',
      render: r => <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.completed_date ? formatDate(r.completed_date) : '—'}</span> },
    { key: 'invoice', label: 'Invoice $', sortable: true, align: 'right', width: 110, sortValue: r => r.invoice ?? -1,
      render: r => <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.invoice != null ? formatCurrency(r.invoice) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</span>,
      footer: rows => formatCurrency(rows.reduce((s, r) => s + (r.invoice || 0), 0)) },
    { key: 'equipment', label: 'Equipment $', sortable: true, align: 'right', width: 120, sortValue: r => effEquip(r),
      render: r => r.shearer_equipment != null
        ? <span className="tabular-nums" style={{ color: '#6fd394' }} title="From Shearer invoices">{formatCurrency(r.shearer_equipment)}</span>
        : moneyInput(r, 'equipment'),
      footer: rows => formatCurrency(rows.reduce((s, r) => s + effEquip(r), 0)) },
    { key: 'equip_pct', label: 'Equip %', sortable: true, align: 'right', width: 80, sortValue: r => pct(effEquip(r), r.invoice) ?? -1,
      render: r => { const p = pct(effEquip(r), r.invoice); return p != null && effEquip(r) > 0 ? <span className="tabular-nums" style={{ color: '#d29922' }}>{p.toFixed(1)}%</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>; },
      footer: rows => { const inv = rows.reduce((s, r) => s + (r.invoice || 0), 0); const e = rows.reduce((s, r) => s + effEquip(r), 0); return inv > 0 ? `${(e / inv * 100).toFixed(1)}%` : '—'; } },
    { key: 'material', label: 'Std Material $', sortable: true, align: 'right', width: 110, sortValue: r => stdMaterial(r),
      render: r => { const m = stdMaterial(r); const tip = isFull(r) ? `Full: ${r.systems || 0} systems × ${formatCurrency(numOf(fullMatRate))}` : isPartial(r) ? `Partial: ${r.components || 0} components × ${formatCurrency(numOf(partialMatRate))}` : 'not Full/Partial'; return m > 0 ? <span className="tabular-nums" style={{ color: '#5aa9e6' }} title={tip}>{formatCurrency(m)}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>; },
      footer: rows => formatCurrency(rows.reduce((s, r) => s + stdMaterial(r), 0)) },
    { key: 'mat_pct', label: 'Mat %', sortable: true, align: 'right', width: 80, sortValue: r => pct(stdMaterial(r), r.invoice) ?? -1,
      render: r => { const p = pct(stdMaterial(r), r.invoice); return p != null && stdMaterial(r) > 0 ? <span className="tabular-nums" style={{ color: '#5aa9e6' }}>{p.toFixed(1)}%</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>; },
      footer: rows => { const inv = rows.reduce((s, r) => s + (r.invoice || 0), 0); const m = rows.reduce((s, r) => s + stdMaterial(r), 0); return inv > 0 ? `${(m / inv * 100).toFixed(1)}%` : '—'; } },
    { key: 'labor', label: 'Std Labor $', sortable: true, align: 'right', width: 110, sortValue: r => stdLabor(r),
      render: r => r.components ? <span className="tabular-nums" style={{ color: '#a371f7' }} title={`${r.components} components × ${formatCurrency(rate)}`}>{formatCurrency(stdLabor(r))}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>,
      footer: rows => formatCurrency(rows.reduce((s, r) => s + stdLabor(r), 0)) },
    { key: 'labor_pct', label: 'Labor %', sortable: true, align: 'right', width: 80, sortValue: r => pct(stdLabor(r), r.invoice) ?? -1,
      render: r => { const p = pct(stdLabor(r), r.invoice); return p != null && stdLabor(r) > 0 ? <span className="tabular-nums" style={{ color: '#a371f7' }}>{p.toFixed(1)}%</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>; },
      footer: rows => { const inv = rows.reduce((s, r) => s + (r.invoice || 0), 0); const l = rows.reduce((s, r) => s + stdLabor(r), 0); return inv > 0 ? `${(l / inv * 100).toFixed(1)}%` : '—'; } },
    { key: 'margin', label: 'Margin $', sortable: true, align: 'right', width: 120, sortValue: r => margin(r) ?? -Infinity,
      render: r => { const m = margin(r); return m != null ? <span className="tabular-nums font-semibold" style={{ color: m >= 0 ? '#6fd394' : '#f85149' }}>{formatCurrency(m)}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>; },
      footer: rows => formatCurrency(rows.reduce((s, r) => s + (margin(r) || 0), 0)) },
    { key: 'margin_pct', label: 'Margin %', sortable: true, align: 'right', width: 90, sortValue: r => { const m = margin(r); return m != null && r.invoice ? m / r.invoice * 100 : -Infinity; },
      render: r => { const m = margin(r); const p = m != null && r.invoice && r.invoice > 0 ? m / r.invoice * 100 : null; return p != null ? <span className="tabular-nums font-semibold" style={{ color: p >= 0 ? '#6fd394' : '#f85149' }}>{p.toFixed(1)}%</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>; },
      footer: rows => { const inv = rows.reduce((s, r) => s + (r.invoice || 0), 0); const m = rows.reduce((s, r) => s + (margin(r) || 0), 0); return inv > 0 ? `${(m / inv * 100).toFixed(1)}%` : '—'; } },
  ], [amounts, laborRate, fullMatRate, partialMatRate]);

  if (!perms.isLoading && !perms.canManagePayments) {
    return <div className="p-8 text-sm" style={{ color: 'var(--text-muted)' }}>You don&apos;t have permission to view job costs.</div>;
  }
  const selectStyle = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' };

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Deal Margin</h1>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(58,143,87,.16)', color: '#6fd394' }}>HVAC Install</span>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        Comfort-advisor deals (Brett, Luke). Equipment $ from linked Shearer invoices; Labor = rate × components; Material = Full jobs $/system × systems, Partial jobs $/component × components. Each shows as a % of invoice.
      </p>

      <div className="flex items-center flex-wrap gap-2 mb-1">
        <DateRangePicker value={range} onChange={r => setRange(r)} defaultPreset="mtd" payPeriods={payPeriods} />
        <input type="text" placeholder="Search job #, customer, estimate…" value={search} onChange={e => setSearch(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm" style={{ ...selectStyle, minWidth: 220 }} />
        <JobTypeFilter all={jobTypeOptions} selected={jobTypeFilter} onChange={setJobTypeFilter} />
        {advisorOptions.length > 0 && (
          <select value={advisorFilter} onChange={e => setAdvisorFilter(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={selectStyle}>
            <option value="">All advisors</option>
            {advisorOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          {([['all', 'All'], ['costed', 'Costed'], ['uncosted', 'Uncosted']] as [CostFilter, string][]).map(([f, label]) => (
            <button key={f} onClick={() => setCostFilter(f)} className="px-3 py-1 rounded text-sm"
              style={{ backgroundColor: costFilter === f ? 'var(--christmas-green)' : 'transparent', color: costFilter === f ? 'var(--christmas-cream)' : 'var(--text-secondary)' }}>{label}</button>
          ))}
        </div>
        <button onClick={() => setNonZeroOnly(v => !v)} className="px-3 py-2 rounded-lg text-sm"
          style={{ backgroundColor: nonZeroOnly ? 'var(--christmas-green)' : 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: nonZeroOnly ? 'var(--christmas-cream)' : 'var(--text-secondary)' }}
          title="Show only jobs with an invoice over $0">Invoice &gt; $0</button>
        <button onClick={() => setHasEquipOnly(v => !v)} className="px-3 py-2 rounded-lg text-sm"
          style={{ backgroundColor: hasEquipOnly ? 'var(--christmas-green)' : 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: hasEquipOnly ? 'var(--christmas-cream)' : 'var(--text-secondary)' }}
          title="Show only jobs with equipment pulled from Shearer (so the Equip % total reflects just those)">Has Equip</button>
      </div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>Labor $/component
          <input type="text" inputMode="decimal" value={laborRate} placeholder="0.00" onChange={e => onLaborRate(e.target.value)}
            className="w-20 rounded px-2 py-1 text-sm text-right tabular-nums" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} /></span>
        <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>Material: Full $/system
          <input type="text" inputMode="decimal" value={fullMatRate} placeholder="500" onChange={e => onFullMat(e.target.value)}
            className="w-20 rounded px-2 py-1 text-sm text-right tabular-nums" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} /></span>
        <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>Partial $/component
          <input type="text" inputMode="decimal" value={partialMatRate} placeholder="150" onChange={e => onPartialMat(e.target.value)}
            className="w-20 rounded px-2 py-1 text-sm text-right tabular-nums" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} /></span>
      </div>

      {error && <div className="rounded-lg p-3 mb-4 text-sm" style={{ backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', color: '#f85149' }}>{error}</div>}

      {loading ? (
        <div className="rounded-lg p-8 text-center text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <AdminTable<Row> tableId="job-costs" columns={cols} rows={filtered} rowKey={r => r.id} showSearch={false} emptyMessage="No install jobs match these filters." />
      )}
    </div>
  );
}
