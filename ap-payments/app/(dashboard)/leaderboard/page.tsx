'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import { formatCurrency } from '@/lib/ap-utils';
import LeaderboardDrillDown, { DrillMetric } from '@/components/LeaderboardDrillDown';

interface Entry {
  st_technician_id: number;
  name: string;
  home_team: string | null;
  jobs_led: number;
  revenue: number;
  hours: number;
  rev_per_hour: number;
  components: number;
  hours_per_component: number;
  recalls: number;
  reviews: number;
  score: number;
  rank: number;
  breakdown: { revenue: number; efficiency: number; recalls: number; reviews: number };
}
type Weights = { revenue: number; efficiency: number; recalls: number; reviews: number };
type SortKey = 'rank' | 'name' | 'jobs_led' | 'revenue' | 'rev_per_hour' | 'components' | 'hours_per_component' | 'recalls' | 'reviews' | 'score';

function monthToDate(): DateRange {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(now) };
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || (name[0] || '?').toUpperCase();
}
function RankBadge({ rank }: { rank: number }) {
  const medal = rank === 1 ? { c: '#ffd700', t: '1st' } : rank === 2 ? { c: '#c0c0c0', t: '2nd' } : rank === 3 ? { c: '#cd7f32', t: '3rd' } : null;
  if (medal) return <span className="font-bold text-base tabular-nums" style={{ color: medal.c }}>{medal.t}</span>;
  return <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{rank}</span>;
}
const recallColor = (n: number) => n === 0 ? '#6fd394' : n >= 2 ? '#f85149' : '#d29922';

export default function LeaderboardPage() {
  const perms = useAPPermissions();
  const [range, setRange] = useState<DateRange>(monthToDate());
  const [payPeriods, setPayPeriods] = useState<{ start: string; end: string }[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [weights, setWeights] = useState<Weights>({ revenue: 0.35, efficiency: 0.25, recalls: 0.20, reviews: 0.20 });
  const [jobCount, setJobCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortAsc, setSortAsc] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [drill, setDrill] = useState<{ id: number; name: string; metric: DrillMetric } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ start: range.start, end: range.end });
      const res = await fetch(`/api/leaderboard?${p.toString()}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `Failed (${res.status})`); }
      const data = await res.json();
      setEntries(data.entries || []);
      setWeights(data.weights || weights);
      setJobCount(data.job_count || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leaderboard');
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  useEffect(() => { if (!perms.isLoading) load(); }, [load, perms.isLoading]);
  useEffect(() => {
    if (perms.isLoading) return;
    fetch('/api/payroll-periods').then(r => r.ok ? r.json() : []).then(setPayPeriods).catch(() => {});
  }, [perms.isLoading]);
  useEffect(() => { setExpanded(null); }, [range.start, range.end]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) { setSortAsc(!sortAsc); }
    else { setSortKey(key); setSortAsc(key === 'rank' || key === 'name' || key === 'recalls' || key === 'hours_per_component'); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q ? entries.filter(e => e.name.toLowerCase().includes(q)) : entries;
    return [...rows].sort((a, b) => {
      const cmp = sortKey === 'name' ? a.name.localeCompare(b.name) : (a[sortKey] as number) - (b[sortKey] as number);
      return sortAsc ? cmp : -cmp;
    });
  }, [entries, search, sortKey, sortAsc]);

  const totalRevenue = entries.reduce((s, e) => s + e.revenue, 0);

  const exportCsv = () => {
    const header = ['Rank', 'Installer', 'Home Team', 'Jobs Led', 'Revenue', 'Rev/Hr', 'Components', 'Hrs/Comp', 'Recalls', 'Reviews', 'Score'];
    const lines = [...entries].sort((a, b) => a.rank - b.rank).map(e =>
      [e.rank, e.name, e.home_team || '', e.jobs_led, e.revenue, e.rev_per_hour, e.components, e.hours_per_component, e.recalls, e.reviews, (e.score * 100).toFixed(1)].join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `installer-leaderboard-${range.start}_${range.end}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!perms.isLoading && !perms.canViewJobs) {
    return <div className="p-8 text-sm" style={{ color: 'var(--text-muted)' }}>You don&apos;t have permission to view the leaderboard.</div>;
  }

  const selectStyle = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' };
  const cardStyle = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' };
  const pct = (n: number) => (n * 100).toFixed(0);

  const Th = ({ k, label, align = 'right', title }: { k?: SortKey; label: string; align?: 'left' | 'right'; title?: string }) => (
    <th onClick={k ? () => handleSort(k) : undefined} title={title}
      className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider select-none"
      style={{ color: 'var(--text-muted)', textAlign: align, whiteSpace: 'nowrap', cursor: k ? 'pointer' : 'default' }}>
      {label}{k && sortKey === k ? (sortAsc ? ' ▲' : ' ▼') : ''}
    </th>
  );

  const cols = [
    { label: 'Sales', w: weights.revenue },
    { label: 'Efficiency', w: weights.efficiency },
    { label: 'Recalls', w: weights.recalls },
    { label: 'Reviews', w: weights.reviews },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-[1150px] mx-auto">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Installer Leaderboard</h1>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(58,143,87,.16)', color: '#6fd394' }}>HVAC Install - Lead</span>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        Technicians with the ServiceTitan role <b>HVAC Install - Lead</b>. Each install job is credited to its lead on the crew; leads are ranked in every metric, ranks become percentiles, and a weighted average is the score.
      </p>

      <div className="flex items-center flex-wrap gap-2 mb-1">
        <DateRangePicker value={range} onChange={r => setRange(r)} defaultPreset="mtd" payPeriods={payPeriods} />
        <input type="text" placeholder="Search installer…" value={search} onChange={e => setSearch(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm" style={{ ...selectStyle, minWidth: 200 }} />
        <button onClick={() => setShowInfo(v => !v)} className="text-xs px-3 py-2 rounded-lg" style={selectStyle} title="How scoring works">How scoring works</button>
        <button onClick={exportCsv} className="text-xs underline ml-auto" style={{ color: 'var(--text-muted)' }}>Export CSV</button>
      </div>
      <div className="text-[11px] mb-4" style={{ color: 'var(--text-muted)' }}>
        Date control matches the Install Jobs tab — pick a preset or a ServiceTitan Pay Period.
      </div>

      {showInfo && (
        <div className="rounded-xl p-4 mb-4 text-sm" style={cardStyle}>
          <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>How scoring works</p>
          <p style={{ color: 'var(--text-secondary)' }}>Each installer is ranked in every category, converted to a percentile (1st of 10 = 100, 5th = 60, 10th = 10), then combined as a weighted average:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            {cols.map(c => (
              <div key={c.label} className="rounded-lg p-2" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{c.label}</div>
                <div className="text-lg font-bold tabular-nums" style={{ color: 'var(--christmas-green)' }}>{pct(c.w)}%</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>Recalls are ranked in reverse — fewer is better. Click a row to see the breakdown.</p>
        </div>
      )}

      {error && <div className="rounded-lg p-3 mb-4 text-sm" style={{ backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', color: '#f85149' }}>{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Top Installer</div>
          <div className="text-xl font-bold mt-1" style={{ color: '#ffd700' }}>{entries.find(e => e.rank === 1)?.name || '—'}</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>this period</div>
        </div>
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Lead Installers</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{entries.length}</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{jobCount} jobs</div>
        </div>
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Revenue Installed</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalRevenue)}</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>completed in range</div>
        </div>
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Recalls</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{entries.reduce((s, e) => s + e.recalls, 0)}</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>caused by these installs</div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg p-8 text-center text-sm" style={{ ...cardStyle, color: 'var(--text-muted)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg p-8 text-center text-sm" style={{ ...cardStyle, color: 'var(--text-muted)' }}>No installer data for this range. Try a different period or run a sync.</div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <Th k="rank" label="Rank" align="left" />
                <Th k="name" label="Installer" align="left" />
                <Th k="jobs_led" label="Jobs" />
                <Th k="revenue" label="Revenue" />
                <Th k="rev_per_hour" label="Rev/Hr" title="Revenue installed per total crew hour" />
                <Th k="components" label="Components" title="Components installed (condenser, coil, air handler, furnace)" />
                <Th k="hours_per_component" label="Hrs/Comp" title="Crew hours per component installed (lower is faster)" />
                <Th k="recalls" label="Recalls" title="Recalls caused (lower is better)" />
                <Th k="reviews" label="Reviews" title="Google review mentions" />
                <Th k="score" label="Score" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const open = expanded === e.st_technician_id;
                return (
                  <Fragment key={e.st_technician_id}>
                    <tr onClick={() => setExpanded(open ? null : e.st_technician_id)} className="cursor-pointer hover:bg-white/5"
                      style={{ borderTop: '1px solid var(--border-subtle)', background: e.rank <= 3 ? `rgba(${e.rank === 1 ? '255,215,0' : e.rank === 2 ? '192,192,192' : '205,127,50'},0.05)` : undefined }}>
                      <td className="px-3 py-2.5"><RankBadge rank={e.rank} /></td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>
                        <span className="inline-flex items-center gap-2.5">
                          <span style={{ color: 'var(--text-muted)', fontSize: 10, width: 10, display: 'inline-block' }}>{open ? '▾' : '▸'}</span>
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: 'rgba(58,143,87,.25)', color: '#6fd394' }}>{initials(e.name)}</span>
                          <span>{e.name}{e.home_team ? <span className="ml-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>{e.home_team}</span> : null}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        <button onClick={ev => { ev.stopPropagation(); setDrill({ id: e.st_technician_id, name: e.name, metric: 'revenue' }); }} className="hover:underline" title="View jobs">{e.jobs_led}</button></td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        <button onClick={ev => { ev.stopPropagation(); setDrill({ id: e.st_technician_id, name: e.name, metric: 'revenue' }); }} className="hover:underline" title="View jobs">{formatCurrency(e.revenue)}</button></td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {e.rev_per_hour > 0 ? <button onClick={ev => { ev.stopPropagation(); setDrill({ id: e.st_technician_id, name: e.name, metric: 'efficiency' }); }} className="hover:underline" title="View jobs + hours">{formatCurrency(e.rev_per_hour)}/h</button> : '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {e.components > 0 ? <button onClick={ev => { ev.stopPropagation(); setDrill({ id: e.st_technician_id, name: e.name, metric: 'efficiency' }); }} className="hover:underline" title="View jobs + components">{e.components}</button> : '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {e.hours_per_component > 0 ? <button onClick={ev => { ev.stopPropagation(); setDrill({ id: e.st_technician_id, name: e.name, metric: 'efficiency' }); }} className="hover:underline" title="View jobs + hours per component">{e.hours_per_component.toFixed(1)} h</button> : '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums font-semibold" style={{ color: recallColor(e.recalls) }}>
                        <button onClick={ev => { ev.stopPropagation(); setDrill({ id: e.st_technician_id, name: e.name, metric: 'recalls' }); }} className="hover:underline" title="View recalls">{e.recalls}</button></td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums" style={{ color: e.reviews > 0 ? '#6fd394' : 'var(--text-muted)' }}>
                        <button onClick={ev => { ev.stopPropagation(); setDrill({ id: e.st_technician_id, name: e.name, metric: 'reviews' }); }} className="hover:underline" title="View reviews">{e.reviews}</button></td>
                      <td className="px-3 py-2.5 text-right"><span className="font-bold text-lg tabular-nums" style={{ color: 'var(--christmas-green)' }}>{(e.score * 100).toFixed(1)}</span></td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={8} className="px-3 pb-3 pt-0" style={{ backgroundColor: 'rgba(58,143,87,.04)' }}>
                          <div className="text-sm py-2" style={{ color: 'var(--text-secondary)' }}>
                            <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Score breakdown</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              {([['Sales', e.breakdown.revenue, weights.revenue], ['Efficiency', e.breakdown.efficiency, weights.efficiency], ['Recalls', e.breakdown.recalls, weights.recalls], ['Reviews', e.breakdown.reviews, weights.reviews]] as [string, number, number][]).map(([label, p, w]) => (
                                <div key={label}>
                                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
                                  <div className="flex items-baseline gap-1">
                                    <span className="font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>{(p * 100).toFixed(0)}</span>
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>× {pct(w)}%</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
        Lead = the <b>HVAC Install - Lead</b> (ServiceTitan role) on the job&apos;s crew; jobs without one aren&apos;t credited here. <b>Rev/Hr</b> = revenue installed ÷ total crew hours. <b>Recalls</b> from the service dashboard&apos;s recall data. <b>Reviews</b> = Google review mentions by name. Click any number to drill into the jobs behind it. Weights are fixed for now.
      </div>

      {drill && (
        <LeaderboardDrillDown techName={drill.name} stTechId={drill.id} metric={drill.metric}
          start={range.start} end={range.end} onClose={() => setDrill(null)} />
      )}
    </div>
  );
}
