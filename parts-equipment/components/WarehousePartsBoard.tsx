'use client';
import { useMemo } from 'react';
import { useOrders, type OrdersContextValue } from '@/hooks/useOrders';
import type { PEOrder } from '@/types';

// The Warehouse lane — picks up where the Parts Coordinator hands off. Its whole job
// is to get parts into the shop, two ways:
//
//   To Pick Up  (part is at a supply house)      ──(picked up)──▶  Staged (at shop)
//   Incoming    (carrier shipping it to the shop) ──(received)───▶  Staged (at shop)
//
// Once Staged, Warehouse is done and it's the dispatcher's to schedule.
//
// This board is exploratory — it reads the CURRENT model (stage + location) so we can
// see how it lines up against the Parts board. Pickup signal = Location "Supply House";
// incoming = Stage "Inbound" that isn't a pickup. PREVIEW MODE default (no real writes).

const cell: React.CSSProperties = {
  background: 'var(--surface, #fff)', border: '1px solid var(--border)', borderRadius: 10,
  padding: '10px 11px', boxShadow: '0 1px 2px rgba(0,0,0,.06)',
};
const btn = (bg: string): React.CSSProperties => ({
  flex: 1, font: 'inherit', fontSize: 12, fontWeight: 700, padding: '6px 8px', borderRadius: 7,
  border: '1px solid ' + bg, background: bg, color: '#fff', cursor: 'pointer',
});

export default function WarehousePartsBoard() {
  const ctx = useOrders() as OrdersContextValue;
  // Shared Preview sandbox (see InstallPartsBoard) — same overlay both boards read,
  // so a card ordered on the Parts board lands here without touching the DB.
  const { orders, saveOrderDebounced, showToast, preview, setPreview, previewOverlay, applyPreview, resetPreview } = ctx;

  function save(id: number, changes: Partial<PEOrder>) {
    if (preview) applyPreview(id, changes);
    else saveOrderDebounced(id, changes);
  }

  const lane = useMemo(
    () => orders.filter(o => o.order_type === 'install' && o.status === 'open'),
    [orders]
  );
  const merged = useMemo(
    () => lane.map(o => previewOverlay[o.id] ? { ...o, ...previewOverlay[o.id] } : o),
    [lane, previewOverlay]
  );

  // Warehouse's three columns. No overlap: pickup is location-based, incoming excludes pickups.
  const notDone = (o: PEOrder) => o.stage !== 'staged' && o.stage !== 'done' && o.stage !== 'cancelled';
  const toPickUp = merged.filter(o => o.location === 'Supply House' && notDone(o));
  const incoming = merged.filter(o => o.stage === 'inbound' && o.location !== 'Supply House');
  const staged = merged.filter(o => o.stage === 'staged');

  function land(o: PEOrder, verb: string) {
    save(o.id, { stage: 'staged', location: 'Lewisville Shop' });
    showToast(`${preview ? '(preview) ' : ''}#${o.job || o.id} ${verb} → at shop`, preview ? 'info' : 'success');
  }

  const head = (o: PEOrder) => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>#{o.job || '—'}</span>
        {o.blocked && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--amber, #9a6410)' }}>⚠ blocked</span>}
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{o.customer || '—'}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 6 }}>{o.part || '—'}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>{o.supplier || '—'}{o.order_num ? ` · #${o.order_num}` : ''}</div>
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
              <button key={v} onClick={() => setPreview(v === 'preview')}
                style={{ font: 'inherit', fontSize: 12, fontWeight: 700, padding: '5px 12px', border: 'none', cursor: 'pointer',
                  background: on ? (v === 'live' ? 'var(--amber, #9a6410)' : 'var(--accent, #1b8a4b)') : 'transparent',
                  color: on ? '#fff' : 'var(--muted)' }}>
                {label}
              </button>
            );
          })}
        </div>
        {preview && Object.keys(previewOverlay).length > 0 && (
          <button onClick={resetPreview}
            style={{ font: 'inherit', fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)' }}>
            ↺ Reset preview
          </button>
        )}
        <span style={{ fontSize: 12.5, color: preview ? 'var(--muted)' : 'var(--amber, #9a6410)', fontWeight: preview ? 400 : 700 }}>
          {preview ? 'Preview — clicks & edits are not saved. Poke around freely.' : '⚠ Live — changes save to real orders.'}
        </span>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>
        <b style={{ color: 'var(--text)' }}>Warehouse</b> — get parts into the shop. Drive and grab the pickups, receive the incoming shipments, then it&apos;s staged and ready for the dispatcher.
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>

        {/* To Pick Up */}
        <section style={col}>
          <div style={colHead('var(--amber, #9a6410)')}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>To Pick Up</span>
            <span style={{ ...count, color: 'var(--amber, #9a6410)' }}>{toPickUp.length}</span>
          </div>
          <div style={body}>
            {toPickUp.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint,#889)', padding: 4 }}>Nothing to pick up.</div>}
            {toPickUp.map(o => (
              <article key={o.id} style={{ ...cell, borderLeft: '3px solid var(--amber, #9a6410)' }}>
                {head(o)}
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>📍 {o.location}</div>
                <button style={{ ...btn('var(--accent, #1b8a4b)'), width: '100%' }} onClick={() => land(o, 'picked up')}>Picked up → At Shop</button>
              </article>
            ))}
          </div>
        </section>

        {/* Incoming */}
        <section style={col}>
          <div style={colHead('var(--slate, #1a5276)')}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Incoming</span>
            <span style={count}>{incoming.length}</span>
          </div>
          <div style={body}>
            {incoming.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint,#889)', padding: 4 }}>Nothing incoming.</div>}
            {incoming.map(o => (
              <article key={o.id} style={cell}>
                {head(o)}
                <button style={{ ...btn('var(--accent, #1b8a4b)'), width: '100%' }} onClick={() => land(o, 'received')}>Received → At Shop</button>
              </article>
            ))}
          </div>
        </section>

        {/* Staged (landed) */}
        <section style={col}>
          <div style={colHead('var(--accent, #1b8a4b)')}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Staged — At Shop</span>
            <span style={count}>{staged.length}</span>
          </div>
          <div style={body}>
            {staged.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint,#889)', padding: 4 }}>Nothing staged yet.</div>}
            {staged.map(o => (
              <article key={o.id} style={{ ...cell, opacity: 0.92 }}>
                {head(o)}
                <div style={{ fontSize: 11, color: 'var(--accent, #1b8a4b)', fontWeight: 600 }}>✓ ready for dispatch</div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
