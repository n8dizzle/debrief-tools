'use client';
import { useEffect, useMemo, useState } from 'react';
import { useOrders, type OrdersContextValue } from '@/hooks/useOrders';
import type { PEOrder } from '@/types';

// The Dispatcher lane — the human bookend: triage/route work in at the front, and
// schedule it (book-first, or handed back from Warehouse "staged").
//
// PHASE 1 engine: COLUMNS come from `pe_wf_stages` (board='dispatcher') via
// /api/workflow-config. Filters + actions stay coded, keyed by stage key. PREVIEW default.

interface WfStage { key: string; label: string; color: string | null; sort_order: number; }
const FALLBACK: WfStage[] = [
  { key: 'triage', label: 'Needs Triage', color: 'maroon', sort_order: 1 },
  { key: 'to_schedule', label: 'To Schedule', color: 'slate', sort_order: 2 },
  { key: 'scheduled', label: 'Scheduled', color: 'green', sort_order: 3 },
];
const COLOR: Record<string, string> = {
  amber: 'var(--amber, #9a6410)', slate: 'var(--slate, #1a5276)',
  green: 'var(--accent, #1b8a4b)', maroon: 'var(--maroon, #8a2433)',
};
const hue = (c: string | null) => COLOR[c || ''] || 'var(--muted)';

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

  const [stages, setStages] = useState<WfStage[]>(FALLBACK);
  const [fromConfig, setFromConfig] = useState(false);
  const [routed, setRouted] = useState<Set<number>>(new Set());
  useEffect(() => {
    let alive = true;
    fetch('/api/workflow-config?board=dispatcher')
      .then(r => r.json())
      .then(d => { if (alive && Array.isArray(d.stages) && d.stages.length) { setStages(d.stages); setFromConfig(true); } })
      .catch(() => { /* keep fallback */ });
    return () => { alive = false; };
  }, []);

  function save(id: number, changes: Partial<PEOrder>) {
    if (preview) applyPreview(id, changes);
    else saveOrderDebounced(id, changes);
  }

  const lane = useMemo(() => orders.filter(o => o.status === 'open'), [orders]);
  const merged = useMemo(
    () => lane.map(o => previewOverlay[o.id] ? { ...o, ...previewOverlay[o.id] } : o),
    [lane, previewOverlay]
  );

  function route(o: PEOrder, to: 'install' | 'service' | 'both') {
    if (to !== 'both') save(o.id, { order_type: to, owner: to === 'service' ? 'Service Dispatcher' : 'Parts Coordinator' });
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

  const maroon = 'var(--maroon, #8a2433)';
  const BEHAVIOR: Record<string, { filter: (o: PEOrder) => boolean; card: (o: PEOrder) => React.ReactNode; empty: string }> = {
    triage: {
      filter: o => o.stage === 'needs_order' && !o.call_booked && !routed.has(o.id),
      empty: 'Nothing to triage. 🎉',
      card: o => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={btn('var(--accent, #1b8a4b)')} onClick={() => route(o, 'install')}>Parts</button>
          <button style={btn('var(--slate, #1a5276)')} onClick={() => route(o, 'service')}>Service</button>
          <button style={btn(maroon)} onClick={() => route(o, 'both')}>Both</button>
        </div>
      ),
    },
    to_schedule: {
      filter: o => o.stage === 'staged' && !o.call_booked,
      empty: 'Nothing waiting to schedule.',
      card: o => (
        <>
          <div style={{ fontSize: 11, color: 'var(--accent, #1b8a4b)', fontWeight: 600, marginBottom: 8 }}>✓ parts staged at shop</div>
          <button style={{ ...btn(maroon), width: '100%' }} onClick={() => schedule(o)}>Schedule</button>
        </>
      ),
    },
    scheduled: {
      filter: o => !!o.call_booked,
      empty: 'Nothing scheduled yet.',
      card: () => <div style={{ fontSize: 11, color: 'var(--accent, #1b8a4b)', fontWeight: 600 }}>🗓 booked — parts continue in parallel</div>,
    },
  };

  const col: React.CSSProperties = { flex: '0 0 300px', background: 'var(--surface2, #eef3ee)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column' };
  const colHead = (accent: string): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', borderBottom: '1px solid var(--border)', borderTop: `3px solid ${accent}`, borderRadius: '12px 12px 0 0' });
  const count: React.CSSProperties = { marginLeft: 'auto', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 600, color: 'var(--muted)' };
  const body: React.CSSProperties = { padding: 10, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 80 };
  const triageLimit = (key: string, cards: PEOrder[]) => key === 'triage' ? cards.slice(0, 30) : cards;

  return (
    <div style={{ padding: '4px 24px 24px' }}>
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
        <span style={{ fontSize: 11.5, fontFamily: 'IBM Plex Mono, monospace', color: fromConfig ? 'var(--accent, #1b8a4b)' : 'var(--faint,#889)' }}>
          {fromConfig ? '⚙ columns from config' : '⚙ columns (fallback)'}
        </span>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>
        <b style={{ color: 'var(--text)' }}>Dispatcher</b> — direct traffic in, book the job. Route new work to the right team, and schedule jobs once ready.
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', overflowX: 'auto' }}>
        {stages.map(s => {
          const beh = BEHAVIOR[s.key];
          const cards = triageLimit(s.key, beh ? merged.filter(beh.filter) : []);
          return (
            <section key={s.key} style={col}>
              <div style={colHead(hue(s.color))}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{s.label}</span>
                <span style={{ ...count, color: hue(s.color) }}>{cards.length}</span>
              </div>
              <div style={body}>
                {cards.length === 0 && (
                  <div style={{ fontSize: 12.5, color: 'var(--faint,#889)', padding: 4 }}>
                    {beh ? beh.empty : 'No behavior wired for this stage yet.'}
                  </div>
                )}
                {cards.map(o => (
                  <article key={o.id} style={{ ...cell, ...(s.key === 'triage' ? { borderLeft: `3px solid ${maroon}` } : {}) }}>
                    {head(o)}
                    {beh?.card(o)}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
