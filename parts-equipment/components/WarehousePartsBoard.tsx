'use client';
import { useEffect, useMemo, useState } from 'react';
import { useOrders, type OrdersContextValue } from '@/hooks/useOrders';
import type { PEOrder } from '@/types';

// The Warehouse lane — get parts into the shop, then out to the tech.
//
// PHASE 1 of the configurable workflow engine: the COLUMNS (label, order, color, and
// even which columns exist) come from `pe_wf_stages` (Settings → Workflows), fetched
// from /api/workflow-config. Edit a stage row → this board changes, no deploy.
// The per-stage FILTER + card actions stay coded (keyed by stage key) — that's the
// "transitions stay in code" line from the eng-review. PREVIEW MODE default.

interface WfStage { key: string; label: string; color: string | null; sort_order: number; is_terminal: boolean; }

// Fallback if the config fetch fails — board still renders (systems over heroes).
const FALLBACK: WfStage[] = [
  { key: 'to_pick_up', label: 'To Pick Up', color: 'amber', sort_order: 1, is_terminal: false },
  { key: 'incoming', label: 'Incoming', color: 'slate', sort_order: 2, is_terminal: false },
  { key: 'staged', label: 'Staged — At Shop', color: 'green', sort_order: 3, is_terminal: false },
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

export default function WarehousePartsBoard() {
  const ctx = useOrders() as OrdersContextValue;
  const { orders, saveOrderDebounced, showToast, preview, setPreview, previewOverlay, applyPreview, resetPreview } = ctx;

  const [stages, setStages] = useState<WfStage[]>(FALLBACK);
  const [fromConfig, setFromConfig] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch('/api/workflow-config?board=warehouse')
      .then(r => r.json())
      .then(d => { if (alive && Array.isArray(d.stages) && d.stages.length) { setStages(d.stages); setFromConfig(true); } })
      .catch(() => { /* keep fallback */ });
    return () => { alive = false; };
  }, []);

  function save(id: number, changes: Partial<PEOrder>) {
    if (preview) applyPreview(id, changes);
    else saveOrderDebounced(id, changes);
  }

  const lane = useMemo(() => orders.filter(o => o.order_type === 'install' && o.status === 'open'), [orders]);
  const merged = useMemo(
    () => lane.map(o => previewOverlay[o.id] ? { ...o, ...previewOverlay[o.id] } : o),
    [lane, previewOverlay]
  );

  function land(o: PEOrder, verb: string) {
    save(o.id, { stage: 'staged', location: 'Lewisville Shop' });
    showToast(`${preview ? '(preview) ' : ''}#${o.job || o.id} ${verb} → at shop`, preview ? 'info' : 'success');
  }
  function handoff(o: PEOrder, how: string) {
    save(o.id, { stage: 'in_hands' });
    showToast(`${preview ? '(preview) ' : ''}#${o.job || o.id} ${how} → in tech's hands`, preview ? 'info' : 'success');
  }

  // Coded behavior per stage key: which cards land here + what the card can do.
  const notTerminal = (o: PEOrder) => !['staged', 'done', 'cancelled', 'in_hands'].includes(o.stage || '');
  const BEHAVIOR: Record<string, { filter: (o: PEOrder) => boolean; card: (o: PEOrder) => React.ReactNode }> = {
    to_pick_up: {
      filter: o => o.location === 'Supply House' && notTerminal(o),
      card: o => <button style={{ ...btn('var(--accent, #1b8a4b)'), width: '100%' }} onClick={() => land(o, 'picked up')}>Picked up → At Shop</button>,
    },
    incoming: {
      filter: o => o.stage === 'inbound' && o.location !== 'Supply House',
      card: o => <button style={{ ...btn('var(--accent, #1b8a4b)'), width: '100%' }} onClick={() => land(o, 'received')}>Received → At Shop</button>,
    },
    staged: {
      filter: o => o.stage === 'staged',
      card: o => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={btn('var(--accent, #1b8a4b)')} onClick={() => handoff(o, 'tech pickup')}>Tech pickup</button>
          <button style={btn('var(--amber, #9a6410)')} onClick={() => handoff(o, 'run-out')}>Run-out</button>
        </div>
      ),
    },
    in_hands: {
      filter: o => o.stage === 'in_hands',
      card: () => <div style={{ fontSize: 11, color: 'var(--accent, #1b8a4b)', fontWeight: 600 }}>✓ in tech&apos;s hands</div>,
    },
  };

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

  const col: React.CSSProperties = { flex: '0 0 300px', background: 'var(--surface2, #eef3ee)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column' };
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
        <span style={{ fontSize: 11.5, fontFamily: 'IBM Plex Mono, monospace', color: fromConfig ? 'var(--accent, #1b8a4b)' : 'var(--faint,#889)' }}>
          {fromConfig ? '⚙ columns from config' : '⚙ columns (fallback)'}
        </span>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>
        <b style={{ color: 'var(--text)' }}>Warehouse</b> — get parts into the shop, then out to the tech. Columns below are driven by the workflow config — add or rename a stage in Settings and it shows here.
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', overflowX: 'auto' }}>
        {stages.map(s => {
          const beh = BEHAVIOR[s.key];
          const cards = beh ? merged.filter(beh.filter) : [];
          return (
            <section key={s.key} style={col}>
              <div style={colHead(hue(s.color))}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{s.label}</span>
                <span style={{ ...count, color: hue(s.color) }}>{cards.length}</span>
              </div>
              <div style={body}>
                {cards.length === 0 && (
                  <div style={{ fontSize: 12.5, color: 'var(--faint,#889)', padding: 4 }}>
                    {beh ? 'Nothing here.' : 'No behavior wired for this stage yet.'}
                  </div>
                )}
                {cards.map(o => (
                  <article key={o.id} style={{ ...cell, borderLeft: `3px solid ${hue(s.color)}` }}>
                    {head(o)}
                    {o.location === 'Supply House' && s.key === 'to_pick_up' && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>📍 {o.location}</div>
                    )}
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
