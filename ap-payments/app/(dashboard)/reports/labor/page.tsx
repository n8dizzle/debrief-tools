'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import { formatCurrency, formatDate } from '@/lib/ap-utils';

interface TechRow {
  technician_id: string;
  name: string;
  home_team: string | null;
  is_install: boolean;
  jobs: number;
  hours: number;
  pay_set: number;
}
type TeamFilter = 'all' | 'install' | 'other';
interface JobRow {
  job_id: string; st_job_id: number | null; job_number: string; customer_name: string | null;
  completed_date: string | null; invoice_amount: number | null; hours: number | null;
  pay_type: string | null; pay_amount: number | null;
}

function monthToDate(): DateRange {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(now) };
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || (name[0] || '?').toUpperCase();
}

export default function LaborByTechPage() {
  const perms = useAPPermissions();
  const [range, setRange] = useState<DateRange>(monthToDate());
  const [payPeriods, setPayPeriods] = useState<{ start: string; end: string }[]>([]);
  const [rows, setRows] = useState<TechRow[]>([]);
  const [jobCount, setJobCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [jobsByTech, setJobsByTech] = useState<Record<string, JobRow[] | 'loading'>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ start: range.start, end: range.end });
      const res = await fetch(`/api/reports/labor-by-tech?${p.toString()}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `Failed (${res.status})`); }
      const data = await res.json();
      setRows(data.techs || []);
      setJobCount(data.job_count || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { if (!perms.isLoading) load(); }, [load, perms.isLoading]);
  useEffect(() => {
    if (perms.isLoading) return;
    fetch('/api/payroll-periods').then(r => r.ok ? r.json() : []).then(setPayPeriods).catch(() => {});
  }, [perms.isLoading]);

  // Changing the date range invalidates cached per-tech job detail.
  useEffect(() => { setExpanded(null); setJobsByTech({}); }, [range.start, range.end]);

  const toggleExpand = async (technicianId: string) => {
    if (expanded === technicianId) { setExpanded(null); return; }
    setExpanded(technicianId);
    if (!jobsByTech[technicianId]) {
      setJobsByTech(s => ({ ...s, [technicianId]: 'loading' }));
      try {
        const p = new URLSearchParams({ start: range.start, end: range.end });
        const res = await fetch(`/api/reports/labor-by-tech/${technicianId}?${p.toString()}`);
        const data = res.ok ? await res.json() : { jobs: [] };
        setJobsByTech(s => ({ ...s, [technicianId]: data.jobs || [] }));
      } catch {
        setJobsByTech(s => ({ ...s, [technicianId]: [] }));
      }
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (teamFilter === 'install' && !r.is_install) return false;
      if (teamFilter === 'other' && r.is_install) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, teamFilter]);

  const installRows = filtered.filter(r => r.is_install);
  const otherRows = filtered.filter(r => !r.is_install);
  const sum = (rs: TechRow[], k: 'hours' | 'pay_set') => rs.reduce((s, r) => s + (r[k] || 0), 0);
  const totalHours = sum(filtered, 'hours');
  const otherHours = sum(otherRows, 'hours');
  const totalPay = sum(filtered, 'pay_set');
  const otherPct = totalHours > 0 ? Math.round((otherHours / totalHours) * 100) : 0;

  const exportCsv = () => {
    const header = ['Technician', 'Home Team', 'On Install Team', 'Jobs', 'ST Hours', 'Pay Set'];
    const lines = filtered.map(r => [r.name, r.home_team || '', r.is_install ? 'yes' : 'no', r.jobs, r.hours, r.pay_set].join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `labor-by-tech-${range.start}_${range.end}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!perms.isLoading && !perms.canViewJobs) {
    return <div className="p-8 text-sm" style={{ color: 'var(--text-muted)' }}>You don&apos;t have permission to view this report.</div>;
  }

  const selectStyle = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' };
  const cardStyle = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' };

  const techCell = (r: TechRow) => (
    <span className="inline-flex items-center gap-2.5">
      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
        style={{ backgroundColor: r.is_install ? 'rgba(58,143,87,.25)' : 'rgba(210,153,34,.22)', color: r.is_install ? '#6fd394' : '#d29922' }}>{initials(r.name)}</span>
      {r.name}
    </span>
  );
  const teamTag = (r: TechRow) => (
    <span className="text-[11px] px-2 py-0.5 rounded-full"
      style={r.is_install ? { backgroundColor: 'rgba(58,143,87,.16)', color: '#6fd394' } : { backgroundColor: 'rgba(210,153,34,.14)', color: '#d29922' }}>
      {r.home_team || 'No team'}
    </span>
  );

  const row = (r: TechRow) => {
    const open = expanded === r.technician_id;
    const detail = jobsByTech[r.technician_id];
    return (
      <Fragment key={r.technician_id}>
        <tr onClick={() => toggleExpand(r.technician_id)} className="cursor-pointer hover:bg-white/5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>
            <span className="inline-flex items-center gap-1.5">
              <span style={{ color: 'var(--text-muted)', fontSize: 10, width: 10, display: 'inline-block' }}>{open ? '▾' : '▸'}</span>
              {techCell(r)}
            </span>
          </td>
          <td className="px-3 py-2.5">{teamTag(r)}</td>
          <td className="px-3 py-2.5 text-sm text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.jobs}</td>
          <td className="px-3 py-2.5 text-sm text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.hours.toFixed(1)}</td>
          <td className="px-3 py-2.5 text-sm text-right tabular-nums font-semibold" style={{ color: r.pay_set > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{r.pay_set > 0 ? formatCurrency(r.pay_set) : '$0'}</td>
        </tr>
        {open && (
          <tr>
            <td colSpan={5} className="px-3 pb-3 pt-0" style={{ backgroundColor: 'rgba(58,143,87,.04)' }}>
              {detail === 'loading' || detail === undefined ? (
                <div className="text-xs py-3" style={{ color: 'var(--text-muted)' }}>Loading jobs…</div>
              ) : detail.length === 0 ? (
                <div className="text-xs py-3" style={{ color: 'var(--text-muted)' }}>No jobs for {r.name} in this period.</div>
              ) : (
                <table className="w-full mt-1" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 8 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)' }}>
                      {([['Job #', 'left'], ['Customer', 'left'], ['Completed', 'left'], ['ST Hours', 'right'], ['Pay Type', 'left'], ['Pay', 'right']] as [string, string][]).map(([l, a], i) => (
                        <th key={i} className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ textAlign: a as any }}>{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.map(j => (
                      <tr key={j.job_id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <td className="px-2.5 py-1.5 text-xs">
                          {j.st_job_id
                            ? <a href={`https://go.servicetitan.com/#/Job/Index/${j.st_job_id}`} target="_blank" rel="noopener noreferrer" className="hover:underline font-semibold" style={{ color: 'var(--christmas-green)' }}>{j.job_number}</a>
                            : <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{j.job_number}</span>}
                        </td>
                        <td className="px-2.5 py-1.5 text-xs" style={{ color: 'var(--text-primary)' }}>{j.customer_name || '—'}</td>
                        <td className="px-2.5 py-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{j.completed_date ? formatDate(j.completed_date) : '—'}</td>
                        <td className="px-2.5 py-1.5 text-xs text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{j.hours != null ? j.hours.toFixed(2) : '—'}</td>
                        <td className="px-2.5 py-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{j.pay_type || <span style={{ color: '#d29922' }}>not set</span>}</td>
                        <td className="px-2.5 py-1.5 text-xs text-right tabular-nums font-semibold" style={{ color: j.pay_amount != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>{j.pay_amount != null ? formatCurrency(j.pay_amount) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </td>
          </tr>
        )}
      </Fragment>
    );
  };
  const groupHeader = (label: string, hrs: number, other?: boolean) => (
    <tr><td colSpan={5} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: 'rgba(255,255,255,.02)', color: other ? '#d29922' : 'var(--text-muted)' }}>{label} — {hrs.toFixed(1)} h</td></tr>
  );

  return (
    <div className="p-4 lg:p-6 max-w-[1100px] mx-auto">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Labor by Technician</h1>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(58,143,87,.16)', color: '#6fd394' }}>HVAC Install jobs</span>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        Who worked install jobs and how much labor they represent — including help from other teams. ServiceTitan clocked hours. Click a technician to see each job.
      </p>

      <div className="flex items-center flex-wrap gap-2 mb-1">
        <DateRangePicker value={range} onChange={r => setRange(r)} defaultPreset="mtd" payPeriods={payPeriods} />
        <input type="text" placeholder="Search technician…" value={search} onChange={e => setSearch(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm" style={{ ...selectStyle, minWidth: 200 }} />
        <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          {([['all', 'All teams'], ['install', 'Install team'], ['other', 'Other teams']] as [TeamFilter, string][]).map(([f, label]) => (
            <button key={f} onClick={() => setTeamFilter(f)} className="px-3 py-1 rounded text-sm"
              style={{ backgroundColor: teamFilter === f ? 'var(--christmas-green)' : 'transparent', color: teamFilter === f ? 'var(--christmas-cream)' : 'var(--text-secondary)' }}>{label}</button>
          ))}
        </div>
        <button onClick={exportCsv} className="text-xs underline ml-auto" style={{ color: 'var(--text-muted)' }}>Export CSV</button>
      </div>
      <div className="text-[11px] mb-4" style={{ color: 'var(--text-muted)' }}>
        Date control matches the Install Jobs tab — pick a preset or a ServiceTitan Pay Period from the same dropdown.
      </div>

      {error && <div className="rounded-lg p-3 mb-4 text-sm" style={{ backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', color: '#f85149' }}>{error}</div>}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total Install Labor</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{totalHours.toFixed(1)} h</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{filtered.length} techs · {jobCount} jobs</div>
        </div>
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>From Other Teams</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: '#d29922' }}>{otherHours.toFixed(1)} h</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{otherPct}% of install labor hours</div>
        </div>
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Other-Team Techs</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{otherRows.length}</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>helping on install jobs</div>
        </div>
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Pay Set</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalPay)}</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>confirmed in the job drawer</div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg p-8 text-center text-sm" style={{ ...cardStyle, color: 'var(--text-muted)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg p-8 text-center text-sm" style={{ ...cardStyle, color: 'var(--text-muted)' }}>No technician labor for this range.</div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                {([['Technician', 'left'], ['Home Team', 'left'], ['Jobs', 'right'], ['ST Hours', 'right'], ['Pay Set', 'right']] as [string, string][]).map(([l, a], i) => (
                  <th key={i} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', textAlign: a as any, whiteSpace: 'nowrap' }}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(teamFilter !== 'other') && installRows.length > 0 && groupHeader('HVAC - Install · home team', sum(installRows, 'hours'))}
              {(teamFilter !== 'other') && installRows.map(row)}
              {(teamFilter !== 'install') && otherRows.length > 0 && groupHeader('Helping from other teams', sum(otherRows, 'hours'), true)}
              {(teamFilter !== 'install') && otherRows.map(row)}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)' }}>
                <td className="px-3 py-2.5 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Totals · {filtered.length} techs</td>
                <td></td>
                <td className="px-3 py-2.5 text-sm text-right font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{filtered.reduce((s, r) => s + r.jobs, 0)}</td>
                <td className="px-3 py-2.5 text-sm text-right font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{totalHours.toFixed(1)}</td>
                <td className="px-3 py-2.5 text-sm text-right font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalPay)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
        <b>Pay Set</b> = per-person pay confirmed in the job drawer (commission / hourly / etc.); $0 until set. Jobs counted by completed date. &quot;Install Team&quot; generic ServiceTitan account excluded.
      </div>
    </div>
  );
}
