'use client';
import { useMemo, useState } from 'react';
import { useOrders, type OrdersContextValue } from '@/hooks/useOrders';
import { daysSince } from '@/lib/pe-utils';
import type { PEOrder } from '@/types';

// The control tower. Every job, and exactly where it sits across the whole journey —
// so you see the flow as one picture and where the work piles up. Read-only: this is
// the roll-up of what the team boards do, not another place to do work.
//
// Journey (parts pipeline): Needs Order → Ordered → Inbound → Staged.  Scheduling runs
// in parallel (🗓), so it's shown as its own column, not a stage.

const PIPELINE = [
  { key: 'needs_order', short: 'Order', label: 'Needs Order', accent: 'var(--slate, #52606f)' },
  { key: 'ordered', short: 'Ord', label: 'Ordered', accent: 'var(--amber, #9a6410)' },
  { key: 'inbound', short: 'In', label: 'Inbound', accent: 'var(--slate, #1a5276)' },
  { key: 'staged', short: 'Shop', label: 'Staged', accent: 'var(--accent, #1b8a4b)' },
] as const;
const POS = Object.fromEntries(PIPELINE.map((s, i) => [s.key, i])) as Record<string, number>;

export default function MasterTable() {
  const ctx = useOrders() as OrdersContextValue;
  const { orders } = ctx;
  const [scope, setScope] = useState<'open' | 'all'>('open');

  const rows = useMemo(() => {
    const list = orders.filter(o => (scope === 'open' ? o.status === 'open' : o.status !== 'cancelled'));
    return list.slice().sort((a, b) => {
      // group by pipeline position, then oldest first (most at-risk on top)
      const pa = POS[a.stage || 'needs_order'] ?? 0, pb = POS[b.stage || 'needs_order'] ?? 0;
      if (pa !== pb) return pa - pb;
      return (a.date || '').localeCompare(b.date || '');
    });
  }, [orders, scope]);

  // Where's the work? Open count per pipeline stage — the bottleneck read.
  const tally = useMemo(() => {
    const open = orders.filter(o => o.status === 'open');
    const byStage = Object.fromEntries(PIPELINE.map(s => [s.key, open.filter(o => (o.stage || 'needs_order') === s.key).length]));
    const scheduled = open.filter(o => o.call_booked).length;
    const max = Math.max(1, ...PIPELINE.map(s => byStage[s.key]));
    return { byStage, scheduled, openTotal: open.length, max };
  }, [orders]);

  // styles
  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 };
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', padding: '10px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '9px 12px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'middle' };
  const mono: React.CSSProperties = { fontFamily: 'IBM Plex Mono, monospace' };

  const journey = (o: PEOrder) => {
    const term = o.stage === 'done' || o.status === 'completed';
    const pos = POS[o.stage || 'needs_order'] ?? 0;
    return (
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        {PIPELINE.map((s, i) => {
          const done = term || i < pos;
          const here = !term && i === pos;
          return (
            <div key={s.key} title={s.label} style={{
              width: 34, height: 7, borderRadius: 4,
              background: here ? s.accent : done ? 'color-mix(in srgb, var(--accent, #1b8a4b) 45%, transparent)' : 'var(--border)',
              outline: here ? `2px solid color-mix(in srgb, ${s.accent} 40%, transparent)` : 'none',
            }} />
          );
        })}
        <span style={{ fontSize: 10.5, ...mono, color: 'var(--muted)', marginLeft: 6 }}>
          {term ? 'Done' : PIPELINE[pos]?.label || '—'}
        </span>
      </div>
    );
  };

  return (
    <div style={{ padding: '4px 24px 24px' }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', margin: '4px 0 14px' }}>
        <b style={{ color: 'var(--text)' }}>Master — control tower.</b> Every job and where it sits across the whole flow. Read-only; the boards do the work, this sees it.
      </div>

      {/* Bottleneck strip */}
      <div style={{ ...card, padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {PIPELINE.map(s => {
            const n = tally.byStage[s.key];
            const isJam = n === tally.max && n > 0;
            return (
              <div key={s.key} style={{ minWidth: 82 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, ...mono }}>{n}</span>
                  {isJam && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--amber, #9a6410)' }}>◆ most</span>}
                </div>
                <div style={{ height: 4, borderRadius: 3, marginTop: 4, background: s.accent, opacity: 0.25 + 0.75 * (n / tally.max) }} />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>{s.label}</div>
              </div>
            );
          })}
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, ...mono, color: 'var(--accent, #1b8a4b)' }}>{tally.scheduled}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>🗓 scheduled</div>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--faint,#889)', marginTop: 10 }}>
          {tally.openTotal} open jobs · scheduling runs in parallel, so a scheduled job can sit at any stage
        </div>
      </div>

      {/* scope toggle */}
      <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
        {(['open', 'all'] as const).map(v => (
          <button key={v} onClick={() => setScope(v)} style={{
            font: 'inherit', fontSize: 12, fontWeight: 700, padding: '5px 14px', border: 'none', cursor: 'pointer',
            background: scope === v ? 'var(--accent, #1b8a4b)' : 'transparent', color: scope === v ? '#fff' : 'var(--muted)',
          }}>{v === 'open' ? 'Open' : 'Open + Done'}</button>
        ))}
      </div>

      {/* Master table */}
      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Job</th>
              <th style={th}>Type</th>
              <th style={th}>Owner</th>
              <th style={{ ...th, minWidth: 210 }}>Journey</th>
              <th style={th}>Sched</th>
              <th style={{ ...th, textAlign: 'right' }}>Age</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td style={{ ...td, color: 'var(--faint,#889)' }} colSpan={6}>No jobs.</td></tr>}
            {rows.map(o => {
              const age = daysSince(o.date);
              const stale = age > 30 && o.status === 'open';
              return (
                <tr key={o.id}>
                  <td style={td}>
                    <div style={{ ...mono, fontSize: 11.5, color: 'var(--muted)' }}>#{o.job || '—'}</div>
                    <div style={{ fontWeight: 600 }}>{o.customer || '—'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{o.part || '—'}</div>
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: o.order_type === 'install' ? 'var(--accent, #1b8a4b)' : 'var(--slate, #1a5276)' }}>{o.order_type}</span>
                  </td>
                  <td style={{ ...td, color: 'var(--muted)', fontSize: 12 }}>{o.owner || '—'}</td>
                  <td style={td}>{journey(o)}</td>
                  <td style={td}>{o.call_booked ? <span title="scheduled">🗓</span> : <span style={{ color: 'var(--faint,#889)' }}>—</span>}</td>
                  <td style={{ ...td, textAlign: 'right', ...mono, color: stale ? 'var(--amber, #9a6410)' : 'var(--muted)', fontWeight: stale ? 700 : 400 }}>{age}d</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
