'use client';

import { useState, useEffect, useCallback } from 'react';
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
              style={{ backgroundColor: trade === v ? 'var(--christmas-green)' : 'transparent', color: trade === v ? 'var(--christmas-cream)' : 'var(--text-secondary)' }}>{l}</button>
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

          {/* Drill: warranty ↔ install pairs */}
          <Panel title={`Warranty → install detail (${data.pairs.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr style={{ color: 'var(--text-muted)' }}>
                  {['Warranty Job', 'Type', 'Warranty Date', 'Customer', 'Install Job', 'Installed', 'Days', 'Lead', 'Equipment', 'Root Cause'].map(h => (
                    <th key={h} className="text-left py-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {data.pairs.slice(0, 300).map((p, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="py-1.5 px-2">{p.warranty_job ? <a href={JOB(p.warranty_job)} target="_blank" rel="noopener noreferrer" className="font-mono font-semibold hover:underline" style={{ color: 'var(--christmas-green)' }}>{p.warranty_job}</a> : '—'}</td>
                      <td className="py-1.5 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{(p.warranty_type || '').replace(/^(H|P)\s*-\s*/, '')}</td>
                      <td className="py-1.5 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{p.warranty_date ? formatDate(p.warranty_date) : '—'}</td>
                      <td className="py-1.5 px-2 text-xs" style={{ color: 'var(--text-primary)' }}>{p.customer || '—'}</td>
                      <td className="py-1.5 px-2">{p.install_job ? <a href={JOB(p.install_job)} target="_blank" rel="noopener noreferrer" className="font-mono font-semibold hover:underline" style={{ color: 'var(--christmas-green)' }}>{p.install_job}</a> : <span style={{ color: '#d29922' }}>unlinked</span>}</td>
                      <td className="py-1.5 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{p.install_date ? formatDate(p.install_date) : '—'}</td>
                      <td className="py-1.5 px-2 text-xs text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{p.days != null ? p.days : '—'}</td>
                      <td className="py-1.5 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{p.lead || '—'}</td>
                      <td className="py-1.5 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{p.equipment || '—'}</td>
                      <td className="py-1.5 px-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{p.root_cause || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.pairs.length > 300 && <div className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>Showing first 300 of {data.pairs.length}.</div>}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
