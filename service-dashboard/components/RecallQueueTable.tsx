'use client';

import { useMemo, useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';

export interface RecallRow {
  st_recall_job_id: number;
  st_original_job_id: number;
  tech_name: string;
  recall_created_on: string;
  days_to_recall: number | null;
  trade: string | null;
  customer_name: string | null;
  has_equipment: boolean;
  investigation_status: string;
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  none: { bg: 'var(--bg-secondary)', fg: 'var(--text-muted)', label: 'Not started' },
  open: { bg: 'rgba(59,130,246,0.15)', fg: 'var(--status-info)', label: 'Open' },
  investigating: { bg: 'rgba(234,179,8,0.15)', fg: 'var(--status-warning)', label: 'Investigating' },
  resolved: { bg: 'rgba(34,197,94,0.15)', fg: 'var(--status-success)', label: 'Resolved' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.none;
  return <span style={{ backgroundColor: s.bg, color: s.fg, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{s.label}</span>;
}

type ColKey = 'date' | 'job' | 'customer' | 'tech' | 'days' | 'equipment' | 'status';

interface Column {
  key: ColKey;
  label: string;
  align?: 'right';
  sortValue: (r: RecallRow) => string | number;
  render: (r: RecallRow) => ReactNode;
}

const COLUMNS: Record<ColKey, Column> = {
  date: {
    key: 'date', label: 'Date',
    sortValue: r => r.recall_created_on,
    render: r => <span style={{ whiteSpace: 'nowrap' }}>{r.recall_created_on}</span>,
  },
  job: {
    key: 'job', label: 'Job #',
    sortValue: r => r.st_recall_job_id,
    render: r => (
      <a href={`https://go.servicetitan.com/Job/Index/${r.st_recall_job_id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--christmas-green-light)', whiteSpace: 'nowrap' }}>#{r.st_recall_job_id} ↗</a>
    ),
  },
  customer: {
    key: 'customer', label: 'Customer',
    sortValue: r => (r.customer_name || '').toLowerCase(),
    render: r => r.customer_name || '—',
  },
  tech: {
    key: 'tech', label: 'Original tech',
    sortValue: r => (r.tech_name || '').toLowerCase(),
    render: r => r.tech_name,
  },
  days: {
    key: 'days', label: 'Days to recall', align: 'right',
    sortValue: r => r.days_to_recall ?? Number.MAX_SAFE_INTEGER,
    render: r => r.days_to_recall ?? '—',
  },
  equipment: {
    key: 'equipment', label: 'Equipment',
    sortValue: r => (r.has_equipment ? 1 : 0),
    render: r => <span style={{ color: r.has_equipment ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{r.has_equipment ? 'on file' : '—'}</span>,
  },
  status: {
    key: 'status', label: 'Status',
    sortValue: r => STATUS_STYLE[r.investigation_status]?.label || r.investigation_status,
    render: r => <StatusBadge status={r.investigation_status} />,
  },
};

const DEFAULT_ORDER: ColKey[] = ['date', 'job', 'customer', 'tech', 'days', 'equipment', 'status'];
const ORDER_KEY = 'recall-queue-col-order';

function loadOrder(): ColKey[] {
  if (typeof window === 'undefined') return DEFAULT_ORDER;
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (!raw) return DEFAULT_ORDER;
    const saved = JSON.parse(raw) as ColKey[];
    // Keep only valid keys, then append any new columns that didn't exist when saved.
    const valid = saved.filter(k => DEFAULT_ORDER.includes(k));
    const missing = DEFAULT_ORDER.filter(k => !valid.includes(k));
    return [...valid, ...missing];
  } catch { return DEFAULT_ORDER; }
}

export default function RecallQueueTable({ rows }: { rows: RecallRow[] }) {
  const [order, setOrder] = useState<ColKey[]>(DEFAULT_ORDER);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<ColKey>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [dragKey, setDragKey] = useState<ColKey | null>(null);

  useEffect(() => { setOrder(loadOrder()); }, []);

  const persist = (next: ColKey[]) => {
    setOrder(next);
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const toggleSort = (key: ColKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(key !== 'date'); } // dates default newest-first
  };

  const onDrop = (target: ColKey) => {
    if (!dragKey || dragKey === target) { setDragKey(null); return; }
    const next = order.filter(k => k !== dragKey);
    const idx = next.indexOf(target);
    next.splice(idx, 0, dragKey);
    persist(next);
    setDragKey(null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      String(r.st_recall_job_id).includes(q) ||
      String(r.st_original_job_id).includes(q) ||
      (r.customer_name || '').toLowerCase().includes(q) ||
      (r.tech_name || '').toLowerCase().includes(q) ||
      (STATUS_STYLE[r.investigation_status]?.label || '').toLowerCase().includes(q)
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const col = COLUMNS[sortKey];
    return [...filtered].sort((a, b) => {
      const av = col.sortValue(a), bv = col.sortValue(b);
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortAsc]);

  return (
    <div>
      <div style={{ padding: '12px 12px 0' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Quick filter — customer, tech, job #, status…"
          style={{ width: '100%', maxWidth: 360, padding: '7px 12px', borderRadius: 8, fontSize: 13, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
        />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', textAlign: 'left', fontSize: 12, backgroundColor: 'var(--bg-secondary)' }}>
              {order.map(key => {
                const col = COLUMNS[key];
                const active = sortKey === key;
                return (
                  <th
                    key={key}
                    draggable
                    onDragStart={() => setDragKey(key)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => onDrop(key)}
                    onClick={() => toggleSort(key)}
                    title="Click to sort · drag to reorder"
                    style={{
                      padding: '10px 12px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                      textAlign: col.align === 'right' ? 'right' : 'left',
                      color: active ? 'var(--text-secondary)' : 'var(--text-muted)',
                      opacity: dragKey === key ? 0.4 : 1,
                    }}
                  >
                    {col.label}
                    <span style={{ marginLeft: 4, fontSize: 10 }}>{active ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                  </th>
                );
              })}
              <th style={{ padding: '10px 12px' }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => (
              <tr key={r.st_recall_job_id} style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                {order.map(key => (
                  <td key={key} style={{ padding: '10px 12px', textAlign: COLUMNS[key].align === 'right' ? 'right' : 'left' }}>
                    {COLUMNS[key].render(r)}
                  </td>
                ))}
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <Link href={`/recalls/${r.st_recall_job_id}`} style={{ color: 'var(--christmas-green-light)', fontWeight: 600 }}>Investigate →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.trim() && (
        <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
          {sorted.length} of {rows.length} shown
        </div>
      )}
    </div>
  );
}
