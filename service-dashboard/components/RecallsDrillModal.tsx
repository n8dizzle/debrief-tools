'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

interface RecallRow {
  st_recall_job_id: number;
  st_original_job_id: number;
  caused_by_tech_id: number | null;
  tech_name: string;
  recall_created_on: string;
  customer_name: string | null;
  investigation_status: string;
}

interface Props {
  startDate: string;
  endDate: string;
  techName?: string | null; // display label for the header
  techId?: number | null;   // when set, filter to this tech (by id — robust vs name)
  onClose: () => void;
}

function jobUrl(id: number) { return `https://go.servicetitan.com/Job/Index/${id}`; }

export default function RecallsDrillModal({ startDate, endDate, techName, techId, onClose }: Props) {
  const [rows, setRows] = useState<RecallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false; // guard against out-of-order responses on rapid range changes
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`/api/recalls/queue?startDate=${startDate}&endDate=${endDate}&status=all`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        if (!ignore) setRows(data.recalls || []);
      } catch (e) {
        if (!ignore) setError((e as Error).message || 'Could not load recalls.');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [startDate, endDate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(
    () => (techId != null ? rows.filter(r => r.caused_by_tech_id === techId) : rows),
    [rows, techId]
  );

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: '100%', maxWidth: 760, maxHeight: '80vh', display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{techName || 'All recalls'}</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Recalls · {startDate} – {endDate}</p>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 16px' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : error ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--status-error)' }}>Couldn’t load recalls: {error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No recalls found.</div>
          ) : (
            <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left', fontSize: 12 }}>
                  <th style={{ padding: '8px 8px' }}>Date</th>
                  <th style={{ padding: '8px 8px' }}>Recall job</th>
                  <th style={{ padding: '8px 8px' }}>Original job</th>
                  <th style={{ padding: '8px 8px' }}>Customer</th>
                  <th style={{ padding: '8px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.st_recall_job_id} style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                    <td style={{ padding: '8px 8px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{r.recall_created_on}</td>
                    <td style={{ padding: '8px 8px', whiteSpace: 'nowrap' }}>
                      <a href={jobUrl(r.st_recall_job_id)} target="_blank" rel="noreferrer" style={{ color: 'var(--christmas-green-light)' }}>#{r.st_recall_job_id} ↗</a>
                    </td>
                    <td style={{ padding: '8px 8px', whiteSpace: 'nowrap' }}>
                      <a href={jobUrl(r.st_original_job_id)} target="_blank" rel="noreferrer" style={{ color: 'var(--christmas-green-light)' }}>#{r.st_original_job_id} ↗</a>
                    </td>
                    <td style={{ padding: '8px 8px' }}>{r.customer_name || '—'}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                      <Link href={`/recalls/${r.st_recall_job_id}`} onClick={onClose} style={{ color: 'var(--christmas-green-light)', fontWeight: 600 }}>Investigate →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: '10px 20px', textAlign: 'right', fontSize: 13, color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)' }}>
          {filtered.length} recall{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
