'use client';
import { useState, useEffect, useCallback } from 'react';
import { useOrders } from '@/hooks/useOrders';

interface WfStage {
  id: number;
  board: string;
  key: string;
  label: string;
  sort_order: number;
  color: string | null;
  is_terminal: boolean;
  is_parts_active: boolean;
  active: boolean;
}

// Boards are a small code constant (they rarely change); stages within them are the
// manager-editable part. Edit here → the board's columns change, no deploy.
const BOARDS = [
  { key: 'dispatcher', label: 'Dispatcher' },
  { key: 'parts', label: 'Parts' },
  { key: 'warehouse', label: 'Warehouse' },
];
const COLORS = ['', 'green', 'slate', 'amber', 'maroon'];
const SWATCH: Record<string, string> = {
  green: 'var(--accent, #1b8a4b)', slate: 'var(--slate, #1a5276)',
  amber: 'var(--amber, #9a6410)', maroon: 'var(--maroon, #8a2433)', '': 'var(--muted)',
};

export default function WorkflowsSettings() {
  const { showToast } = useOrders();
  const [board, setBoard] = useState('warehouse');
  const [stages, setStages] = useState<WfStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (b: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/wf-stages?board=${b}`);
      if (res.ok) { const { stages: data } = await res.json(); setStages(data || []); }
      else showToast('Failed to load stages', 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(board); }, [board, load]);

  async function patch(id: number, body: Partial<WfStage>) {
    const res = await fetch(`/api/wf-stages/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.ok) { showToast('Saved', 'success'); await load(board); }
    else { showToast('Save failed', 'error'); await load(board); }
  }

  async function addStage() {
    const label = newLabel.trim();
    if (!label || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/wf-stages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board, label }),
      });
      if (res.ok) { setNewLabel(''); showToast('Stage added', 'success'); await load(board); }
      else { const e = await res.json().catch(() => ({})); showToast(e.error || 'Add failed', 'error'); }
    } finally { setBusy(false); }
  }

  async function remove(s: WfStage) {
    if (!confirm(`Remove the "${s.label}" column from the ${board} board? Jobs keep their data; the column just disappears.`)) return;
    const res = await fetch(`/api/wf-stages/${s.id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Stage removed', 'success'); await load(board); }
    else showToast('Delete failed', 'error');
  }

  async function move(id: number, dir: -1 | 1) {
    const idx = stages.findIndex(s => s.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= stages.length) return;
    const reordered = [...stages];
    [reordered[idx], reordered[swap]] = [reordered[swap], reordered[idx]];
    setStages(reordered);
    const res = await fetch('/api/wf-stages', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map(s => s.id) }),
    });
    if (!res.ok) { showToast('Reorder failed', 'error'); await load(board); }
  }

  const hasTerminal = stages.some(s => s.is_terminal);
  const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 'var(--radius-sm, 6px)', fontSize: 14, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' };

  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius, 10px)', padding: 20 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Workflows</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        The <strong>columns</strong> each team board shows. Add, rename, reorder, recolor, or flag a stage here and
        the board updates — no code, no deploy. <strong>Terminal</strong> = the job is done with this board;
        <strong> parts-active</strong> = still counts as needing parts. (Auto-move rules stay in code for now.)
      </p>

      {/* board tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {BOARDS.map(b => (
          <button key={b.key} onClick={() => setBoard(b.key)} className="btn"
            style={{ padding: '6px 14px', fontSize: 13, fontWeight: 700,
              background: board === b.key ? 'var(--accent, #1b8a4b)' : 'transparent',
              color: board === b.key ? '#fff' : 'var(--muted)',
              border: `1px solid ${board === b.key ? 'var(--accent, #1b8a4b)' : 'var(--border)'}` }}>
            {b.label}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: 'var(--muted)' }}>Loading…</p> : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stages.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button className="btn" onClick={() => move(s.id, -1)} disabled={i === 0}
                    style={{ padding: '0 6px', fontSize: 11, lineHeight: '16px', opacity: i === 0 ? 0.3 : 1 }} title="Move left">↑</button>
                  <button className="btn" onClick={() => move(s.id, 1)} disabled={i === stages.length - 1}
                    style={{ padding: '0 6px', fontSize: 11, lineHeight: '16px', opacity: i === stages.length - 1 ? 0.3 : 1 }} title="Move right">↓</button>
                </div>
                <span title={s.color || 'no color'} style={{ width: 12, height: 12, borderRadius: 3, background: SWATCH[s.color || ''], flex: 'none' }} />
                <input defaultValue={s.label} key={`${s.id}-${s.label}`}
                  onBlur={e => { const v = e.target.value.trim(); if (v && v !== s.label) patch(s.id, { label: v }); }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  style={{ ...inp, flex: 1, minWidth: 140, opacity: s.active ? 1 : 0.5 }} />
                <select value={s.color || ''} onChange={e => patch(s.id, { color: e.target.value })} style={{ ...inp, padding: '8px' }}>
                  {COLORS.map(c => <option key={c} value={c}>{c || '— color —'}</option>)}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--muted)' }}>
                  <input type="checkbox" checked={s.is_terminal} onChange={e => patch(s.id, { is_terminal: e.target.checked })} /> terminal
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--muted)' }}>
                  <input type="checkbox" checked={s.is_parts_active} onChange={e => patch(s.id, { is_parts_active: e.target.checked })} /> parts-active
                </label>
                <button className="btn" onClick={() => remove(s)} style={{ padding: '6px 10px', fontSize: 12, color: 'var(--red, #c0392b)' }} title="Remove">✕</button>
              </div>
            ))}
            {stages.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No stages yet — add one below.</p>}
          </div>

          {!hasTerminal && stages.length > 0 && (
            <p style={{ color: 'var(--amber, #9a6410)', fontSize: 12.5, marginTop: 12, fontWeight: 600 }}>
              ⚠ No terminal stage — jobs on this board would never finish. Flag one as terminal.
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addStage(); }}
              placeholder={`New ${board} stage…`} style={{ ...inp, flex: 1 }} />
            <button className="btn btn-primary" onClick={addStage} disabled={!newLabel.trim() || busy}>+ Add stage</button>
          </div>
        </>
      )}
    </section>
  );
}
