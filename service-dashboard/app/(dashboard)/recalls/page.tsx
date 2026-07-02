'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DateRangePicker, type DateRange } from '@/components/DateRangePicker';
import { formatLocalDate } from '@/lib/sd-utils';

function getMonthToDateRange(): DateRange {
  const now = new Date();
  return { start: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)), end: formatLocalDate(now) };
}


interface TrendsData {
  total_recalls: number;
  tech_rates: { st_technician_id: number; name: string; recalls: number; completed_jobs: number; rate: number | null }[];
  equipment: { label: string; count: number }[];
  equipment_coverage: { with_equipment: number; total: number };
  time_to_recall: Record<string, number>;
  root_causes: { category: string; count: number }[];
}

const PANEL: React.CSSProperties = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 };
const MUTED = 'var(--text-muted)';

function rateColor(rate: number | null): string {
  if (rate === null) return 'var(--text-muted)';
  if (rate >= 0.1) return 'var(--status-error)';
  if (rate >= 0.05) return 'var(--status-warning)';
  return 'var(--status-success)';
}

function Bar({ value, max, label, count }: { value: number; max: number; label: string; count: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{label}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{count}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ height: 8, borderRadius: 4, width: `${pct}%`, backgroundColor: 'var(--christmas-green)' }} />
      </div>
    </div>
  );
}

export default function RecallTrendsPage() {
  const router = useRouter();
  const [jobLookup, setJobLookup] = useState('');
  const [range, setRange] = useState<DateRange>(getMonthToDateRange());

  const openJob = () => {
    const id = jobLookup.trim().replace(/[^0-9]/g, '');
    if (id) router.push(`/recalls/${id}`);
  };
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/recalls/trends?startDate=${range.start}&endDate=${range.end}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`);
      setData(await res.json());
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const maxRate = Math.max(1, ...((data?.tech_rates || []).map(t => t.recalls)));
  const maxEquip = Math.max(1, ...((data?.equipment || []).map(e => e.count)));
  const maxCause = Math.max(1, ...((data?.root_causes || []).map(c => c.count)));
  const ttr = data?.time_to_recall || {};
  const maxTtr = Math.max(1, ...Object.values(ttr));
  const cov = data?.equipment_coverage;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Recalls</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {data ? `${data.total_recalls} recalls in this period` : 'Recall trends and root-cause analysis'}
            {' · '}<Link href="/recalls/queue" style={{ color: 'var(--christmas-green-light)' }}>View queue →</Link>
            {' · '}<a href="/q/demo" target="_blank" rel="noreferrer" style={{ color: 'var(--christmas-green-light)' }}>Preview tech view ↗</a>
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
            Service technicians only.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', gap: 4 }}>
            <input value={jobLookup} onChange={e => setJobLookup(e.target.value)} onKeyDown={e => e.key === 'Enter' && openJob()}
              placeholder="Look up job #" inputMode="numeric"
              style={{ width: 130, padding: '6px 10px', borderRadius: 8, fontSize: 13, backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }} />
            <button onClick={openJob} title="Open this job to investigate"
              style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--christmas-green-light)', border: '1px solid var(--border-default)' }}>Go</button>
          </span>
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </div>

      {loading && <div style={{ ...PANEL, color: MUTED }}>Loading recall trends…</div>}
      {error && <div style={{ ...PANEL, color: 'var(--status-error)' }}>Couldn&apos;t load trends: {error} <button onClick={load} style={{ marginLeft: 8, color: 'var(--christmas-green-light)' }}>Retry</button></div>}

      {!loading && !error && data && data.total_recalls === 0 && (
        <div style={{ ...PANEL, textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>No recalls in this period</div>
          <div style={{ color: MUTED, fontSize: 14 }}>A clean period is good news. Try a wider date range to see history.</div>
        </div>
      )}

      {!loading && !error && data && data.total_recalls > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {/* HERO: tech recall-rate */}
          <div style={{ ...PANEL, gridColumn: '1 / -1' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Technician recall rate</h2>
            <p style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>Recalls ÷ jobs completed. Techs with fewer than 10 completed jobs show “—” (too small a sample).</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                <thead><tr style={{ color: MUTED, textAlign: 'left', fontSize: 12 }}>
                  <th style={{ padding: '6px 8px' }}>Technician</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Recalls</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Completed</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Rate</th>
                </tr></thead>
                <tbody>
                  {data.tech_rates.map(t => (
                    <tr key={t.st_technician_id} style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                      <td style={{ padding: '8px' }}>{t.name}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{t.recalls}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{t.completed_jobs || '—'}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: rateColor(t.rate) }}>
                        {t.rate === null ? '—' : `${(t.rate * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Equipment */}
          <div style={PANEL}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Equipment</h2>
            <p style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>
              {cov ? `Equipment data on ${cov.with_equipment} of ${cov.total} recalls` : ''} · counts, not failure rate
            </p>
            {data.equipment.length === 0
              ? <div style={{ color: MUTED, fontSize: 13 }}>No equipment recorded on these recalls (coverage is partial).</div>
              : data.equipment.slice(0, 12).map(e => <Bar key={e.label} label={e.label} value={e.count} count={e.count} max={maxEquip} />)}
          </div>

          {/* Time to recall */}
          <div style={PANEL}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>Time to recall</h2>
            {['≤7d', '8–30d', '31–90d', '90d+', 'unknown'].map(b => (
              <Bar key={b} label={b === 'unknown' ? 'date unknown' : b} value={ttr[b] || 0} count={ttr[b] || 0} max={maxTtr} />
            ))}
          </div>

          {/* Root causes */}
          <div style={{ ...PANEL, gridColumn: '1 / -1' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Root cause</h2>
            <p style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>From resolved investigations. Investigate recalls in the queue to populate this.</p>
            {data.root_causes.length === 0
              ? <div style={{ color: MUTED, fontSize: 13 }}>No resolved investigations yet.</div>
              : data.root_causes.map(c => <Bar key={c.category} label={c.category} value={c.count} count={c.count} max={maxCause} />)}
          </div>
        </div>
      )}
    </div>
  );
}
