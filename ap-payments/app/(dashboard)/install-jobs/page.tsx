'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import { formatDate, formatCurrency } from '@/lib/ap-utils';
import CrewDrawer, { InstallJobRow } from '@/components/CrewDrawer';

function monthToDate(): DateRange {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(now) };
}
function initials(name: string | null): string {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
}
type AssignFilter = 'all' | 'unassigned' | 'assigned';

export default function InstallJobsPage() {
  const perms = useAPPermissions();
  const [range, setRange] = useState<DateRange>(monthToDate());
  const [assignFilter, setAssignFilter] = useState<AssignFilter>('all');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<InstallJobRow[]>([]);
  const [technicians, setTechnicians] = useState<{ id: string; name: string }[]>([]);
  const [contractors, setContractors] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerJob, setDrawerJob] = useState<InstallJobRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ start: range.start, end: range.end });
      const [jobsRes, techRes, conRes] = await Promise.all([
        fetch(`/api/install-jobs?${p.toString()}`),
        fetch('/api/technicians'),
        fetch('/api/contractors'),
      ]);
      if (!jobsRes.ok) { const j = await jobsRes.json().catch(() => ({})); throw new Error(j.error || `Failed (${jobsRes.status})`); }
      const jobs = await jobsRes.json();
      setRows(jobs.rows || []);
      const techs = techRes.ok ? await techRes.json() : [];
      setTechnicians((techs || []).map((t: any) => ({ id: t.id, name: t.name })));
      const cons = conRes.ok ? await conRes.json() : [];
      setContractors((cons || []).filter((c: any) => c.is_active !== false).map((c: any) => ({ id: c.id, name: c.name })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load install jobs');
    } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { if (!perms.isLoading) load(); }, [load, perms.isLoading]);

  // keep the open drawer in sync after add/remove
  useEffect(() => {
    if (!drawerJob) return;
    const updated = rows.find(r => r.id === drawerJob.id);
    if (updated && updated !== drawerJob) setDrawerJob(updated);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (q && !(`${r.job_number}`.toLowerCase().includes(q) || (r.customer_name || '').toLowerCase().includes(q))) return false;
      if (assignFilter === 'unassigned' && r.assignments.length > 0) return false;
      if (assignFilter === 'assigned' && r.assignments.length === 0) return false;
      return true;
    });
  }, [rows, search, assignFilter]);

  const unassignedCount = useMemo(() => filtered.filter(r => r.assignments.length === 0).length, [filtered]);

  if (!perms.isLoading && !perms.canViewJobs) {
    return <div className="p-8 text-sm" style={{ color: 'var(--text-muted)' }}>You don&apos;t have permission to view install jobs.</div>;
  }

  const selectStyle = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' };

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Install Jobs</h1>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(58,143,87,.16)', color: '#6fd394' }}>HVAC Install only</span>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        Assign technicians and subcontractors to HVAC Install jobs from ServiceTitan. (Scoped to the HVAC&nbsp;-&nbsp;Install business unit.)
      </p>

      <div className="flex items-center flex-wrap gap-2 mb-4">
        <DateRangePicker value={range} onChange={r => setRange(r)} defaultPreset="mtd" />
        <input type="text" placeholder="Search job #, customer…" value={search} onChange={e => setSearch(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm" style={{ ...selectStyle, minWidth: 210 }} />
        <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          {(['all', 'unassigned', 'assigned'] as const).map(f => (
            <button key={f} onClick={() => setAssignFilter(f)} className="px-3 py-1 rounded text-sm capitalize"
              style={{ backgroundColor: assignFilter === f ? 'var(--christmas-green)' : 'transparent', color: assignFilter === f ? 'var(--christmas-cream)' : 'var(--text-secondary)' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
        Showing <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{filtered.length}</span> install jobs
        {unassignedCount > 0 && <> · <span style={{ color: '#d29922' }}>{unassignedCount} unassigned</span></>}
      </div>

      {error && <div className="rounded-lg p-3 mb-4 text-sm" style={{ backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', color: '#f85149' }}>{error}</div>}

      {loading ? (
        <div className="rounded-lg p-8 text-center text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg p-8 text-center text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>No install jobs match these filters.</div>
      ) : (
        <div className="rounded-lg overflow-x-auto" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <table className="w-full min-w-[760px]">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                {([
                  { l: 'Job #', a: 'left' }, { l: 'Customer', a: 'left' }, { l: 'Type', a: 'left' },
                  { l: 'Completed', a: 'left' }, { l: 'Invoice $', a: 'right' },
                  { l: 'Assigned To', a: 'left', w: '34%' }, { l: '', a: 'right' },
                ] as { l: string; a: 'left' | 'right'; w?: string }[]).map((h, i) => (
                  <th key={i} className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: h.a, width: h.w }}>{h.l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} onClick={() => setDrawerJob(r)} className="cursor-pointer hover:bg-white/5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td className="px-3 py-2.5 text-sm" style={{ whiteSpace: 'nowrap' }}>
                    {r.st_job_id ? (
                      <a href={`https://go.servicetitan.com/#/Job/Index/${r.st_job_id}`} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()} className="hover:underline font-semibold" style={{ color: 'var(--christmas-green)' }}>{r.job_number}</a>
                    ) : <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{r.job_number}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{r.customer_name || '—'}</td>
                  <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.job_type || '—'}</td>
                  <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.completed_date ? formatDate(r.completed_date) : '—'}</td>
                  <td className="px-3 py-2.5 text-sm text-right tabular-nums" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {r.invoice_amount != null ? formatCurrency(r.invoice_amount) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.assignments.length === 0 ? (
                      <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(210,153,34,0.13)', color: '#d29922' }}>Unassigned</span>
                    ) : (
                      <div className="flex flex-col gap-1.5 items-start">
                        {r.assignments.map(a => {
                          const isTech = a.type === 'technician';
                          return (
                            <span key={a.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
                              style={{ backgroundColor: isTech ? 'rgba(58,143,87,.16)' : 'rgba(163,113,247,.16)', color: isTech ? '#6fd394' : '#a371f7' }}>
                              <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold"
                                style={{ backgroundColor: isTech ? 'rgba(58,143,87,.3)' : 'rgba(163,113,247,.3)' }}>{initials(a.name)}</span>
                              {a.name || '—'}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right" style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={e => { e.stopPropagation(); setDrawerJob(r); }} className="rounded-lg px-3 py-1.5 text-xs font-medium"
                      style={r.assignments.length === 0
                        ? { backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }
                        : { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      {r.assignments.length === 0 ? '+ Assign' : 'Edit'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CrewDrawer job={drawerJob} technicians={technicians} contractors={contractors}
        canEdit={perms.canManageAssignments} onClose={() => setDrawerJob(null)} onChanged={load} />
    </div>
  );
}
