'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Deal, TriageStatus } from '@/lib/deals';

const usd = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const stProject = (id: number) => `https://go.servicetitan.com/#/Project/${id}`;
function fmtCloseDate(iso: string | null): string {
  if (!iso) return 'not dated';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${+m}/${+d}/${y}`;
}

// Central-safe local date (never toISOString — that shifts to UTC).
function fmtLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const DATE_PRESETS: { key: string; label: string }[] = [
  { key: '', label: 'All dates' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisWeek', label: 'Week to date' },
  { key: 'lastWeek', label: 'Last week' },
  { key: 'mtd', label: 'Month to date' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'qtd', label: 'Quarter to date' },
  { key: 'lastQuarter', label: 'Last quarter' },
  { key: 'ytd', label: 'Year to date' },
  { key: 'lastYear', label: 'Last year' },
  { key: 'custom', label: 'Custom…' },
];
function presetRange(key: string): { from: string; to: string } | null {
  const now = new Date();
  const today = fmtLocal(now);
  switch (key) {
    case 'today': return { from: today, to: today };
    case 'yesterday': { const y = new Date(now); y.setDate(now.getDate() - 1); return { from: fmtLocal(y), to: fmtLocal(y) }; }
    case 'thisWeek': { const s = new Date(now); s.setDate(now.getDate() - now.getDay()); return { from: fmtLocal(s), to: today }; }
    case 'lastWeek': { const e = new Date(now); e.setDate(now.getDate() - now.getDay() - 1); const s = new Date(e); s.setDate(e.getDate() - 6); return { from: fmtLocal(s), to: fmtLocal(e) }; }
    case 'mtd': return { from: fmtLocal(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case 'lastMonth': return { from: fmtLocal(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: fmtLocal(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case 'qtd': { const q = Math.floor(now.getMonth() / 3) * 3; return { from: fmtLocal(new Date(now.getFullYear(), q, 1)), to: today }; }
    case 'lastQuarter': { const q = Math.floor(now.getMonth() / 3) * 3; return { from: fmtLocal(new Date(now.getFullYear(), q - 3, 1)), to: fmtLocal(new Date(now.getFullYear(), q, 0)) }; }
    case 'ytd': return { from: `${now.getFullYear()}-01-01`, to: today };
    case 'lastYear': return { from: `${now.getFullYear() - 1}-01-01`, to: `${now.getFullYear() - 1}-12-31` };
    default: return null;
  }
}

type ColId = 'customer' | 'sold_on' | 'primary_business_unit' | 'system_count' | 'equipment_unit_count' | 'sold_est' | 'contract_total' | 'suggested_class' | 'project';
interface ColDef { id: ColId; label: string; num?: boolean; width: number; info?: string }

const DEFAULT_COLUMNS: ColDef[] = [
  { id: 'customer', label: 'Customer', width: 210 },
  { id: 'sold_on', label: 'Sold', width: 110, info: 'Earliest sold-estimate date on the project.' },
  { id: 'primary_business_unit', label: 'Business unit', width: 160 },
  { id: 'system_count', label: 'Systems', num: true, width: 90, info: 'Complete systems only. A system = condenser + furnace + coil, OR heat pump + air handler, OR a packaged unit. Partials (e.g. AC + coil, furnace-only, standalone condenser) count as 0 systems.' },
  { id: 'equipment_unit_count', label: 'Components', num: true, width: 110, info: 'Count of individual equipment pieces — condensers, furnaces, coils, air handlers, heat pumps, packaged units. Excludes accessories like thermostats, heat strips, and UV.' },
  { id: 'sold_est', label: 'Sold est.', num: true, width: 90, info: 'Number of Sold estimates on the project. Click the count to see each estimate, its close date, and value.' },
  { id: 'contract_total', label: 'Contract', num: true, width: 120, info: 'Sum of the subtotals of all Sold estimates on the project.' },
  { id: 'suggested_class', label: 'Suggestion', width: 130, info: 'Auto-hint only: Install if the deal has equipment components or the project already has an HVAC-Install job; otherwise Other. You decide with triage.' },
  { id: 'project', label: 'Project', width: 110, info: 'ServiceTitan project id — opens the project in ServiceTitan.' },
];
const ORDER_KEY = 'install_deals_col_order';
const WIDTH_KEY = 'install_deals_col_widths';

function sortVal(d: Deal, id: ColId): string | number {
  switch (id) {
    case 'customer': return (d.customer_name || '').toLowerCase();
    case 'sold_on': return d.sold_on || '';
    case 'primary_business_unit': return (d.primary_business_unit || '').toLowerCase();
    case 'system_count': return d.system_count ?? -1;
    case 'equipment_unit_count': return d.equipment_unit_count ?? -1;
    case 'sold_est': return d.sold_estimate_count ?? -1;
    case 'contract_total': return d.contract_total ?? -1;
    case 'suggested_class': return d.suggested_class || '';
    case 'project': return d.st_project_id;
  }
}

function useOutsideClose(ref: React.RefObject<HTMLElement>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, ref, onClose]);
}

function CalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export default function DealsTable({ deals, tab }: { deals: Deal[]; tab: TriageStatus }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  // filters
  const [search, setSearch] = useState('');
  const [bus, setBus] = useState<Set<string>>(new Set());
  const [sugg, setSugg] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [minAmt, setMinAmt] = useState('');
  const [maxAmt, setMaxAmt] = useState('');

  const [buOpen, setBuOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const buRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  useOutsideClose(buRef, buOpen, () => setBuOpen(false));
  useOutsideClose(dateRef, dateOpen, () => setDateOpen(false));

  function applyPreset(key: string) {
    setDatePreset(key);
    if (key === 'custom') return;              // keep current from/to
    const r = presetRange(key);
    setFrom(r?.from ?? ''); setTo(r?.to ?? '');
  }
  function toggleBu(b: string) { setBus((p) => { const n = new Set(p); n.has(b) ? n.delete(b) : n.add(b); return n; }); }

  const dateLabel = datePreset && datePreset !== 'custom'
    ? DATE_PRESETS.find((p) => p.key === datePreset)?.label ?? 'All dates'
    : (from || to) ? `${from || '…'} → ${to || '…'}` : 'All dates';

  // Sold-estimate drill-down popup
  type EstRow = { estimate_id: number; estimate_job_number: string | null; name: string | null; subtotal: number | null; systems: number; components: number; sold_on: string | null };
  const [estFor, setEstFor] = useState<{ pid: number; name: string } | null>(null);
  const [estRows, setEstRows] = useState<EstRow[] | null>(null);
  const [estLoading, setEstLoading] = useState(false);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  async function openEst(d: Deal) {
    setEstFor({ pid: d.st_project_id, name: d.customer_name || `Project ${d.st_project_id}` });
    setEstRows(null); setEstLoading(true);
    try {
      const res = await fetch(`/api/deals/estimates?projectId=${d.st_project_id}`);
      const j = await res.json();
      setEstRows(j.estimates || []);
    } catch { setEstRows([]); } finally { setEstLoading(false); }
  }

  // sort + columns
  const [sortCol, setSortCol] = useState<ColId>('sold_on');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [columns, setColumns] = useState<ColDef[]>(DEFAULT_COLUMNS);
  const [dragCol, setDragCol] = useState<ColId | null>(null);
  const [overCol, setOverCol] = useState<ColId | null>(null);
  const resize = useRef<{ id: ColId; startX: number; startW: number } | null>(null);

  useEffect(() => {
    try {
      const order = JSON.parse(localStorage.getItem(ORDER_KEY) || 'null') as ColId[] | null;
      const widths = JSON.parse(localStorage.getItem(WIDTH_KEY) || 'null') as Record<string, number> | null;
      setColumns((cols) => {
        let next = cols;
        if (order && order.length === cols.length) {
          const byId = new Map(cols.map((c) => [c.id, c]));
          const re = order.map((id) => byId.get(id)).filter(Boolean) as ColDef[];
          if (re.length === cols.length) next = re;
        }
        if (widths) next = next.map((c) => (widths[c.id] ? { ...c, width: widths[c.id] } : c));
        return next;
      });
    } catch { /* ignore */ }
  }, []);
  function persist(cols: ColDef[]) {
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(cols.map((c) => c.id)));
      localStorage.setItem(WIDTH_KEY, JSON.stringify(Object.fromEntries(cols.map((c) => [c.id, c.width]))));
    } catch { /* ignore */ }
  }

  const businessUnits = useMemo(
    () => Array.from(new Set(deals.map((d) => d.primary_business_unit).filter(Boolean))).sort() as string[],
    [deals],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const lo = minAmt ? Number(minAmt) : null;
    const hi = maxAmt ? Number(maxAmt) : null;
    let out = deals.filter((d) => {
      if (q && !(`${d.customer_name || ''}`.toLowerCase().includes(q) || String(d.st_project_id).includes(q))) return false;
      if (bus.size && !bus.has(d.primary_business_unit || '')) return false;
      if (sugg && (d.suggested_class || 'other') !== sugg) return false;
      if (from && (d.sold_on || '') < from) return false;
      if (to && (d.sold_on || '') > to) return false;
      if (lo != null && (d.contract_total ?? 0) < lo) return false;
      if (hi != null && (d.contract_total ?? 0) > hi) return false;
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    out = [...out].sort((a, b) => {
      const av = sortVal(a, sortCol), bv = sortVal(b, sortCol);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
    return out;
  }, [deals, search, bus, sugg, from, to, minAmt, maxAmt, sortCol, sortDir]);

  const anyFilter = search || bus.size || sugg || from || to || minAmt || maxAmt;
  function clearFilters() { setSearch(''); setBus(new Set()); setSugg(''); setDatePreset(''); setFrom(''); setTo(''); setMinAmt(''); setMaxAmt(''); }

  function toggle(id: number) { setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleAll() { setSel((p) => (p.size === rows.length ? new Set() : new Set(rows.map((d) => d.st_project_id)))); }
  function toggleSort(id: ColId) { if (id === sortCol) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortCol(id); setSortDir('asc'); } }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const r = resize.current; if (!r) return;
      const w = Math.max(70, r.startW + (e.clientX - r.startX));
      setColumns((cols) => cols.map((c) => (c.id === r.id ? { ...c, width: w } : c)));
    }
    function onUp() { if (resize.current) { resize.current = null; setColumns((cols) => { persist(cols); return cols; }); } }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  function onDrop(target: ColId) {
    if (!dragCol || dragCol === target) { setDragCol(null); setOverCol(null); return; }
    setColumns((cols) => {
      const from = cols.findIndex((c) => c.id === dragCol), to = cols.findIndex((c) => c.id === target);
      const next = [...cols]; const [m] = next.splice(from, 1); next.splice(to, 0, m); persist(next); return next;
    });
    setDragCol(null); setOverCol(null);
  }

  async function triage(projectIds: number[], status: TriageStatus) {
    if (!projectIds.length) return;
    setBusy(true);
    try {
      const res = await fetch('/api/deals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectIds, status }) });
      if (!res.ok) { alert((await res.json().catch(() => ({}))).error || 'Failed'); return; }
      setSel(new Set()); router.refresh();
    } finally { setBusy(false); }
  }
  function applyAllSuggestions() {
    const toInstall = rows.filter((d) => d.suggested_class === 'install').map((d) => d.st_project_id);
    const toArchive = rows.filter((d) => d.suggested_class !== 'install').map((d) => d.st_project_id);
    if (!confirm(`Apply suggestions to the ${rows.length} filtered deal${rows.length === 1 ? '' : 's'}? → ${toInstall.length} Install, ${toArchive.length} Archived.`)) return;
    (async () => {
      setBusy(true);
      try {
        if (toInstall.length) await fetch('/api/deals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectIds: toInstall, status: 'install' }) });
        if (toArchive.length) await fetch('/api/deals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectIds: toArchive, status: 'archived' }) });
        setSel(new Set()); router.refresh();
      } finally { setBusy(false); }
    })();
  }

  function cell(d: Deal, id: ColId) {
    switch (id) {
      case 'customer': return <Link className="joblink" href={`/deals/${d.st_project_id}`}>{d.customer_name || `Project ${d.st_project_id}`}</Link>;
      case 'sold_on': return <span className="muted">{d.sold_on || '—'}</span>;
      case 'primary_business_unit': return <span className="muted">{d.primary_business_unit || '—'}</span>;
      case 'system_count': return d.system_count ?? 0;
      case 'equipment_unit_count': return d.equipment_unit_count ?? 0;
      case 'sold_est': return <button className="est-count" onClick={() => openEst(d)} title="View sold estimates">{d.sold_estimate_count ?? 0}</button>;
      case 'contract_total': return usd(d.contract_total);
      case 'suggested_class':
        return <span className={`badge ${d.suggested_class === 'install' ? 'badge-stage' : 'badge-other'}`} title={d.suggestion_reason || ''}>{d.suggested_class === 'install' ? 'Install' : 'Other'}</span>;
      case 'project': return <a className="joblink" href={stProject(d.st_project_id)} target="_blank" rel="noopener noreferrer">#{d.st_project_id} ↗</a>;
    }
  }

  const selIds = Array.from(sel);

  return (
    <>
      <div className="grid-toolbar">
        <input className="grid-search" placeholder="Search customer or project…" value={search} onChange={(e) => setSearch(e.target.value)} />

        {/* Business unit — multi-select (click-away closes) */}
        <div className="dd" ref={buRef}>
          <button className="dd-btn" onClick={() => setBuOpen((o) => !o)}>
            {bus.size ? `${bus.size} business unit${bus.size > 1 ? 's' : ''}` : 'All business units'}
            <span className="dd-chev">{buOpen ? '▴' : '▾'}</span>
          </button>
          {buOpen && (
            <div className="dd-pop">
              <div className="ms-head">
                <button onClick={() => setBus(new Set(businessUnits))}>Select all</button>
                <button onClick={() => setBus(new Set())}>Clear</button>
              </div>
              {businessUnits.map((b) => (
                <label key={b} className="ms-item">
                  <input type="checkbox" checked={bus.has(b)} onChange={() => toggleBu(b)} /> {b}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Suggestion — quick-filter buttons */}
        <div className="segmented">
          <button className={sugg === '' ? 'on' : ''} onClick={() => setSugg('')}>All</button>
          <button className={sugg === 'install' ? 'on' : ''} onClick={() => setSugg('install')}>Install</button>
          <button className={sugg === 'other' ? 'on' : ''} onClick={() => setSugg('other')}>Other</button>
        </div>

        {/* Sold date — preset popover */}
        <div className="dd" ref={dateRef}>
          <button className="dd-btn" onClick={() => setDateOpen((o) => !o)}>
            <CalIcon /> {dateLabel} <span className="dd-chev">{dateOpen ? '▴' : '▾'}</span>
          </button>
          {dateOpen && (
            <div className="dd-pop dp-pop">
              <div className="dp-grid">
                {DATE_PRESETS.filter((p) => p.key && p.key !== 'custom').map((p) => (
                  <button key={p.key} className={datePreset === p.key ? 'on' : ''}
                    onClick={() => { applyPreset(p.key); setDateOpen(false); }}>{p.label}</button>
                ))}
              </div>
              <div className="dp-custom">
                <div className="dp-clabel">Custom range</div>
                <div className="dp-crow">
                  <label>Start<input type="date" value={from} onChange={(e) => { setDatePreset('custom'); setFrom(e.target.value); }} /></label>
                  <label>End<input type="date" value={to} onChange={(e) => { setDatePreset('custom'); setTo(e.target.value); }} /></label>
                </div>
              </div>
              <div className="dp-foot">
                <button className="dp-clear" onClick={() => { applyPreset(''); setDateOpen(false); }}>All dates</button>
                <button className="dp-apply" onClick={() => setDateOpen(false)}>Apply</button>
              </div>
            </div>
          )}
        </div>

        <input className="grid-mini" type="number" placeholder="Min $" value={minAmt} onChange={(e) => setMinAmt(e.target.value)} />
        <input className="grid-mini" type="number" placeholder="Max $" value={maxAmt} onChange={(e) => setMaxAmt(e.target.value)} />
        {anyFilter ? <button className="mini-btn ghost" onClick={clearFilters}>Clear</button> : null}
        <span className="grid-count">{rows.length} of {deals.length}</span>
      </div>

      <div className="triage-bar">
        {tab === 'untriaged' && (
          <button className="mini-btn" disabled={busy || !rows.length} onClick={applyAllSuggestions}>
            ✨ Apply suggestions to {anyFilter ? 'filtered' : 'all'} ({rows.length})
          </button>
        )}
        {sel.size > 0 && (
          <>
            <span className="triage-selcount">{sel.size} selected</span>
            {tab !== 'install' && <button className="mini-btn" disabled={busy} onClick={() => triage(selIds, 'install')}>→ Install</button>}
            {tab !== 'archived' && <button className="mini-btn ghost" disabled={busy} onClick={() => triage(selIds, 'archived')}>Archive</button>}
            {tab !== 'untriaged' && <button className="mini-btn ghost" disabled={busy} onClick={() => triage(selIds, 'untriaged')}>↩ Triage</button>}
          </>
        )}
      </div>

      <div className="table-card jobs-scroll">
        <table className="ar-table grid-table">
          <colgroup>
            <col style={{ width: 34 }} />
            {columns.map((c) => <col key={c.id} style={{ width: c.width }} />)}
            <col style={{ width: 96 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="chkcol"><input type="checkbox" checked={sel.size === rows.length && rows.length > 0} onChange={toggleAll} /></th>
              {columns.map((c) => (
                <th key={c.id} className={`${c.num ? 'num' : ''}${overCol === c.id ? ' col-over' : ''}`}
                  draggable onDragStart={() => setDragCol(c.id)} onDragOver={(e) => { e.preventDefault(); setOverCol(c.id); }}
                  onDragLeave={() => setOverCol((o) => (o === c.id ? null : o))} onDrop={() => onDrop(c.id)}>
                  <span className="th-inner" onClick={() => toggleSort(c.id)}>
                    {c.label}<span className="sort-arrow">{sortCol === c.id ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                  </span>
                  {c.info && (
                    <span
                      className="th-info"
                      aria-label={c.info}
                      onMouseEnter={(e) => setTip({ text: c.info!, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setTip(null)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); setTip((t) => (t ? null : { text: c.info!, x: e.clientX, y: e.clientY })); }}
                    >i</span>
                  )}
                  <span className="col-resize" onMouseDown={(e) => { e.stopPropagation(); resize.current = { id: c.id, startX: e.clientX, startW: c.width }; }} />
                </th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.st_project_id} className={sel.has(d.st_project_id) ? 'row-sel' : ''}>
                <td className="chkcol"><input type="checkbox" checked={sel.has(d.st_project_id)} onChange={() => toggle(d.st_project_id)} /></td>
                {columns.map((c) => <td key={c.id} className={c.num ? 'num' : ''}>{cell(d, c.id)}</td>)}
                <td className="actioncol">
                  {tab !== 'install' && <button className="icon-btn sm" title="Dispatch to Install" disabled={busy} onClick={() => triage([d.st_project_id], 'install')}>→</button>}
                  {tab !== 'archived' && <button className="icon-btn sm danger" title="Archive" disabled={busy} onClick={() => triage([d.st_project_id], 'archived')}>🗑</button>}
                  {tab !== 'untriaged' && <button className="icon-btn sm" title="Back to triage" disabled={busy} onClick={() => triage([d.st_project_id], 'untriaged')}>↩</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="grid-empty">No matching deals.</p>}
      </div>

      {tip && (
        <div className="th-tip" style={{ left: tip.x, top: tip.y + 16 }}>{tip.text}</div>
      )}

      {estFor && (
        <div className="modal-overlay" onClick={() => setEstFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Sold estimates · {estFor.name}</h3>
              <button className="modal-x" onClick={() => setEstFor(null)} aria-label="Close">✕</button>
            </div>
            {estLoading ? (
              <p className="modal-empty">Loading…</p>
            ) : estRows && estRows.length ? (
              <table className="est-table">
                <thead>
                  <tr>
                    <th className="nowrap">Closed</th>
                    <th className="nowrap">Estimate&nbsp;#</th>
                    <th>Name</th>
                    <th className="num">Systems</th>
                    <th className="num">Components</th>
                    <th className="num">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {estRows.map((e) => (
                    <tr key={e.estimate_id}>
                      <td className="nowrap">{fmtCloseDate(e.sold_on)}</td>
                      <td className="nowrap">
                        {e.estimate_job_number ? (
                          <a className="est-link2" href={`https://go.servicetitan.com/#/Job/Index/${e.estimate_job_number}`} target="_blank" rel="noopener noreferrer">#{e.estimate_id} ↗</a>
                        ) : `#${e.estimate_id}`}
                      </td>
                      <td>{e.name || '—'}</td>
                      <td className="num">{e.systems}</td>
                      <td className="num">{e.components}</td>
                      <td className="num">{usd(e.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>{estRows.length} sold estimate{estRows.length === 1 ? '' : 's'}</td>
                    <td className="num">{estRows.reduce((s, e) => s + (e.systems || 0), 0)}</td>
                    <td className="num">{estRows.reduce((s, e) => s + (e.components || 0), 0)}</td>
                    <td className="num">{usd(estRows.reduce((s, e) => s + (e.subtotal || 0), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p className="modal-empty">No sold estimates found for this project.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
