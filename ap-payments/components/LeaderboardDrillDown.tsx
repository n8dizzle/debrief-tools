'use client';

import { useEffect, useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/ap-utils';

export type DrillMetric = 'revenue' | 'efficiency' | 'recalls' | 'reviews';

const METRIC_LABELS: Record<DrillMetric, string> = {
  revenue: 'Jobs Installed',
  efficiency: 'Jobs Installed · Hours',
  recalls: 'Recalls Caused',
  reviews: 'Google Reviews',
};

const ST_JOB = (id: number) => `https://go.servicetitan.com/#/Job/Index/${id}`;

function JobLink({ id, label }: { id: number | null; label: string }) {
  if (!id) return <span style={{ color: 'var(--text-muted)' }}>{label}</span>;
  return (
    <a href={ST_JOB(id)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
      className="font-mono font-semibold hover:underline" style={{ color: 'var(--christmas-green)' }}>{label}</a>
  );
}

interface Props {
  techName: string;
  stTechId: number;
  metric: DrillMetric;
  start: string;
  end: string;
  onClose: () => void;
}

export default function LeaderboardDrillDown({ techName, stTechId, metric, start, end, onClose }: Props) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const p = new URLSearchParams({ techId: String(stTechId), metric, start, end });
        const res = await fetch(`/api/leaderboard/details?${p.toString()}`);
        const data = res.ok ? await res.json() : { records: [] };
        if (!cancelled) setRecords(data.records || []);
      } catch { if (!cancelled) setRecords([]); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [stTechId, metric, start, end]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const th = 'py-2 px-2 text-[11px] font-semibold uppercase tracking-wider';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-4xl max-h-[82vh] flex flex-col rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{techName}</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{METRIC_LABELS[metric]} · {formatDate(start)} – {formatDate(end)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : records.length === 0 ? (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>No records for this period.</div>
          ) : metric === 'recalls' ? (
            <table className="w-full text-sm">
              <thead><tr style={{ color: 'var(--text-muted)' }}>
                <th className={`${th} text-left`}>Recall Job</th><th className={`${th} text-left`}>Original Job</th>
                <th className={`${th} text-left`}>Recall Booked</th><th className={`${th} text-left`}>Type</th><th className={`${th} text-left`}>Customer</th><th className={`${th} text-right`}>Days</th>
              </tr></thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="py-2 px-2"><JobLink id={r.st_recall_job_id} label={String(r.st_recall_job_id)} /></td>
                    <td className="py-2 px-2"><JobLink id={r.st_original_job_id} label={String(r.st_original_job_id)} /></td>
                    <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>{r.recall_created_on ? formatDate(r.recall_created_on) : '—'}</td>
                    <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>{r.business_unit_name ? r.business_unit_name.replace(/^(HVAC|Plumbing)\s*-\s*/i, '') : '—'}</td>
                    <td className="py-2 px-2" style={{ color: 'var(--text-primary)' }}>{r.customer_name || '—'}</td>
                    <td className="py-2 px-2 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.days_to_recall ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : metric === 'reviews' ? (
            <div className="space-y-3">
              {records.map((r, i) => (
                <div key={i} className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.reviewer_name || 'Anonymous'}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.create_time ? formatDate(r.create_time) : ''}</span>
                  </div>
                  <div className="mb-1">{Array.from({ length: 5 }).map((_, idx) => (
                    <span key={idx} style={{ color: idx < (r.star_rating || 0) ? '#FFD700' : 'var(--text-muted)', fontSize: 14 }}>★</span>
                  ))}</div>
                  {r.comment && <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{r.comment.length > 320 ? r.comment.slice(0, 320) + '…' : r.comment}</p>}
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr style={{ color: 'var(--text-muted)' }}>
                <th className={`${th} text-left`}>Job #</th><th className={`${th} text-left`}>Completed</th><th className={`${th} text-left`}>Type</th><th className={`${th} text-left`}>Customer</th>
                <th className={`${th} text-right`}>Hours</th><th className={`${th} text-right`}>Comp</th><th className={`${th} text-right`}>Hrs/Comp</th>
                <th className={`${th} text-right`}>Rev/Hr</th><th className={`${th} text-right`}>Invoice</th>
              </tr></thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="py-2 px-2"><JobLink id={r.st_job_id} label={r.job_number} /></td>
                    <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>{r.completed_date ? formatDate(r.completed_date) : '—'}</td>
                    <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>{r.job_type || '—'}</td>
                    <td className="py-2 px-2" style={{ color: 'var(--text-primary)' }}>{r.customer_name || '—'}</td>
                    <td className="py-2 px-2 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.hours > 0 ? r.hours.toFixed(1) : '—'}</td>
                    <td className="py-2 px-2 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.components != null ? r.components : '—'}</td>
                    <td className="py-2 px-2 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.hours_per_component != null ? `${r.hours_per_component.toFixed(1)} h` : '—'}</td>
                    <td className="py-2 px-2 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.rev_per_hour > 0 ? `${formatCurrency(r.rev_per_hour)}/h` : '—'}</td>
                    <td className="py-2 px-2 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(r.invoice || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border-subtle)' }}>
                  <td colSpan={4} className="py-2 px-2 font-medium" style={{ color: 'var(--text-primary)' }}>Total · {records.length} job{records.length !== 1 ? 's' : ''}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold" style={{ color: 'var(--text-primary)' }}>{records.reduce((s, r) => s + (r.hours || 0), 0).toFixed(1)}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold" style={{ color: 'var(--text-primary)' }}>{records.reduce((s, r) => s + (r.components || 0), 0)}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold" style={{ color: 'var(--text-secondary)' }}>
                    {(() => { const comps = records.reduce((s, r) => s + (r.components || 0), 0); const ch = records.reduce((s, r) => s + (r.components != null && r.components > 0 ? (r.hours || 0) : 0), 0); return comps > 0 ? `${(ch / comps).toFixed(1)} h` : '—'; })()}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold" style={{ color: 'var(--christmas-green)' }}>
                    {(() => { const rev = records.reduce((s, r) => s + (r.invoice || 0), 0); const h = records.reduce((s, r) => s + (r.hours || 0), 0); return h > 0 ? `${formatCurrency(rev / h)}/h` : '—'; })()}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold" style={{ color: 'var(--christmas-green)' }}>{formatCurrency(records.reduce((s, r) => s + (r.invoice || 0), 0))}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="px-5 py-3 text-right text-sm" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
          {records.length} record{records.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
