'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { DateRangePicker, type DateRange } from '@/components/DateRangePicker';
import { formatLocalDate } from '@/lib/sd-utils';
import RecallQueueTable, { type RecallRow } from '@/components/RecallQueueTable';

function getMonthToDateRange(): DateRange {
  const now = new Date();
  return { start: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)), end: formatLocalDate(now) };
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
        {!loading && !error && rows.length > 0 && <RecallQueueTable rows={rows} />}
      </div>
    </div>
  );
}
