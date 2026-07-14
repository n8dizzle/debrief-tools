'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import { formatDate } from '@/lib/ap-utils';

interface KV { key: string; count: number; }
interface CohortRow { month: string; installs: number; went_back: number; rate: number | null; }
interface Pair {
  warranty_job: number | null; warranty_type: string | null; warranty_date: string | null; customer: string | null; trade: string;
  install_job: number | null; install_date: string | null; days: number | null;
  lead: string | null; contractor: string | null; equipment: string | null; root_cause: string | null;
}
interface Data {
  summary: { total: number; linked: number; unlinked: number; link_pct: number; avg_days_to_warranty: number | null; hvac: number; plumbing: number; total_installs: number; go_back_installs: number; go_back_rate: number | null };
  trend: KV[]; ttw: KV[]; cohort: CohortRow[]; by_lead: KV[]; by_contractor: KV[]; by_equipment: KV[]; by_root_cause: KV[]; pairs: Pair[];
}

function yearToDate(): DateRange {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: `${now.getFullYear()}-01-01`, end: fmt(now) };
}
const JOB = (id: number | null) => id ? `https://go.servicetitan.com/#/Job/Index/${id}` : '#';

type PairKey = 'warranty_job' | 'warranty_type' | 'warranty_date' | 'customer' | 'install_job' | 'install_date' | 'days' | 'lead' | 'equipment' | 'root_cause';
type SortDir = 'asc' | 'desc';
const PAIR_COLUMNS: { key: PairKey; label: string; align: 'left' | 'right'; width: number; numeric?: boolean }[] = [
  { key: 'warranty_job', label: 'Warranty Job', align: 'left', width: 110, numeric: true },
  { key: 'warranty_type', label: 'Type', align: 'left', width: 150 },
  { key: 'warranty_date', label: 'Warranty Date', align: 'left', width: 120 },
  { key: 'customer', label: 'Customer', align: 'left', width: 180 },
  { key: 'install_job', label: 'Install Job', align: 'left', width: 110, numeric: true },
  { key: 'install_date', label: 'Installed', align: 'left', width: 110 },
  { key: 'days', label: 'Days', align: 'right', width: 80, numeric: true },
  { key: 'lead', label: 'Lead', align: 'left', width: 140 },
  { key: 'equipment', label: 'Equipment', align: 'left', width: 160 },
  { key: 'root_cause', label: 'Root Cause', align: 'left', width: 160 },
];

function Bars({ rows, color = '#d29922', money = false }: { rows: KV[]; color?: string; money?: boolean }) {
  const max = Math.max(1, ...rows.map(r => r.count));
  if (rows.length === 0) return <div className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>No data.</div>;
  return (
    <div className="space-y-1.5">
      {rows.map(r => (
        <div key={r.key} className="flex items-center gap-2">
          <span className="text-xs truncate" style={{ width: 150, color: 'var(--text-secondary)' }} title={r.key}>{r.key}</span>
          <div className="flex-1 h-4 rounded overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
            <div className="h-full rounded" style={{ width: `${(r.count / max) * 100}%`, background: color }} />
          </div>
          <span className="text-xs tabular-nums text-right" style={{ width: 36, color: 'var(--text-primary)' }}>{r.count}</span>
        </div>
      ))}
    </div>
  );
}

export default function WarrantiesPage() {
  const perms = useAPPermissions();
  const [range, setRange] = useState<DateRange>(yearToDate());
  const [trade, setTrade] = useState('');
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail table: search, quick filter, sort, resizable columns.
  const [search, setSearch] = useState('');
  const [linkFilter, setLinkFilter] = useState<'' | 'linked' | 'unlinked'>('');
  const [sortKey, setSortKey] = useState<PairKey>('warranty_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [colWidths, setColWidths] = useState<Record<string, number>>(
    () => Object.fromEntries(PAIR_COLUMNS.map(c => [c.key, c.width]))
  );
  const resizing = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const startResize = useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    resizing.current = { key, startX: e.clientX, startW: colWidths[key] };
    const onMove = (ev: MouseEvent) => {
      const r = resizing.current; if (!r) return;
      setColWidths(prev => ({ ...prev, [r.key]: Math.max(60, r.startW + (ev.clientX - r.startX)) }));
    };
    const onUp = () => { resizing.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  }, [colWidths]);

  const toggleSort = useCallback((key: PairKey) => {
    setSortKey(prev => {
      if (prev === key) { setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); return prev; }
      setSortDir(key === 'days' || key === 'warranty_date' || key === 'install_date' ? 'desc' : 'asc');
      return key;
    });
  }, []);

  const visiblePairs = useMemo(() => {
    const rows = data?.pairs ?? [];
    const q = search.trim().toLowerCase();
    const filtered = rows.filter(p => {
      if (linkFilter === 'linked' && !p.install_job) return false;
      if (linkFilter === 'unlinked' && p.install_job) return false;
      if (!q) return true;
      return [p.warranty_job, p.warranty_type, p.warranty_date, p.customer, p.install_job, p.install_date, p.lead, p.contractor, p.equipment, p.root_cause]
        .some(v => v != null && String(v).toLowerCase().includes(q));
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    const col = PAIR_COLUMNS.find(c => c.key === sortKey);
    return [...filtered].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;   // nulls always last
      if (bv == null) return -1;
      return (col?.numeric ? Number(av) - Number(bv) : String(av).localeCompare(String(bv))) * dir;
    });
  }, [data, search, linkFilter, sortKey, sortDir]);

  const renderCell = (key: PairKey, p: Pair) => {
    switch (key) {
      case 'warranty_job':
        return p.warranty_job
          ? <a href={JOB(p.warranty_job)} target="_blank" rel="noopener noreferrer" className="font-mono font-semibold hover:underline" style={{ color: 'var(--christmas-green)' }}>{p.warranty_job}</a>
          : '—';
      case 'warranty_type':
        return <span style={{ color: 'var(--text-secondary)' }}>{(p.warranty_type || '').replace(/^(H|P)\s*-\s*/, '') || '—'}</span>;
      case 'warranty_date':
        return <span style={{ color: 'var(--text-secondary)' }}>{p.warranty_date ? formatDate(p.warranty_date) : '—'}</span>;
      case 'customer':
        return <span style={{ color: 'var(--text-primary)' }} title={p.customer || ''}>{p.customer || '—'}</span>;
      case 'install_job':
        return p.install_job
          ? <a href={JOB(p.install_job)} target="_blank" rel="noopener noreferrer" className="font-mono font-semibold hover:underline" style={{ color: 'var(--christmas-green)' }}>{p.install_job}</a>
          : <span style={{ color: '#d29922' }}>unlinked</span>;
      case 'install_date':
        return <span style={{ color: 'var(--text-secondary)' }}>{p.install_date ? formatDate(p.install_date) : '—'}</span>;
      case 'days':
        return <span style={{ color: 'var(--text-secondary)' }}>{p.days != null ? p.days : '—'}</span>;
      case 'lead':
        return <span style={{ color: 'var(--text-secondary)' }} title={p.lead || ''}>{p.lead || '—'}</span>;
      case 'equipment':
        return <span style={{ color: 'var(--text-secondary)' }} title={p.equipment || ''}>{p.equipment || '—'}</span>;
      case 'root_cause':
        return <span style={{ color: 'var(--text-secondary)' }} title={p.root_cause || ''}>{p.root_cause || '—'}</span>;
      default:
        return '—';
    }
  };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ start: range.start, end: range.end });
      if (trade) p.set('trade', trade);
      const res = await fetch(`/api/warranties?${p.toString()}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `Failed (${res.status})`); }
      setData(await res.json());
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, [range, trade]);

  useEffect(() => { if (!perms.isLoading) load(); }, [load, perms.isLoading]);

  if (!perms.isLoading && !perms.canViewJobs) {
    return <div className="p-8 text-sm" style={{ color: 'var(--text-muted)' }}>You don&apos;t have permission to view warranties.</div>;
  }

  const card = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' };
  const s = data?.summary;
  const trendMax = Math.max(1, ...(data?.trend || []).map(t => t.count));

  const Panel = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
    <div className="rounded-xl p-4" style={card}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      {sub && <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </div>
  );

  return (
    <div className="p-4 lg:p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Warranties</h1>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(210,153,34,.16)', color: '#d29922' }}>Warranty &amp; recall visits</span>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        Every warranty/recall visit linked back to the install that caused it (same location, most-recent prior install) — so you can see warranties by install vintage, install lead, contractor, and equipment. Filtered by the warranty visit date.
      </p>

      <div className="flex items-center flex-wrap gap-2 mb-4">
        <DateRangePicker value={range} onChange={setRange} defaultPreset="ytd" />
        <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          {([['', 'All'], ['hvac', 'HVAC'], ['plumbing', 'Plumbing']] as [string, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setTrade(v)} className="px-3 py-1 rounded text-sm"
              style={{ backgroundColor: trade === v ? 'var(--christmas-green)' : 'transparent', color: trade === v ? 'var(--on-accent)' : 'var(--text-secondary)' }}>{l}</button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-lg p-3 mb-4 text-sm" style={{ backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', color: '#f85149' }}>{error}</div>}

      {loading || !data ? (
        <div className="rounded-lg p-8 text-center text-sm" style={{ ...card, color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl p-4" style={card}>
              <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Warranty Visits</div>
              <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{s!.total}</div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{s!.hvac} HVAC · {s!.plumbing} Plumbing</div>
            </div>
            <div className="rounded-xl p-4" style={card}>
              <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Linked to an Install</div>
              <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{s!.link_pct}%</div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{s!.linked} of {s!.total} traced back</div>
            </div>
            <div className="rounded-xl p-4" style={card}>
              <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Go-Back Rate</div>
              <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: s!.go_back_rate != null && s!.go_back_rate >= 15 ? '#f85149' : s!.go_back_rate != null && s!.go_back_rate >= 8 ? '#d29922' : '#6fd394' }}>{s!.go_back_rate != null ? `${s!.go_back_rate}%` : '—'}</div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{s!.go_back_installs} of {s!.total_installs} installs revisited</div>
            </div>
            <div className="rounded-xl p-4" style={card}>
              <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Avg Days to Warranty</div>
              <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{s!.avg_days_to_warranty ?? '—'}</div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>after install</div>
            </div>
          </div>

          {/* Trend */}
          <Panel title="Warranty visits by month" sub="When the warranty visit happened.">
            <div className="flex items-end gap-2 h-40">
              {data.trend.map(t => (
                <div key={t.key} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{t.count}</span>
                  <div className="w-full rounded-t" style={{ height: `${(t.count / trendMax) * 100}%`, minHeight: 2, background: '#d29922' }} />
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{t.key.slice(2)}</span>
                </div>
              ))}
            </div>
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Time to warranty" sub="Days from install to the warranty visit (linked jobs).">
              <Bars rows={data.ttw} color="#5aa9e6" />
            </Panel>
            <Panel title="Root cause" sub="From service-dashboard investigations (grows as recalls are investigated).">
              <Bars rows={data.by_root_cause} color="#a371f7" />
            </Panel>
          </div>

          {/* Cohort rate */}
          <Panel title="Go-back rate by install cohort" sub="Of the installs completed each month, the % we've had to return to at least once. All installs on record, ignores the date filter above. Recent months read low until warranties have had time to surface.">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr style={{ color: 'var(--text-muted)' }}>
                  <th className="text-left py-1.5 text-[11px] uppercase tracking-wider">Install Month</th>
                  <th className="text-right py-1.5 text-[11px] uppercase tracking-wider">Installs</th>
                  <th className="text-right py-1.5 text-[11px] uppercase tracking-wider">Went Back</th>
                  <th className="text-right py-1.5 text-[11px] uppercase tracking-wider">Rate</th>
                </tr></thead>
                <tbody>
                  {data.cohort.map(c => (
                    <tr key={c.month} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="py-1.5" style={{ color: 'var(--text-primary)' }}>{c.month}</td>
                      <td className="py-1.5 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{c.installs}</td>
                      <td className="py-1.5 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{c.went_back}</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold" style={{ color: c.rate != null && c.rate >= 15 ? '#f85149' : c.rate != null && c.rate >= 8 ? '#d29922' : 'var(--text-primary)' }}>{c.rate != null ? `${c.rate}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel title="By install lead" sub="Warranties by the originating install's lead (sparse — crew data).">
              <Bars rows={data.by_lead} color="#6fd394" />
            </Panel>
            <Panel title="By equipment" sub="Installed unit at the location (make · type).">
              <Bars rows={data.by_equipment} color="#5aa9e6" />
            </Panel>
            <Panel title="By contractor" sub="For contractor-installed jobs only.">
              <Bars rows={data.by_contractor} color="#d29922" />
            </Panel>
          </div>

          {/* Drill: warranty → install pairs — searchable, sortable, resizable */}
          <Panel title="Warranty → install detail">
            <div className="flex items-center flex-wrap gap-2 mb-3">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customer, job #, lead, equipment, cause…"
                className="text-sm rounded-lg px-3 py-1.5 w-full sm:w-80 outline-none"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              />
              <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                {([['', 'All'], ['linked', 'Linked'], ['unlinked', 'Unlinked']] as [typeof linkFilter, string][]).map(([v, l]) => (
                  <button key={v} onClick={() => setLinkFilter(v)} className="px-3 py-1 rounded text-sm"
                    style={{ backgroundColor: linkFilter === v ? 'var(--christmas-green)' : 'transparent', color: linkFilter === v ? 'var(--on-accent)' : 'var(--text-secondary)' }}>{l}</button>
                ))}
              </div>
              <span className="text-xs ml-auto tabular-nums" style={{ color: 'var(--text-muted)' }}>{visiblePairs.length} of {data.pairs.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="text-sm" style={{ tableLayout: 'fixed', width: PAIR_COLUMNS.reduce((sum, c) => sum + colWidths[c.key], 0) }}>
                <colgroup>
                  {PAIR_COLUMNS.map(c => <col key={c.key} style={{ width: colWidths[c.key] }} />)}
                </colgroup>
                <thead>
                  <tr style={{ color: 'var(--text-muted)' }}>
                    {PAIR_COLUMNS.map(c => (
                      <th key={c.key}
                        onClick={() => toggleSort(c.key)}
                        title="Click to sort · drag right edge to resize"
                        className={`relative py-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                        style={{ color: sortKey === c.key ? 'var(--text-secondary)' : undefined }}>
                        <span className="hover:underline">{c.label}{sortKey === c.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                        <span
                          onClick={e => e.stopPropagation()}
                          onMouseDown={e => startResize(c.key, e)}
                          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize"
                          style={{ transform: 'translateX(50%)' }}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiblePairs.slice(0, 500).map((p, i) => (
                    <tr key={i} className="transition-colors hover:bg-[var(--bg-card-hover)]" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      {PAIR_COLUMNS.map(c => (
                        <td key={c.key} className={`py-1.5 px-2 text-xs overflow-hidden text-ellipsis whitespace-nowrap ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                          {renderCell(c.key, p)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {visiblePairs.length === 0 && <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>No warranties match.</div>}
              {visiblePairs.length > 500 && <div className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>Showing first 500 of {visiblePairs.length} matches.</div>}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
