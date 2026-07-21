'use client';
import { useEffect, useMemo, useState } from 'react';
import { useOrders, type OrdersContextValue } from '@/hooks/useOrders';
import type { PEOrder } from '@/types';

// The Parts Coordinator lane. A clean order never lingers — the moment it's placed it
// hands to Warehouse (Ship to Shop / Pickup). Backordered ones stay on the watchlist.
//
// PHASE 1 engine: the COLUMNS come from `pe_wf_stages` (board='parts') via
// /api/workflow-config. Edit a stage in Settings → Workflows → this board changes.
// Per-column filter + card actions stay coded, keyed by stage key. PREVIEW default.

interface WfStage { key: string; label: string; color: string | null; sort_order: number; }
const FALLBACK: WfStage[] = [
  { key: 'needs_order', label: 'Needs Order', color: 'slate', sort_order: 1 },
  { key: 'backordered', label: 'Backordered', color: 'amber', sort_order: 2 },
];
const COLOR: Record<string, string> = {
  amber: 'var(--amber, #9a6410)', slate: 'var(--slate, #52606f)',
  green: 'var(--accent, #1b8a4b)', maroon: 'var(--maroon, #8a2433)',
};
const hue = (c: string | null) => COLOR[c || ''] || 'var(--muted)';

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
  const { orders, suppliers, commitOrderNum, saveOrderDebounced, showToast, preview, setPreview, previewOverlay, applyPreview, resetPreview } = ctx;

  const [stages, setStages] = useState<WfStage[]>(FALLBACK);
  const [fromConfig, setFromConfig] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch('/api/workflow-config?board=parts')
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

  function order(o: PEOrder, mode: 'ship' | 'pickup') {
    const num = (o.order_num || '').trim();
    if (!num) return;
    if (!preview) commitOrderNum(o.id, num);
    const pickup = mode === 'pickup';
    save(o.id, { stage: 'inbound', blocked: '', location: pickup ? 'Supply House' : '' });
    showToast(`${preview ? '(preview) ' : ''}#${o.job || o.id} ordered → ${pickup ? 'Warehouse pickup' : 'shipping to shop'}`, preview ? 'info' : 'success');
  }
  function backorder(o: PEOrder) {
    const num = (o.order_num || '').trim();
    if (!num) return;
    if (!preview) commitOrderNum(o.id, num);
    save(o.id, { stage: 'ordered', blocked: 'backordered' });
    showToast(`${preview ? '(preview) ' : ''}#${o.job || o.id} → backordered watchlist`, 'info');
  }
  function partIn(o: PEOrder, mode: 'ship' | 'pickup') {
    const pickup = mode === 'pickup';
    save(o.id, { stage: 'inbound', blocked: '', location: pickup ? 'Supply House' : '' });
    showToast(`${preview ? '(preview) ' : ''}#${o.job || o.id} part in → ${pickup ? 'Warehouse pickup' : 'shipping to shop'}`, preview ? 'info' : 'success');
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

  // Coded behavior per stage key.
  const BEHAVIOR: Record<string, { filter: (o: PEOrder) => boolean; card: (o: PEOrder) => React.ReactNode; empty: string }> = {
    needs_order: {
      filter: o => o.stage === 'needs_order',
      empty: 'Nothing waiting to be ordered.',
      card: o => {
        const noSupplier = !(o.supplier || '').trim();
        const ready = !noSupplier && !!(o.order_num || '').trim();
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <select value={o.supplier || ''} onChange={e => save(o.id, { supplier: e.target.value })} style={{ ...inputStyle, fontFamily: 'inherit' }}>
              <option value="">— pick supplier —</option>
              {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input placeholder={noSupplier ? 'supplier first' : 'order #'} disabled={noSupplier}
              value={o.order_num || ''} onChange={e => save(o.id, { order_num: e.target.value })}
              style={{ ...inputStyle, opacity: noSupplier ? 0.5 : 1 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: ready ? 1 : 0.4, pointerEvents: ready ? 'auto' : 'none' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={btn('var(--slate, #1a5276)')} onClick={() => order(o, 'ship')}>Ship to Shop</button>
                <button style={btn('var(--accent, #1b8a4b)')} onClick={() => order(o, 'pickup')}>Pickup</button>
              </div>
              <button style={btn('var(--amber, #9a6410)')} onClick={() => backorder(o)}>Backordered</button>
            </div>
          </div>
        );
      },
    },
    backordered: {
      filter: o => o.blocked === 'backordered' && o.stage !== 'needs_order',
      empty: 'Nothing on backorder. 🎉',
      card: o => (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>
            <span>{o.supplier || '—'}</span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>#{o.order_num || '—'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 11, color: 'var(--faint,#889)' }}>ETA</label>
            <input type="date" value={o.eta || ''} onChange={e => save(o.id, { eta: e.target.value })} style={{ ...inputStyle, width: 'auto', flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button style={btn('var(--slate, #1a5276)')} onClick={() => partIn(o, 'ship')}>Ship to Shop</button>
            <button style={btn('var(--accent, #1b8a4b)')} onClick={() => partIn(o, 'pickup')}>Pickup</button>
          </div>
        </>
      ),
    },
  };

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
        <b style={{ color: 'var(--text)' }}>Parts Coordinator</b> — place orders. A clean order goes straight to Warehouse; a backordered one lands on your watchlist to chase.
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
                    {beh ? beh.empty : 'No behavior wired for this stage yet.'}
                  </div>
                )}
                {cards.map(o => (
                  <article key={o.id} style={{ ...cell, ...(s.key === 'backordered' ? { borderLeft: `3px solid ${hue(s.color)}` } : {}) }}>
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
