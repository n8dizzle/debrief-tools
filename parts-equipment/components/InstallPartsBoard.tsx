'use client';
import { useMemo, useState } from 'react';
import { useOrders, type OrdersContextValue } from '@/hooks/useOrders';
import type { PEOrder } from '@/types';

// The Parts Coordinator lane (lean model). A clean order never lingers here — the
// moment it's placed it hands to Warehouse. The only ordered items Parts keeps are
// the BACKORDERED ones (their watchlist, where they chase the ETA).
//
//   Needs Order ──(place order)──▶  clean  → Warehouse (leaves board)
//                                   B/O    → Backordered watchlist
//   Backordered ──(part arrives)──▶ Warehouse (leaves board)
//
// PREVIEW MODE (default ON): clicks/edits apply to a local overlay only and never
// hit the database or ServiceTitan — safe to dogfood. Flip to LIVE to make real changes.

const cell: React.CSSProperties = {
  background: 'var(--surface, #fff)', border: '1px solid var(--border)', borderRadius: 10,
  padding: '10px 11px', boxShadow: '0 1px 2px rgba(0,0,0,.06)',
};
const inputStyle: React.CSSProperties = {
  fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, padding: '5px 7px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--surface,#fff)', color: 'var(--text)', width: '100%',
};
const btn = (bg: string): React.CSSProperties => ({
  flex: 1, font: 'inherit', fontSize: 12, fontWeight: 700, padding: '6px 8px', borderRadius: 7,
  border: '1px solid ' + bg, background: bg, color: '#fff', cursor: 'pointer',
});

export default function InstallPartsBoard() {
  const ctx = useOrders() as OrdersContextValue;
  const { orders, suppliers, commitOrderNum, saveOrderDebounced, showToast } = ctx;

  // Preview (safe) vs Live. Default preview so the WIP board can't touch real data.
  const [preview, setPreview] = useState(true);
  const [overlay, setOverlay] = useState<Record<number, Partial<PEOrder>>>({});
  function setMode(next: boolean) { setPreview(next); setOverlay({}); }

  // All writes funnel through here: preview → local overlay only; live → real PATCH.
  function save(id: number, changes: Partial<PEOrder>) {
    if (preview) setOverlay(p => ({ ...p, [id]: { ...p[id], ...changes } }));
    else saveOrderDebounced(id, changes);
  }

  const lane = useMemo(
    () => orders.filter(o => o.order_type === 'install' && o.status === 'open'),
    [orders]
  );
  const merged = useMemo(
    () => lane.map(o => overlay[o.id] ? { ...o, ...overlay[o.id] } : o),
    [lane, overlay]
  );
  const needs = merged.filter(o => o.stage === 'needs_order');
  const backordered = merged.filter(o => o.blocked === 'backordered' && o.stage !== 'needs_order');

  function place(o: PEOrder, toWarehouse: boolean) {
    const num = (o.order_num || '').trim();
    if (!num) return;
    if (!preview) commitOrderNum(o.id, num); // supplier-gated ST note — live only
    if (toWarehouse) {
      save(o.id, { stage: 'inbound', blocked: '', location: 'Shipping to Shop' });
      showToast(`${preview ? '(preview) ' : ''}#${o.job || o.id} ordered → Warehouse`, preview ? 'info' : 'success');
    } else {
      save(o.id, { stage: 'ordered', blocked: 'backordered' });
      showToast(`${preview ? '(preview) ' : ''}#${o.job || o.id} → backordered watchlist`, 'info');
    }
  }

  function partIn(o: PEOrder) {
    save(o.id, { stage: 'inbound', blocked: '', location: 'Shipping to Shop' });
    showToast(`${preview ? '(preview) ' : ''}#${o.job || o.id} part in → Warehouse`, preview ? 'info' : 'success');
  }

  const head = (o: PEOrder) => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>#{o.job || '—'}</span>
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{o.customer || '—'}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 8 }}>{o.part || '—'}</div>
    </>
  );

  const col: React.CSSProperties = { flex: '0 0 320px', background: 'var(--surface2, #eef3ee)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column' };
  const colHead = (accent: string): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', borderBottom: '1px solid var(--border)', borderTop: `3px solid ${accent}`, borderRadius: '12px 12px 0 0' });
  const count: React.CSSProperties = { marginLeft: 'auto', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 600, color: 'var(--muted)' };
  const body: React.CSSProperties = { padding: 10, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 80 };

  return (
    <div style={{ padding: '4px 24px 24px' }}>
      {/* Mode switch + banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border-strong, var(--border))', borderRadius: 8, overflow: 'hidden' }}>
          {([['preview', 'Preview (safe)'], ['live', 'Live']] as const).map(([v, label]) => {
            const on = (v === 'preview') === preview;
            return (
              <button key={v} onClick={() => setMode(v === 'preview')}
                style={{ font: 'inherit', fontSize: 12, fontWeight: 700, padding: '5px 12px', border: 'none', cursor: 'pointer',
                  background: on ? (v === 'live' ? 'var(--amber, #9a6410)' : 'var(--accent, #1b8a4b)') : 'transparent',
                  color: on ? '#fff' : 'var(--muted)' }}>
                {label}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 12.5, color: preview ? 'var(--muted)' : 'var(--amber, #9a6410)', fontWeight: preview ? 400 : 700 }}>
          {preview
            ? 'Preview — clicks & edits are not saved. Poke around freely.'
            : '⚠ Live — changes save to real orders and post ServiceTitan notes.'}
        </span>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>
        <b style={{ color: 'var(--text)' }}>Parts Coordinator</b> — place orders. A clean order goes straight to Warehouse; a backordered one lands on your watchlist to chase.
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>

        {/* Needs Order */}
        <section style={col}>
          <div style={colHead('var(--slate, #52606f)')}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Needs Order</span>
            <span style={count}>{needs.length}</span>
          </div>
          <div style={body}>
            {needs.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint,#889)', padding: 4 }}>Nothing waiting to be ordered.</div>}
            {needs.map(o => {
              const noSupplier = !(o.supplier || '').trim();
              const ready = !noSupplier && !!(o.order_num || '').trim();
              return (
                <article key={o.id} style={cell}>
                  {head(o)}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <select value={o.supplier || ''} onChange={e => save(o.id, { supplier: e.target.value })}
                      style={{ ...inputStyle, fontFamily: 'inherit' }}>
                      <option value="">— pick supplier —</option>
                      {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input placeholder={noSupplier ? 'supplier first' : 'order #'} disabled={noSupplier}
                      value={o.order_num || ''} onChange={e => save(o.id, { order_num: e.target.value })}
                      style={{ ...inputStyle, opacity: noSupplier ? 0.5 : 1 }} />
                    <div style={{ display: 'flex', gap: 6, opacity: ready ? 1 : 0.4, pointerEvents: ready ? 'auto' : 'none' }}>
                      <button style={btn('var(--accent, #1b8a4b)')} onClick={() => place(o, true)}>Ordered → Warehouse</button>
                      <button style={btn('var(--amber, #9a6410)')} onClick={() => place(o, false)}>Backordered</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Backordered watchlist */}
        <section style={col}>
          <div style={colHead('var(--amber, #9a6410)')}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Backordered</span>
            <span style={{ ...count, color: 'var(--amber, #9a6410)' }}>{backordered.length}</span>
          </div>
          <div style={body}>
            {backordered.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint,#889)', padding: 4 }}>Nothing on backorder. 🎉</div>}
            {backordered.map(o => (
              <article key={o.id} style={{ ...cell, borderLeft: '3px solid var(--amber, #9a6410)' }}>
                {head(o)}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>
                  <span>{o.supplier || '—'}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>#{o.order_num || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 11, color: 'var(--faint,#889)' }}>ETA</label>
                  <input type="date" value={o.eta || ''} onChange={e => save(o.id, { eta: e.target.value })}
                    style={{ ...inputStyle, width: 'auto', flex: 1 }} />
                </div>
                <button style={{ ...btn('var(--accent, #1b8a4b)'), marginTop: 8, width: '100%' }} onClick={() => partIn(o)}>Part in → Warehouse</button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
