'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import { formatCurrency, formatDate } from '@/lib/ap-utils';

interface Run {
  id: string; contractor_id: string; contractor_name: string; total_amount: number; job_count: number;
  confirmation_code: string | null; payment_method: string | null; paid_on: string | null;
  paid_by_name: string | null; notes: string | null; created_at: string;
}
interface RunJob { id: string; st_job_id: number | null; job_number: string; customer_name: string | null; completed_date: string | null; payment_amount: number; }

export default function PayRunsPage() {
  const perms = useAPPermissions();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [jobsByRun, setJobsByRun] = useState<Record<string, RunJob[] | 'loading'>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/pay-runs');
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `Failed (${res.status})`); }
      const data = await res.json();
      setRuns(data.runs || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!perms.isLoading) load(); }, [load, perms.isLoading]);

  const toggle = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!jobsByRun[id]) {
      setJobsByRun(s => ({ ...s, [id]: 'loading' }));
      try {
        const res = await fetch(`/api/pay-runs/${id}`);
        const data = res.ok ? await res.json() : { jobs: [] };
        setJobsByRun(s => ({ ...s, [id]: data.jobs || [] }));
      } catch { setJobsByRun(s => ({ ...s, [id]: [] })); }
    }
  };

  if (!perms.isLoading && !perms.canManagePayments) {
    return <div className="p-8 text-sm" style={{ color: 'var(--text-muted)' }}>You don&apos;t have permission to view pay runs.</div>;
  }

  const cardStyle = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' };
  const totalPaid = runs.reduce((s, r) => s + (r.total_amount || 0), 0);
  const th = 'px-3 py-2 text-[11px] font-semibold uppercase tracking-wider';

  return (
    <div className="p-4 lg:p-6 max-w-[1100px] mx-auto">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Pay Runs</h1>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        Lump payments to contractors, each covering multiple jobs. Click a run to see the jobs it paid.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Pay Runs</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{runs.length}</div>
        </div>
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total Paid</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalPaid)}</div>
        </div>
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Jobs Paid</div>
          <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--text-primary)' }}>{runs.reduce((s, r) => s + (r.job_count || 0), 0)}</div>
        </div>
      </div>

      {error && <div className="rounded-lg p-3 mb-4 text-sm" style={{ backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', color: '#f85149' }}>{error}</div>}

      {loading ? (
        <div className="rounded-lg p-8 text-center text-sm" style={{ ...cardStyle, color: 'var(--text-muted)' }}>Loading…</div>
      ) : runs.length === 0 ? (
        <div className="rounded-lg p-8 text-center text-sm" style={{ ...cardStyle, color: 'var(--text-muted)' }}>No pay runs yet. Record one from the Payment Tracker.</div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                <th className={`${th} text-left`}>Paid On</th>
                <th className={`${th} text-left`}>Contractor</th>
                <th className={`${th} text-right`}>Jobs</th>
                <th className={`${th} text-right`}>Amount</th>
                <th className={`${th} text-left`}>Method</th>
                <th className={`${th} text-left`}>Confirmation</th>
                <th className={`${th} text-left`}>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => {
                const open = expanded === r.id;
                const detail = jobsByRun[r.id];
                return (
                  <Fragment key={r.id}>
                    <tr onClick={() => toggle(r.id)} className="cursor-pointer hover:bg-white/5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: 10, marginRight: 6 }}>{open ? '▾' : '▸'}</span>
                        {r.paid_on ? formatDate(r.paid_on) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>{r.contractor_name}</td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.job_count}</td>
                      <td className="px-3 py-2.5 text-sm text-right tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(r.total_amount)}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{r.payment_method || '—'}</td>
                      <td className="px-3 py-2.5 text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{r.confirmation_code || '—'}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{r.paid_by_name || '—'}</td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={7} className="px-3 pb-3 pt-0" style={{ backgroundColor: 'rgba(58,143,87,.04)' }}>
                          {detail === 'loading' || detail === undefined ? (
                            <div className="text-xs py-3" style={{ color: 'var(--text-muted)' }}>Loading jobs…</div>
                          ) : detail.length === 0 ? (
                            <div className="text-xs py-3" style={{ color: 'var(--text-muted)' }}>No jobs linked to this run.</div>
                          ) : (
                            <table className="w-full mt-1" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 8 }}>
                              <thead><tr style={{ color: 'var(--text-muted)' }}>
                                <th className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-left">Job #</th>
                                <th className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-left">Customer</th>
                                <th className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-left">Completed</th>
                                <th className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-right">Amount</th>
                              </tr></thead>
                              <tbody>
                                {detail.map(j => (
                                  <tr key={j.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                    <td className="px-2.5 py-1.5 text-xs">
                                      {j.st_job_id
                                        ? <a href={`https://go.servicetitan.com/#/Job/Index/${j.st_job_id}`} target="_blank" rel="noopener noreferrer" className="hover:underline font-semibold" style={{ color: 'var(--christmas-green)' }}>{j.job_number}</a>
                                        : <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{j.job_number}</span>}
                                    </td>
                                    <td className="px-2.5 py-1.5 text-xs" style={{ color: 'var(--text-primary)' }}>{j.customer_name || '—'}</td>
                                    <td className="px-2.5 py-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{j.completed_date ? formatDate(j.completed_date) : '—'}</td>
                                    <td className="px-2.5 py-1.5 text-xs text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(j.payment_amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {r.notes && <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Notes: {r.notes}</div>}
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
    </div>
  );
}
