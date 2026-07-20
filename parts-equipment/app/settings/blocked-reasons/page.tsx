'use client';
import { useState, useEffect, useCallback } from 'react';
import { useOrders } from '@/hooks/useOrders';

interface BlockedReason {
  id: number;
  value: string;
  label: string;
  sort_order: number;
  active: boolean;
}

export default function BlockedReasonsSettings() {
  const { showToast, refreshBlockedReasons } = useOrders();

  const [reasons, setReasons] = useState<BlockedReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/blocked-reasons');
      if (res.ok) {
        const { blockedReasons: data } = await res.json();
        setReasons(data || []);
      }
    } catch {
      showToast('Failed to load blocked reasons', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const syncAndReload = useCallback(async () => {
    await Promise.all([load(), refreshBlockedReasons()]);
  }, [load, refreshBlockedReasons]);

  async function addReason() {
    const label = newLabel.trim();
    if (!label || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/blocked-reasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      if (res.ok) {
        setNewLabel('');
        showToast('Reason added', 'success');
        await syncAndReload();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to add reason', 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function rename(id: number, label: string) {
    const reason = reasons.find(r => r.id === id);
    const trimmed = label.trim();
    if (!reason || !trimmed || trimmed === reason.label) {
      setReasons(prev => prev.map(r => (r.id === id ? { ...r, label: reason?.label || r.label } : r)));
      return;
    }
    const res = await fetch(`/api/blocked-reasons/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: trimmed }),
    });
    if (res.ok) {
      showToast('Renamed', 'success');
      await syncAndReload();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Rename failed', 'error');
      await load();
    }
  }

  async function toggleActive(id: number, active: boolean) {
    setReasons(prev => prev.map(r => (r.id === id ? { ...r, active } : r)));
    const res = await fetch(`/api/blocked-reasons/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      await refreshBlockedReasons();
    } else {
      showToast('Update failed', 'error');
      await load();
    }
  }

  async function remove(id: number, label: string) {
    if (!confirm(`Remove "${label}"? Existing orders keep this reason; it just won't be selectable anymore.`)) return;
    const res = await fetch(`/api/blocked-reasons/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Reason removed', 'success');
      await syncAndReload();
    } else {
      showToast('Delete failed', 'error');
    }
  }

  async function move(id: number, dir: -1 | 1) {
    const idx = reasons.findIndex(r => r.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= reasons.length) return;
    const reordered = [...reasons];
    [reordered[idx], reordered[swap]] = [reordered[swap], reordered[idx]];
    setReasons(reordered);
    const res = await fetch('/api/blocked-reasons', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map(r => r.id) }),
    });
    if (res.ok) {
      await refreshBlockedReasons();
    } else {
      showToast('Reorder failed', 'error');
      await load();
    }
  }

  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius, 10px)', padding: 20 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Blocked Reasons</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Parked reasons shown in the <strong>Blocked</strong> dropdown on the Service and Install boards and the
        order detail modal — why a job is stalled while still in the pipeline. Inactive reasons are hidden from
        the dropdowns but keep their history.
      </p>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reasons.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button className="btn" onClick={() => move(r.id, -1)} disabled={i === 0}
                    style={{ padding: '0 6px', fontSize: 11, lineHeight: '16px', opacity: i === 0 ? 0.3 : 1 }} title="Move up">↑</button>
                  <button className="btn" onClick={() => move(r.id, 1)} disabled={i === reasons.length - 1}
                    style={{ padding: '0 6px', fontSize: 11, lineHeight: '16px', opacity: i === reasons.length - 1 ? 0.3 : 1 }} title="Move down">↓</button>
                </div>
                <input
                  defaultValue={r.label}
                  key={`${r.id}-${r.label}`}
                  onBlur={e => rename(r.id, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm, 6px)', fontSize: 14,
                    border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
                    opacity: r.active ? 1 : 0.5,
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={r.active} onChange={e => toggleActive(r.id, e.target.checked)} />
                  Active
                </label>
                <button className="btn" onClick={() => remove(r.id, r.label)}
                  style={{ padding: '6px 10px', fontSize: 12, color: 'var(--red)' }} title="Remove">✕</button>
              </div>
            ))}
            {reasons.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No blocked reasons yet — add one below.</p>}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addReason(); }}
              placeholder="New blocked reason…"
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm, 6px)', fontSize: 14,
                border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
              }}
            />
            <button className="btn btn-primary" onClick={addReason} disabled={!newLabel.trim() || busy}>+ Add reason</button>
          </div>
        </>
      )}
    </section>
  );
}
