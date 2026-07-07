'use client';

import { useState, useEffect, useCallback } from 'react';

// Manager-controlled recall root-cause taxonomy editor (Settings → Recall Root Causes).
// Backed by /api/settings/root-causes. The label is the value stored on investigations, so
// renaming cascades to historical recalls (the API reports how many were relabeled).

type Cause = {
  id: string;
  label: string;
  sort_order: number;
  archived_at: string | null;
  usage_count: number;
};

export default function RootCausesSettings({ canEdit }: { canEdit: boolean }) {
  const [causes, setCauses] = useState<Cause[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const flash = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/root-causes');
      const data = await res.json();
      if (res.ok) setCauses(data.causes || []);
      else flash('error', data.error || 'Failed to load.');
    } catch {
      flash('error', 'Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = causes.filter(c => !c.archived_at).sort((a, b) => a.sort_order - b.sort_order);
  const archived = causes.filter(c => c.archived_at).sort((a, b) => a.label.localeCompare(b.label));

  const patch = async (bodyObj: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
    setBusy(true);
    try {
      const res = await fetch('/api/settings/root-causes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj),
      });
      const data = await res.json();
      if (!res.ok) { flash('error', data.error || 'Action failed.'); return null; }
      return data;
    } catch {
      flash('error', 'Network error.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;
    setBusy(true);
    try {
      const res = await fetch('/api/settings/root-causes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (!res.ok) { flash('error', data.error || 'Failed to add.'); return; }
      setNewLabel('');
      flash('success', `Added "${label}".`);
      await load();
    } catch {
      flash('error', 'Network error.');
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (c: Cause) => {
    const label = editLabel.trim();
    if (!label || label === c.label) { setEditingId(null); return; }
    const data = await patch({ id: c.id, action: 'rename', label });
    if (data) {
      const n = typeof data.relabeled === 'number' ? data.relabeled : 0;
      flash('success', n > 0 ? `Renamed to "${label}" and relabeled ${n} recall${n === 1 ? '' : 's'}.` : `Renamed to "${label}".`);
      setEditingId(null);
      await load();
    }
  };

  const handleArchive = async (c: Cause) => {
    if (!confirm(`Archive "${c.label}"? It will disappear from the picker and AI options but stay on the ${c.usage_count} recall${c.usage_count === 1 ? '' : 's'} already using it.`)) return;
    const data = await patch({ id: c.id, action: 'archive' });
    if (data) { flash('success', `Archived "${c.label}".`); await load(); }
  };

  const handleUnarchive = async (c: Cause) => {
    const data = await patch({ id: c.id, action: 'unarchive' });
    if (data) { flash('success', `Restored "${c.label}".`); await load(); }
  };

  const handleMove = async (c: Cause, dir: -1 | 1) => {
    const idx = active.findIndex(a => a.id === c.id);
    const neighbor = active[idx + dir];
    if (!neighbor) return;
    // Swap sort_order with the neighbor.
    setBusy(true);
    await patch({ id: c.id, action: 'reorder', sort_order: neighbor.sort_order });
    await patch({ id: neighbor.id, action: 'reorder', sort_order: c.sort_order });
    await load();
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>
          Recall Root Causes
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          The categories used to tag every recall. Renaming updates recalls already tagged with the
          old name (so Trends stays one bucket). Archiving hides a cause from new investigations but
          keeps it on historical recalls.
        </p>

        {message && (
          <div
            className="mb-4 p-3 rounded-lg text-sm"
            style={{
              backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: message.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
            }}
          >
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : (
          <div className="space-y-2">
            {active.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                {canEdit && (
                  <div className="flex flex-col">
                    <button
                      onClick={() => handleMove(c, -1)}
                      disabled={busy || i === 0}
                      style={{ opacity: i === 0 ? 0.25 : 0.7, lineHeight: 1, color: 'var(--text-muted)' }}
                      title="Move up"
                    >▲</button>
                    <button
                      onClick={() => handleMove(c, 1)}
                      disabled={busy || i === active.length - 1}
                      style={{ opacity: i === active.length - 1 ? 0.25 : 0.7, lineHeight: 1, color: 'var(--text-muted)' }}
                      title="Move down"
                    >▼</button>
                  </div>
                )}

                {editingId === c.id ? (
                  <input
                    autoFocus
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(c); if (e.key === 'Escape') setEditingId(null); }}
                    className="input flex-1"
                    style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--christmas-cream)' }}
                  />
                ) : (
                  <span className="flex-1 font-medium" style={{ color: 'var(--christmas-cream)' }}>{c.label}</span>
                )}

                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {c.usage_count} recall{c.usage_count === 1 ? '' : 's'}
                </span>

                {canEdit && (editingId === c.id ? (
                  <>
                    <button onClick={() => handleRename(c)} disabled={busy} className="btn btn-primary text-xs px-3 py-1">Save</button>
                    <button onClick={() => setEditingId(null)} className="btn text-xs px-3 py-1" style={{ color: 'var(--text-muted)' }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditingId(c.id); setEditLabel(c.label); }}
                      className="btn text-xs px-3 py-1"
                      style={{ color: 'var(--text-secondary)' }}
                    >Rename</button>
                    <button
                      onClick={() => handleArchive(c)}
                      disabled={busy || active.length <= 1}
                      className="btn text-xs px-3 py-1"
                      style={{ color: 'var(--status-error)', opacity: active.length <= 1 ? 0.4 : 1 }}
                      title={active.length <= 1 ? 'Cannot archive the last active cause' : 'Archive'}
                    >Archive</button>
                  </>
                ))}
              </div>
            ))}

            {canEdit && (
              <div className="flex items-center gap-2 pt-2">
                <input
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                  placeholder="New root cause…"
                  className="input flex-1"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)' }}
                />
                <button onClick={handleAdd} disabled={busy || !newLabel.trim()} className="btn btn-primary flex-shrink-0">Add cause</button>
              </div>
            )}
          </div>
        )}
      </div>

      {archived.length > 0 && (
        <div className="card">
          <button
            onClick={() => setShowArchived(v => !v)}
            className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {showArchived ? '▾' : '▸'} Archived ({archived.length})
          </button>
          {showArchived && (
            <div className="space-y-2 mt-3">
              {archived.map(c => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)', opacity: 0.7 }}
                >
                  <span className="flex-1" style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{c.label}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.usage_count} recall{c.usage_count === 1 ? '' : 's'}</span>
                  {canEdit && (
                    <button onClick={() => handleUnarchive(c)} disabled={busy} className="btn text-xs px-3 py-1" style={{ color: 'var(--christmas-green)' }}>Restore</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
