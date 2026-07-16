'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

export interface JobRow {
  stJobId: number;
  jobNumber: string;
  customer: string;
  type: string;
  total: number | null;
  totalLabel: string;
  currentStage: string;
}

type ColId = 'jobNumber' | 'customer' | 'type' | 'total' | 'currentStage';
interface ColDef { id: ColId; label: string; num?: boolean; width: number; }

const DEFAULT_COLUMNS: ColDef[] = [
  { id: 'jobNumber', label: 'Job', width: 130 },
  { id: 'customer', label: 'Customer', width: 220 },
  { id: 'type', label: 'Type', width: 200 },
  { id: 'total', label: 'Total', num: true, width: 130 },
  { id: 'currentStage', label: 'Current stage', width: 180 },
];

const ORDER_KEY = 'install_jobs_col_order';
const WIDTH_KEY = 'install_jobs_col_widths';

export default function JobsTable({ rows }: { rows: JobRow[] }) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [sortCol, setSortCol] = useState<ColId>('jobNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [columns, setColumns] = useState<ColDef[]>(DEFAULT_COLUMNS);
  const [dragCol, setDragCol] = useState<ColId | null>(null);
  const [overCol, setOverCol] = useState<ColId | null>(null);

  // Column resize
  const resize = useRef<{ id: ColId; startX: number; startW: number } | null>(null);

  // Restore persisted order + widths
  useEffect(() => {
    try {
      const order = JSON.parse(localStorage.getItem(ORDER_KEY) || 'null') as ColId[] | null;
      const widths = JSON.parse(localStorage.getItem(WIDTH_KEY) || 'null') as Record<string, number> | null;
      setColumns((cols) => {
        let next = cols;
        if (order && order.length === cols.length) {
          const byId = new Map(cols.map((c) => [c.id, c]));
          const reordered = order.map((id) => byId.get(id)).filter(Boolean) as ColDef[];
          if (reordered.length === cols.length) next = reordered;
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

  const stages = useMemo(
    () => Array.from(new Set(rows.map((r) => r.currentStage))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows;
    if (q) {
      out = out.filter((r) =>
        [r.jobNumber, r.customer, r.type, r.currentStage].some((v) => v.toLowerCase().includes(q)),
      );
    }
    if (stageFilter) out = out.filter((r) => r.currentStage === stageFilter);
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...out].sort((a, b) => {
      const av = a[sortCol]; const bv = b[sortCol];
      if (sortCol === 'total') return ((av as number | null) ?? -1) > ((bv as number | null) ?? -1) ? dir : ((av as number | null) ?? -1) < ((bv as number | null) ?? -1) ? -dir : 0;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
  }, [rows, search, stageFilter, sortCol, sortDir]);

  function toggleSort(id: ColId) {
    if (id === sortCol) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(id); setSortDir('asc'); }
  }

  // Resize handlers
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const r = resize.current;
      if (!r) return;
      const w = Math.max(70, r.startW + (e.clientX - r.startX));
      setColumns((cols) => cols.map((c) => (c.id === r.id ? { ...c, width: w } : c)));
    }
    function onUp() {
      if (resize.current) { resize.current = null; setColumns((cols) => { persist(cols); return cols; }); }
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  function onDrop(target: ColId) {
    if (!dragCol || dragCol === target) { setDragCol(null); setOverCol(null); return; }
    setColumns((cols) => {
      const from = cols.findIndex((c) => c.id === dragCol);
      const to = cols.findIndex((c) => c.id === target);
      const next = [...cols];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      persist(next);
      return next;
    });
    setDragCol(null); setOverCol(null);
  }

  function cell(row: JobRow, id: ColId) {
    switch (id) {
      case 'jobNumber':
        return <Link className="joblink" href={`/jobs/${row.stJobId}`}>#{row.jobNumber}</Link>;
      case 'total':
        return row.totalLabel;
      case 'currentStage':
        return <span className="badge badge-stage">{row.currentStage}</span>;
      default:
        return row[id] as string;
    }
  }

  return (
    <>
      <div className="grid-toolbar">
        <input
          className="grid-search"
          placeholder="Search jobs, customers, type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="grid-select" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="">All stages</option>
          {stages.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="grid-count">{filtered.length} of {rows.length}</span>
      </div>

      <div className="table-card jobs-scroll">
        <table className="ar-table grid-table">
          <colgroup>
            {columns.map((c) => <col key={c.id} style={{ width: c.width }} />)}
          </colgroup>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.id}
                  className={`${c.num ? 'num' : ''}${overCol === c.id ? ' col-over' : ''}`}
                  draggable
                  onDragStart={() => setDragCol(c.id)}
                  onDragOver={(e) => { e.preventDefault(); setOverCol(c.id); }}
                  onDragLeave={() => setOverCol((o) => (o === c.id ? null : o))}
                  onDrop={() => onDrop(c.id)}
                >
                  <span className="th-inner" onClick={() => toggleSort(c.id)}>
                    {c.label}
                    <span className="sort-arrow">{sortCol === c.id ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                  </span>
                  <span
                    className="col-resize"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      resize.current = { id: c.id, startX: e.clientX, startW: c.width };
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.stJobId}>
                {columns.map((c) => (
                  <td key={c.id} className={c.num ? 'num' : ''}>{cell(row, c.id)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="grid-empty">No matching jobs.</p>}
      </div>
    </>
  );
}
