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

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'none', label: 'Not started' },
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
];

export default function RecallQueuePage() {
  const [range, setRange] = useState<DateRange>(getMonthToDateRange());
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
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

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Recall queue</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          <Link href="/recalls" style={{ color: 'var(--christmas-green-light)' }}>← Trends</Link>
        </p>
      </div>

      {/* One toolbar row: search + date on the left, status quick-filters on the right */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Quick filter — customer, tech, job #, status…"
          style={{ flex: '1 1 240px', maxWidth: 360, padding: '7px 12px', borderRadius: 8, fontSize: 13, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
        />
        <DateRangePicker value={range} onChange={setRange} />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto', padding: 4, borderRadius: 10, backgroundColor: 'var(--bg-secondary)' }}>
          {STATUS_FILTERS.map(o => {
            const active = status === o.value;
            return (
              <button
                key={o.value}
                onClick={() => setStatus(o.value)}
                style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                  cursor: 'pointer', border: 'none', transition: 'background-color 0.15s',
                  backgroundColor: active ? 'var(--christmas-green)' : 'transparent',
                  color: active ? 'white' : 'var(--text-muted)',
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
        {loading && <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading recalls…</div>}
        {error && <div style={{ padding: 24, color: 'var(--status-error)' }}>{error} <button onClick={load} style={{ color: 'var(--christmas-green-light)', marginLeft: 8 }}>Retry</button></div>}
        {!loading && !error && rows.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No recalls match these filters.</div>}
        {!loading && !error && rows.length > 0 && <RecallQueueTable rows={rows} query={query} />}
      </div>
    </div>
  );
}
