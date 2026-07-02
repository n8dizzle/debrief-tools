'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { DateRangePicker, type DateRange } from '@/components/DateRangePicker';
import { formatLocalDate } from '@/lib/sd-utils';

function getMonthToDateRange(): DateRange {
  const now = new Date();
  return { start: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)), end: formatLocalDate(now) };
}

interface RecallRow {
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

export default function RecallQueuePage() {
  const [range, setRange] = useState<DateRange>(getMonthToDateRange());
  const [status, setStatus] = useState('all');
  const [rows, setRows] = useState<RecallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/recalls/queue?startDate=${range.start}&endDate=${range.end}&status=${status}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`);
      setRows((await res.json()).recalls || []);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [range, status]);

  useEffect(() => { load(); }, [load]);

  const selectStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, fontSize: 13, backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Recall queue</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            <Link href="/recalls" style={{ color: 'var(--christmas-green-light)' }}>← Trends</Link>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
            <option value="all">All statuses</option><option value="none">Not started</option><option value="open">Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option>
          </select>
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
        {loading && <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading recalls…</div>}
        {error && <div style={{ padding: 24, color: 'var(--status-error)' }}>{error} <button onClick={load} style={{ color: 'var(--christmas-green-light)', marginLeft: 8 }}>Retry</button></div>}
        {!loading && !error && rows.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No recalls match these filters.</div>}
        {!loading && !error && rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: 'var(--text-muted)', textAlign: 'left', fontSize: 12, backgroundColor: 'var(--bg-secondary)' }}>
                <th style={{ padding: '10px 12px' }}>Date</th>
                <th style={{ padding: '10px 12px' }}>Job #</th>
                <th style={{ padding: '10px 12px' }}>Customer</th>
                <th style={{ padding: '10px 12px' }}>Original tech</th>
                <th style={{ padding: '10px 12px' }}>Trade</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Days to recall</th>
                <th style={{ padding: '10px 12px' }}>Equipment</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px' }}></th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.st_recall_job_id} style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{r.recall_created_on}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <a href={`https://go.servicetitan.com/Job/Index/${r.st_recall_job_id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--christmas-green-light)' }}>#{r.st_recall_job_id} ↗</a>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{r.customer_name || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{r.tech_name}</td>
                    <td style={{ padding: '10px 12px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{r.trade || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{r.days_to_recall ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: r.has_equipment ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{r.has_equipment ? 'on file' : '—'}</td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge status={r.investigation_status} /></td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <Link href={`/recalls/${r.st_recall_job_id}`} style={{ color: 'var(--christmas-green-light)', fontWeight: 600 }}>Investigate →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
