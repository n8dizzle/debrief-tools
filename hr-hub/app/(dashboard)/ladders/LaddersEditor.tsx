'use client';

import { useCallback, useEffect, useState } from 'react';
import { useHRPermissions } from '@/hooks/useHRPermissions';
import type { LadderTree, LadderSummary, LadderTier } from '@/lib/ladder-types';

type Entity = 'ladder' | 'level' | 'tier' | 'bucket' | 'item';
type Op = 'create' | 'update' | 'delete' | 'reorder';

async function editApi(entity: Entity, op: Op, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch('/api/ladder-edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity, op, ...payload }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'Edit failed');
  return j.row;
}

// return a reordered id list after moving index by dir (-1 up / +1 down)
function moved(ids: string[], index: number, dir: number): string[] | null {
  const j = index + dir;
  if (j < 0 || j >= ids.length) return null;
  const next = [...ids];
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)', borderRadius: 6, padding: '4px 8px', fontSize: 13,
};

function EditableText({ value, onSave, placeholder, multiline, style }: {
  value: string | null; onSave: (v: string) => void; placeholder?: string; multiline?: boolean; style?: React.CSSProperties;
}) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  const commit = () => { if ((value ?? '') !== v) onSave(v); };
  const common = { value: v, placeholder, onChange: (e: any) => setV(e.target.value), onBlur: commit, style: { ...inputStyle, width: '100%', ...style } };
  return multiline ? <textarea rows={2} {...common} /> : <input {...common} />;
}

function Btn({ onClick, children, title, danger, disabled }: { onClick: () => void; children: React.ReactNode; title?: string; danger?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className="text-xs px-1.5 py-0.5 rounded disabled:opacity-30"
      style={{ border: '1px solid var(--border-subtle)', color: danger ? '#c97878' : 'var(--text-secondary)', background: 'transparent' }}>
      {children}
    </button>
  );
}

export default function LaddersEditor() {
  const { canEditLadder } = useHRPermissions();
  const [ladders, setLadders] = useState<LadderSummary[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [tree, setTree] = useState<LadderTree | null>(null);
  const [units, setUnits] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    const res = await fetch('/api/ladders?all=1');
    const j = await res.json();
    if (res.ok) setLadders(j.ladders || []);
  }, []);
  const loadTree = useCallback(async (id: string) => {
    const res = await fetch(`/api/ladders/${id}`);
    const j = await res.json();
    if (res.ok) setTree(j.ladder);
  }, []);

  useEffect(() => {
    loadList();
    fetch('/api/business-units').then((r) => r.json()).then((j) => setUnits(j.units || [])).catch(() => {});
  }, [loadList]);
  useEffect(() => { if (selId) loadTree(selId); else setTree(null); }, [selId, loadTree]);

  const mutate = async (entity: Entity, op: Op, payload: Record<string, unknown>, opts: { reloadTree?: boolean } = {}) => {
    setBusy(true); setErr(null);
    try {
      const row = await editApi(entity, op, payload);
      if (opts.reloadTree !== false && selId) await loadTree(selId);
      await loadList();
      return row;
    } catch (e: any) { setErr(e.message); return null; }
    finally { setBusy(false); }
  };

  const createLadder = async () => {
    const row = await mutate('ladder', 'create', { name: 'New ladder', sort_order: ladders.length }, { reloadTree: false });
    if (row?.id) setSelId(row.id);
  };

  if (!canEditLadder) {
    return <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>You don&apos;t have permission to manage ladders.</div>;
  }

  const levels = tree ? [...tree.levels].sort((a, b) => a.sort_order - b.sort_order) : [];
  const buckets = tree ? [...tree.buckets].sort((a, b) => a.sort_order - b.sort_order) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Manage Ladders</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Create and shape ladders — levels, wage tiers, skill buckets, checkboxes, gates. Changes save as you go.</p>
        </div>
        {busy && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>saving…</span>}
      </div>

      {err && <div className="mb-3 text-sm rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(139,45,50,.14)', border: '1px solid rgba(139,45,50,.55)', color: '#c97878' }}>{err}</div>}

      <div className="flex gap-6">
        {/* Ladder list */}
        <div className="w-56 shrink-0">
          <div className="space-y-1 mb-3">
            {ladders.map((l) => (
              <button key={l.id} onClick={() => setSelId(l.id)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: selId === l.id ? 'var(--christmas-green)' : 'var(--bg-card)', color: selId === l.id ? 'var(--on-accent)' : 'var(--text-primary)', border: '1px solid var(--border-subtle)', opacity: l.is_active ? 1 : 0.5 }}>
                {l.name}{!l.is_active && ' (archived)'}
              </button>
            ))}
          </div>
          <button onClick={createLadder} className="w-full px-3 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--on-accent)' }}>+ New ladder</button>
        </div>

        {/* Editor */}
        <div className="flex-1 min-w-0">
          {!tree ? (
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Select a ladder, or create one.</div>
          ) : (
            <div className="space-y-5">
              {/* Ladder header */}
              <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Name</label>
                    <EditableText value={tree.name} onSave={(v) => mutate('ladder', 'update', { id: tree.id, patch: { name: v } })} />
                  </div>
                  <div>
                    <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Description</label>
                    <EditableText value={tree.description} onSave={(v) => mutate('ladder', 'update', { id: tree.id, patch: { description: v } })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Roster — ServiceTitan business units</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {units.map((u) => {
                      const on = tree.st_business_units.includes(u);
                      return (
                        <button key={u} onClick={() => {
                          const next = on ? tree.st_business_units.filter((x) => x !== u) : [...tree.st_business_units, u];
                          mutate('ladder', 'update', { id: tree.id, patch: { st_business_units: next } });
                        }}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: on ? 'var(--christmas-green)' : 'transparent', color: on ? 'var(--on-accent)' : 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                          {u}
                        </button>
                      );
                    })}
                    {units.length === 0 && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No business units found.</span>}
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Active technicians in the selected units populate this ladder&apos;s roster.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Btn onClick={() => mutate('ladder', 'update', { id: tree.id, patch: { is_active: false } })}>Archive</Btn>
                  <Btn danger onClick={() => { if (confirm('Delete this ladder and everything in it? This cannot be undone.')) { mutate('ladder', 'delete', { id: tree.id }, { reloadTree: false }); setSelId(null); } }}>Delete ladder</Btn>
                </div>
              </div>

              {/* Buckets */}
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Skill buckets (categories)</div>
                <div className="space-y-2">
                  {buckets.map((b, i) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <div className="flex-1"><EditableText value={b.name} onSave={(v) => mutate('bucket', 'update', { id: b.id, patch: { name: v } })} /></div>
                      <label className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <input type="checkbox" checked={b.is_gate} onChange={(e) => mutate('bucket', 'update', { id: b.id, patch: { is_gate: e.target.checked } })} /> gate
                      </label>
                      <Btn onClick={() => { const ids = moved(buckets.map((x) => x.id), i, -1); if (ids) mutate('bucket', 'reorder', { ids }); }} title="Up">↑</Btn>
                      <Btn onClick={() => { const ids = moved(buckets.map((x) => x.id), i, 1); if (ids) mutate('bucket', 'reorder', { ids }); }} title="Down">↓</Btn>
                      <Btn danger onClick={() => { if (confirm(`Delete bucket "${b.name}" and its items?`)) mutate('bucket', 'delete', { id: b.id }); }}>✕</Btn>
                    </div>
                  ))}
                </div>
                <button onClick={() => mutate('bucket', 'create', { ladder_id: tree.id, name: 'New bucket', sort_order: buckets.length })} className="mt-2 text-xs px-2 py-1 rounded" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>+ bucket</button>
              </div>

              {/* Levels */}
              {levels.map((lvl, li) => {
                const tiers = [...lvl.tiers].sort((a, b) => a.sort_order - b.sort_order);
                return (
                  <div key={lvl.id} className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1"><EditableText value={lvl.name} onSave={(v) => mutate('level', 'update', { id: lvl.id, patch: { name: v } })} style={{ fontWeight: 700 }} /></div>
                      <Btn onClick={() => { const ids = moved(levels.map((x) => x.id), li, -1); if (ids) mutate('level', 'reorder', { ids }); }} title="Up">↑</Btn>
                      <Btn onClick={() => { const ids = moved(levels.map((x) => x.id), li, 1); if (ids) mutate('level', 'reorder', { ids }); }} title="Down">↓</Btn>
                      <Btn danger onClick={() => { if (confirm(`Delete level "${lvl.name}" and its tiers/items?`)) mutate('level', 'delete', { id: lvl.id }); }}>✕</Btn>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-2 mb-3">
                      <EditableText value={lvl.subtitle} placeholder="Subtitle" onSave={(v) => mutate('level', 'update', { id: lvl.id, patch: { subtitle: v } })} />
                      <EditableText value={lvl.timeframe} placeholder="Timeframe (e.g. 1–4 years)" onSave={(v) => mutate('level', 'update', { id: lvl.id, patch: { timeframe: v } })} />
                      <EditableText value={lvl.gate_note} placeholder="Gate to next level" onSave={(v) => mutate('level', 'update', { id: lvl.id, patch: { gate_note: v } })} />
                    </div>

                    {/* Tiers */}
                    <div className="space-y-3 pl-3" style={{ borderLeft: '2px solid var(--border-subtle)' }}>
                      {tiers.map((tier, ti) => (
                        <TierEditor key={tier.id} tier={tier} tierIds={tiers.map((x) => x.id)} index={ti} buckets={buckets} mutate={mutate} />
                      ))}
                      <button onClick={() => mutate('tier', 'create', { level_id: lvl.id, pay_label: '', sort_order: tiers.length })} className="text-xs px-2 py-1 rounded" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>+ wage tier</button>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => mutate('level', 'create', { ladder_id: tree.id, name: 'New level', sort_order: levels.length })} className="text-sm px-3 py-2 rounded-lg" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>+ level</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TierEditor({ tier, tierIds, index, buckets, mutate }: {
  tier: LadderTier; tierIds: string[]; index: number;
  buckets: { id: string; name: string }[];
  mutate: (e: Entity, o: Op, p: Record<string, unknown>, opts?: { reloadTree?: boolean }) => Promise<any>;
}) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-2 mb-2">
        <div style={{ width: 150 }}><EditableText value={tier.pay_label} placeholder="Pay label (e.g. $22 / hr)" onSave={(v) => mutate('tier', 'update', { id: tier.id, patch: { pay_label: v } })} /></div>
        <input type="number" step="0.01" defaultValue={tier.pay_value ?? ''} placeholder="value"
          onBlur={(e) => { const n = e.target.value === '' ? null : Number(e.target.value); if (n !== tier.pay_value) mutate('tier', 'update', { id: tier.id, patch: { pay_value: n } }); }}
          style={{ ...inputStyle, width: 70 }} />
        <select value={tier.pay_kind ?? ''} onChange={(e) => mutate('tier', 'update', { id: tier.id, patch: { pay_kind: e.target.value || null } })} style={{ ...inputStyle, width: 110 }}>
          <option value="">(pay kind)</option>
          <option value="hourly">hourly</option>
          <option value="commission">commission</option>
          <option value="other">other</option>
        </select>
        <div className="flex-1" />
        <Btn onClick={() => { const ids = moved(tierIds, index, -1); if (ids) mutate('tier', 'reorder', { ids }); }} title="Up">↑</Btn>
        <Btn onClick={() => { const ids = moved(tierIds, index, 1); if (ids) mutate('tier', 'reorder', { ids }); }} title="Down">↓</Btn>
        <Btn danger onClick={() => { if (confirm('Delete this tier and its items?')) mutate('tier', 'delete', { id: tier.id }); }}>✕</Btn>
      </div>

      {/* Items grouped by bucket */}
      <div className="grid md:grid-cols-3 gap-3 mt-2">
        {buckets.map((b) => {
          const items = tier.items.filter((it) => it.bucket_id === b.id).sort((a, z) => a.sort_order - z.sort_order);
          return (
            <div key={b.id}>
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{b.name}</div>
              <div className="space-y-1">
                {items.map((it, ii) => (
                  <div key={it.id} className="flex items-start gap-1">
                    <div className="flex-1"><EditableText value={it.text} multiline onSave={(v) => mutate('item', 'update', { id: it.id, patch: { text: v } })} /></div>
                    <div className="flex flex-col gap-0.5">
                      <Btn onClick={() => { const ids = moved(items.map((x) => x.id), ii, -1); if (ids) mutate('item', 'reorder', { ids }); }} title="Up">↑</Btn>
                      <Btn onClick={() => { const ids = moved(items.map((x) => x.id), ii, 1); if (ids) mutate('item', 'reorder', { ids }); }} title="Down">↓</Btn>
                      <Btn danger onClick={() => mutate('item', 'delete', { id: it.id })}>✕</Btn>
                    </div>
                  </div>
                ))}
                <button onClick={() => mutate('item', 'create', { tier_id: tier.id, bucket_id: b.id, text: '', sort_order: items.length })} className="text-xs px-1.5 py-0.5 rounded" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>+ item</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
