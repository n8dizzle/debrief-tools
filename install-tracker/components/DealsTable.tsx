'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Deal, TriageStatus } from '@/lib/deals';

const usd = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const stProject = (id: number) => `https://go.servicetitan.com/#/Project/${id}`;

type ColId = 'customer' | 'sold_on' | 'primary_business_unit' | 'equipment_unit_count' | 'contract_total' | 'suggested_class' | 'project';
interface ColDef { id: ColId; label: string; num?: boolean; width: number; }

const DEFAULT_COLUMNS: ColDef[] = [
  { id: 'customer', label: 'Customer', width: 210 },
  { id: 'sold_on', label: 'Sold', width: 110 },
  { id: 'primary_business_unit', label: 'Business unit', width: 160 },
  { id: 'equipment_unit_count', label: 'Systems', num: true, width: 90 },
  { id: 'contract_total', label: 'Contract', num: true, width: 120 },
  { id: 'suggested_class', label: 'Suggestion', width: 130 },
  { id: 'project', label: 'Project', width: 110 },
];
const ORDER_KEY = 'install_deals_col_order';
const WIDTH_KEY = 'install_deals_col_widths';

function sortVal(d: Deal, id: ColId): string | number {
  switch (id) {
    case 'customer': return (d.customer_name || '').toLowerCase();
    case 'sold_on': return d.sold_on || '';
    case 'primary_business_unit': return (d.primary_business_unit || '').toLowerCase();
    case 'equipment_unit_count': return d.equipment_unit_count ?? -1;
    case 'contract_total': return d.contract_total ?? -1;
    case 'suggested_class': return d.suggested_class || '';
    case 'project': return d.st_project_id;
  }
}

export default function DealsTable({ deals, tab }: { deals: Deal[]; tab: TriageStatus }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  // filters
  const [search, setSearch] = useState('');
  const [bu, setBu] = useState('');
  const [sugg, setSugg] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [minAmt, setMinAmt] = useState('');
  const [maxAmt, setMaxAmt] = useState('');

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
      if (bu && d.primary_business_unit !== bu) return false;
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
  }, [deals, search, bu, sugg, from, to, minAmt, maxAmt, sortCol, sortDir]);

  const anyFilter = search || bu || sugg || from || to || minAmt || maxAmt;
  function clearFilters() { setSearch(''); setBu(''); setSugg(''); setFrom(''); setTo(''); setMinAmt(''); setMaxAmt(''); }

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
      case 'equipment_unit_count': return d.equipment_unit_count ?? 0;
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
        <select className="grid-mini" value={bu} onChange={(e) => setBu(e.target.value)}>
          <option value="">All business units</option>
          {businessUnits.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className="grid-mini" value={sugg} onChange={(e) => setSugg(e.target.value)}>
          <option value="">Any suggestion</option>
          <option value="install">Install</option>
          <option value="other">Other</option>
        </select>
        <input className="grid-mini" type="date" title="Sold on or after" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="grid-mini" type="date" title="Sold on or before" value={to} onChange={(e) => setTo(e.target.value)} />
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
    </>
  );
}
