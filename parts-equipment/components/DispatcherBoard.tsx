'use client';
import { useMemo, useState } from 'react';
import { useOrders, type OrdersContextValue } from '@/hooks/useOrders';
import type { PEOrder } from '@/types';

// The Dispatcher lane — the human bookend on the journey. Two jobs:
//   1. FRONT END — triage incoming work and route it to the right team board
//      (Parts, Service, or both when it spans the middle of the spectrum).
//   2. SCHEDULING — book the job. Fed two ways: book-first (schedule at intake) and
//      parts-first (Warehouse "Staged" hands it back as "ready to schedule").
//
//   Needs Triage ──(route)──▶ Parts / Service / Both
//   To Schedule  ──(book)───▶ Scheduled
//
// WIP / exploratory: columns are proxied from existing fields so we can feel the flow
// against real (sandbox) data. PREVIEW MODE default — clicks apply to a local overlay
// only, never the DB.

const cell: React.CSSProperties = {
  background: 'var(--surface, #fff)', border: '1px solid var(--border)', borderRadius: 10,
  padding: '10px 11px', boxShadow: '0 1px 2px rgba(0,0,0,.06)',
};
const btn = (bg: string): React.CSSProperties => ({
  flex: 1, font: 'inherit', fontSize: 12, fontWeight: 700, padding: '6px 8px', borderRadius: 7,
  border: '1px solid ' + bg, background: bg, color: '#fff', cursor: 'pointer',
});

export default function DispatcherBoard() {
  const ctx = useOrders() as OrdersContextValue;
  const { orders, saveOrderDebounced, showToast, preview, setPreview, previewOverlay, applyPreview, resetPreview } = ctx;

  // Cards the dispatcher has routed this session leave the triage column (visual only —
  // no triage field yet; this keeps the demo honest without a schema change).
  const [routed, setRouted] = useState<Set<number>>(new Set());

  function save(id: number, changes: Partial<PEOrder>) {
    if (preview) applyPreview(id, changes);
    else saveOrderDebounced(id, changes);
  }

  // The dispatcher sees ALL open work (install + service) — it's the front-end router.
  const lane = useMemo(() => orders.filter(o => o.status === 'open'), [orders]);
  const merged = useMemo(
    () => lane.map(o => previewOverlay[o.id] ? { ...o, ...previewOverlay[o.id] } : o),
    [lane, previewOverlay]
  );

  // Needs Triage: freshly-arrived work awaiting a routing decision (proxy: brand-new,
  // stage still "needs_order", not yet routed this session, not yet booked).
  const triage = merged
    .filter(o => o.stage === 'needs_order' && !o.call_booked && !routed.has(o.id))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 30);
  // To Schedule: parts are in at the shop (Warehouse staged) but not booked yet.
  const toSchedule = merged.filter(o => o.stage === 'staged' && !o.call_booked);
  // Scheduled: booked. Parts work can still be in flight — scheduling is independent.
  const scheduled = merged.filter(o => o.call_booked);

  function route(o: PEOrder, to: 'install' | 'service' | 'both') {
    const owner = to === 'service' ? 'Service Dispatcher' : 'Parts Coordinator';
    // 'both' keeps its classified type but flags the owner as the dispatcher's split.
    if (to !== 'both') save(o.id, { order_type: to, owner });
    else save(o.id, { owner: 'Install Dispatcher' });
    setRouted(prev => new Set(prev).add(o.id));
    const label = to === 'both' ? 'both lanes' : to === 'install' ? 'Parts (Install)' : 'Service';
    showToast(`${preview ? '(preview) ' : ''}#${o.job || o.id} routed → ${label}`, preview ? 'info' : 'success');
  }

  function schedule(o: PEOrder) {
    save(o.id, { call_booked: true });
    showToast(`${preview ? '(preview) ' : ''}#${o.job || o.id} scheduled`, preview ? 'info' : 'success');
  }

  const head = (o: PEOrder) => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>#{o.job || '—'}</span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: o.order_type === 'install' ? 'var(--accent, #1b8a4b)' : 'var(--slate, #1a5276)' }}>{o.order_type}</span>
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{o.customer || '—'}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 6 }}>{o.part || '—'}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>{o.subtype || '—'}{o.estimate_cost ? ` · ${o.estimate_cost}` : ''}</div>
    </>
  );

  const col: React.CSSProperties = { flex: '0 0 320px', background: 'var(--surface2, #eef3ee)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column' };
  const colHead = (accent: string): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', borderBottom: '1px solid var(--border)', borderTop: `3px solid ${accent}`, borderRadius: '12px 12px 0 0' });
  const count: React.CSSProperties = { marginLeft: 'auto', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 600, color: 'var(--muted)' };
  const body: React.CSSProperties = { padding: 10, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 80 };
  const maroon = 'var(--maroon, #8a2433)';

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
          <button onClick={() => { resetPreview(); setRouted(new Set()); }}
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
        <b style={{ color: 'var(--text)' }}>Dispatcher</b> — direct traffic in, book the job. Route new work to the right team, and schedule jobs once they&apos;re ready (booked up front, or handed back from Warehouse staged).
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>

        {/* Needs Triage */}
        <section style={col}>
          <div style={colHead(maroon)}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Needs Triage</span>
            <span style={{ ...count, color: maroon }}>{triage.length}</span>
          </div>
          <div style={body}>
            {triage.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint,#889)', padding: 4 }}>Nothing to triage. 🎉</div>}
            {triage.map(o => (
              <article key={o.id} style={{ ...cell, borderLeft: `3px solid ${maroon}` }}>
                {head(o)}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={btn('var(--accent, #1b8a4b)')} onClick={() => route(o, 'install')}>Parts</button>
                  <button style={btn('var(--slate, #1a5276)')} onClick={() => route(o, 'service')}>Service</button>
                  <button style={btn(maroon)} onClick={() => route(o, 'both')}>Both</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* To Schedule */}
        <section style={col}>
          <div style={colHead('var(--slate, #1a5276)')}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>To Schedule</span>
            <span style={{ ...count, color: 'var(--slate, #1a5276)' }}>{toSchedule.length}</span>
          </div>
          <div style={body}>
            {toSchedule.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint,#889)', padding: 4 }}>Nothing waiting to schedule.</div>}
            {toSchedule.map(o => (
              <article key={o.id} style={cell}>
                {head(o)}
                <div style={{ fontSize: 11, color: 'var(--accent, #1b8a4b)', fontWeight: 600, marginBottom: 8 }}>✓ parts staged at shop</div>
                <button style={{ ...btn(maroon), width: '100%' }} onClick={() => schedule(o)}>Schedule</button>
              </article>
            ))}
          </div>
        </section>

        {/* Scheduled */}
        <section style={col}>
          <div style={colHead('var(--accent, #1b8a4b)')}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Scheduled</span>
            <span style={count}>{scheduled.length}</span>
          </div>
          <div style={body}>
            {scheduled.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint,#889)', padding: 4 }}>Nothing scheduled yet.</div>}
            {scheduled.map(o => (
              <article key={o.id} style={{ ...cell, opacity: 0.92 }}>
                {head(o)}
                <div style={{ fontSize: 11, color: 'var(--accent, #1b8a4b)', fontWeight: 600 }}>🗓 booked — parts continue in parallel</div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
