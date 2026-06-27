'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import { formatDate, formatCurrency } from '@/lib/ap-utils';
import CrewDrawer, { InstallJobRow, TechPayConfig, SubRate } from '@/components/CrewDrawer';
import AdminTable, { AdminColumn } from '@/components/AdminTable';

/** Sum of confirmed pay across a job's crew, or null if nobody is paid yet. */
function laborOf(r: InstallJobRow): number | null {
  const paid = r.assignments.filter(a => a.pay_amount != null);
  return paid.length ? paid.reduce((s, a) => s + (a.pay_amount || 0), 0) : null;
}

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
  const [payConfigsByTech, setPayConfigsByTech] = useState<Record<string, TechPayConfig[]>>({});
  const [subRatesByContractor, setSubRatesByContractor] = useState<Record<string, SubRate[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerJob, setDrawerJob] = useState<InstallJobRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ start: range.start, end: range.end });
      const [jobsRes, techRes, conRes, payRes, rateRes] = await Promise.all([
        fetch(`/api/install-jobs?${p.toString()}`),
        fetch('/api/technicians'),
        fetch('/api/contractors'),
        fetch('/api/technician-pay-types'),
        fetch('/api/contractor-rates'),
      ]);
      if (!jobsRes.ok) { const j = await jobsRes.json().catch(() => ({})); throw new Error(j.error || `Failed (${jobsRes.status})`); }
      const jobs = await jobsRes.json();
      setRows(jobs.rows || []);
      const techs = techRes.ok ? await techRes.json() : [];
      setTechnicians((techs || []).map((t: any) => ({ id: t.id, name: t.name })));
      const cons = conRes.ok ? await conRes.json() : [];
      setContractors((cons || []).filter((c: any) => c.is_active !== false).map((c: any) => ({ id: c.id, name: c.name })));
      const payCfgs = payRes.ok ? await payRes.json() : [];
      const byTech: Record<string, TechPayConfig[]> = {};
      for (const c of (payCfgs || []) as any[]) {
        const pt = Array.isArray(c.pay_type) ? c.pay_type[0] : c.pay_type;
        if (!pt) continue;
        (byTech[c.technician_id] ||= []).push({
          pay_type_id: pt.id,
          name: pt.name,
          method: pt.method,
          percent: pt.percent,
          flat_amount: pt.flat_amount,
          default_job_types: pt.default_job_types || [],
          hourly_rate: c.hourly_rate,
        });
      }
      setPayConfigsByTech(byTech);
      const rates = rateRes.ok ? await rateRes.json() : [];
      const byCon: Record<string, SubRate[]> = {};
      for (const r of (rates || []) as any[]) {
        (byCon[r.contractor_id] ||= []).push({
          trade: r.trade, job_type_name: r.job_type_name,
          rate_amount: r.rate_amount, rate_type: r.rate_type,
        });
      }
      setSubRatesByContractor(byCon);
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

  const columns = useMemo<AdminColumn<InstallJobRow>[]>(() => [
    {
      key: 'job_number', label: 'Job #', sortable: true, width: 95,
      sortValue: r => { const n = Number(r.job_number); return isNaN(n) ? r.job_number : n; },
      searchValue: r => r.job_number,
      footer: rows => <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Totals · {rows.length}</span>,
      render: r => r.st_job_id ? (
        <a href={`https://go.servicetitan.com/#/Job/Index/${r.st_job_id}`} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()} className="hover:underline font-semibold" style={{ color: 'var(--christmas-green)', whiteSpace: 'nowrap' }}>{r.job_number}</a>
      ) : <span style={{ color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.job_number}</span>,
    },
    {
      key: 'customer', label: 'Customer', sortable: true, width: 170,
      sortValue: r => (r.customer_name || '').toLowerCase(),
      searchValue: r => r.customer_name || '',
      render: r => <span className="truncate block" style={{ color: 'var(--text-primary)' }} title={r.customer_name || ''}>{r.customer_name || '—'}</span>,
    },
    {
      key: 'job_type', label: 'Type', sortable: true, width: 150,
      sortValue: r => (r.job_type || '').toLowerCase(),
      searchValue: r => r.job_type || '',
      render: r => <span className="truncate block" style={{ color: 'var(--text-secondary)' }} title={r.job_type || ''}>{r.job_type || '—'}</span>,
    },
    {
      key: 'completed', label: 'Completed', sortable: true, width: 110,
      sortValue: r => r.completed_date || '',
      render: r => <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.completed_date ? formatDate(r.completed_date) : '—'}</span>,
    },
    {
      key: 'invoice', label: 'Invoice $', sortable: true, align: 'right', width: 110,
      sortValue: r => r.invoice_amount ?? -1,
      render: r => <span className="tabular-nums" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.invoice_amount != null ? formatCurrency(r.invoice_amount) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</span>,
      footer: rows => formatCurrency(rows.reduce((s, r) => s + (r.invoice_amount || 0), 0)),
    },
    {
      key: 'labor', label: 'Labor $', sortable: true, align: 'right', width: 110,
      sortValue: r => laborOf(r) ?? -1,
      render: r => {
        const labor = laborOf(r);
        if (labor == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
        return <span className="tabular-nums font-semibold" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatCurrency(labor)}</span>;
      },
      footer: rows => formatCurrency(rows.reduce((s, r) => s + (laborOf(r) || 0), 0)),
    },
    {
      key: 'labor_pct', label: 'Labor %', sortable: true, align: 'right', width: 100,
      sortValue: r => { const l = laborOf(r); return l != null && r.invoice_amount && r.invoice_amount > 0 ? (l / r.invoice_amount) * 100 : -1; },
      render: r => {
        const l = laborOf(r);
        if (l == null || !r.invoice_amount || r.invoice_amount <= 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
        return <span className="tabular-nums" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{((l / r.invoice_amount) * 100).toFixed(1)}%</span>;
      },
      footer: rows => {
        const ti = rows.reduce((s, r) => s + (r.invoice_amount || 0), 0);
        const tl = rows.reduce((s, r) => s + (laborOf(r) || 0), 0);
        return ti > 0 ? `${((tl / ti) * 100).toFixed(1)}%` : '—';
      },
    },
    {
      key: 'assigned', label: 'Assigned To', width: 280,
      render: r => r.assignments.length === 0 ? (
        <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(210,153,34,0.13)', color: '#d29922' }}>Unassigned</span>
      ) : (
        <div className="flex flex-col gap-1.5 items-start">
          {r.assignments.map(a => {
            const isTech = a.type === 'technician';
            return (
              <span key={a.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
                style={{ backgroundColor: isTech ? 'rgba(58,143,87,.16)' : 'rgba(163,113,247,.16)', color: isTech ? '#6fd394' : '#a371f7', maxWidth: '100%' }}>
                <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                  style={{ backgroundColor: isTech ? 'rgba(58,143,87,.3)' : 'rgba(163,113,247,.3)' }}>{initials(a.name)}</span>
                <span className="truncate">{a.name || '—'}</span>
                {a.pay_amount != null && <span className="tabular-nums font-semibold flex-shrink-0" style={{ opacity: 0.85 }}>· {formatCurrency(a.pay_amount)}</span>}
              </span>
            );
          })}
        </div>
      ),
    },
    {
      key: 'actions', label: '', align: 'right', width: 90, minWidth: 80,
      render: r => (
        <button onClick={e => { e.stopPropagation(); setDrawerJob(r); }} className="rounded-lg px-3 py-1.5 text-xs font-medium"
          style={r.assignments.length === 0
            ? { backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }
            : { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          {r.assignments.length === 0 ? '+ Assign' : 'Edit'}
        </button>
      ),
    },
  ], []);

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
      ) : (
        <AdminTable<InstallJobRow>
          tableId="install-jobs"
          columns={columns}
          rows={filtered}
          rowKey={r => r.id}
          onRowClick={r => setDrawerJob(r)}
          showSearch={false}
          emptyMessage="No install jobs match these filters."
        />
      )}
      <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
        Drag a column header to reorder · drag its right edge to resize · click a sortable header to sort.
      </p>

      <CrewDrawer job={drawerJob} technicians={technicians} contractors={contractors}
        payConfigsByTech={payConfigsByTech} subRatesByContractor={subRatesByContractor}
        canEdit={perms.canManageAssignments} onClose={() => setDrawerJob(null)} onChanged={load} />
    </div>
  );
}
