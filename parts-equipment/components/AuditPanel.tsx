'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import type { PEAuditLog } from '@/types';

interface Props {
  onClose: () => void;
}

export default function AuditPanel({ onClose }: Props) {
  const [entries, setEntries] = useState<PEAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'service' | 'install' | 'warranty'>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/audit')
      .then(r => r.json())
      .then(({ entries: data }) => { if (data) setEntries(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return entries;
    return entries.filter(e => e.type === typeFilter);
  }, [entries, typeFilter]);

  function fmtTs(ts: string): string {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  const actionColors: Record<string, string> = {
    created: '#1a9e6a',
    updated: '#2980b9',
    completed: '#27ae60',
    cancelled: '#c0392b',
    deleted: '#7d3c98',
  };

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div ref={panelRef} className="panel audit-panel">

        {/* Header */}
        <div className="panel-header">
          <div style={{ fontSize: 15, fontWeight: 700 }}>Audit Trail</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Filter chips */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['all', 'service', 'install', 'warranty'] as const).map(f => (
            <button key={f} onClick={() => setTypeFilter(f)}
              style={{
                padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: typeFilter === f ? 'var(--accent)' : 'var(--surface2)',
                color: typeFilter === f ? '#fff' : 'var(--text)',
                textTransform: 'capitalize',
              }}>
              {f}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>
            {filtered.length} entries
          </span>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No audit entries found.</div>
          ) : filtered.map(e => (
            <div key={e.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  background: (actionColors[e.action ?? ''] || 'var(--muted)') + '22',
                  color: actionColors[e.action ?? ''] || 'var(--muted)',
                  textTransform: 'uppercase', letterSpacing: .5,
                }}>{e.action}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
                  {e.type === 'service' ? '⚡' : e.type === 'install' ? '🔧' : '🛡'}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{e.job_id || e.customer || '—'}</span>
              </div>
              {e.detail && (
                <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4, lineHeight: 1.5 }}>{e.detail}</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
                <span>{e.changed_by || 'System'}</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmtTs(e.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
