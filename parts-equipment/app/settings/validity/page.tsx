'use client';
import { useState, useEffect, useCallback } from 'react';
import { useOrders } from '@/hooks/useOrders';

interface Validity {
  id: number;
  name: string;
  sort_order: number;
  active: boolean;
}

export default function ValiditySettings() {
  const { showToast, refreshValidities } = useOrders();

  const [validities, setValidities] = useState<Validity[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/validities');
      if (res.ok) {
        const { validities: data } = await res.json();
        setValidities(data || []);
      }
    } catch {
      showToast('Failed to load validity options', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const syncAndReload = useCallback(async () => {
    await Promise.all([load(), refreshValidities()]);
  }, [load, refreshValidities]);

  async function addOption() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/validities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setNewName('');
        showToast('Option added', 'success');
        await syncAndReload();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to add option', 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function rename(id: number, name: string) {
    const opt = validities.find(v => v.id === id);
    const trimmed = name.trim();
    if (!opt || !trimmed || trimmed === opt.name) {
      setValidities(prev => prev.map(v => (v.id === id ? { ...v, name: opt?.name || v.name } : v)));
      return;
    }
    const res = await fetch(`/api/validities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
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
    setValidities(prev => prev.map(v => (v.id === id ? { ...v, active } : v)));
    const res = await fetch(`/api/validities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      await refreshValidities();
    } else {
      showToast('Update failed', 'error');
      await load();
    }
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Remove "${name}"? Existing orders keep this value; it just won't be selectable anymore.`)) return;
    const res = await fetch(`/api/validities/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Option removed', 'success');
      await syncAndReload();
    } else {
      showToast('Delete failed', 'error');
    }
  }

  async function move(id: number, dir: -1 | 1) {
    const idx = validities.findIndex(v => v.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= validities.length) return;
    const reordered = [...validities];
    [reordered[idx], reordered[swap]] = [reordered[swap], reordered[idx]];
    setValidities(reordered);
    const res = await fetch('/api/validities', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map(v => v.id) }),
    });
    if (res.ok) {
      await refreshValidities();
    } else {
      showToast('Reorder failed', 'error');
      await load();
    }
  }

  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius, 10px)', padding: 20 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Validity</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Controls the <strong>Validity</strong> dropdown on the Service board. Add the options your team should be able to pick.
        Inactive options are hidden from the dropdown but keep their history.
      </p>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {validities.map((v, i) => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button className="btn" onClick={() => move(v.id, -1)} disabled={i === 0}
                    style={{ padding: '0 6px', fontSize: 11, lineHeight: '16px', opacity: i === 0 ? 0.3 : 1 }} title="Move up">↑</button>
                  <button className="btn" onClick={() => move(v.id, 1)} disabled={i === validities.length - 1}
                    style={{ padding: '0 6px', fontSize: 11, lineHeight: '16px', opacity: i === validities.length - 1 ? 0.3 : 1 }} title="Move down">↓</button>
                </div>
                <input
                  defaultValue={v.name}
                  key={`${v.id}-${v.name}`}
                  onBlur={e => rename(v.id, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm, 6px)', fontSize: 14,
                    border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
                    opacity: v.active ? 1 : 0.5,
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={v.active} onChange={e => toggleActive(v.id, e.target.checked)} />
                  Active
                </label>
                <button className="btn" onClick={() => remove(v.id, v.name)}
                  style={{ padding: '6px 10px', fontSize: 12, color: 'var(--red)' }} title="Remove">✕</button>
              </div>
            ))}
            {validities.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No options yet — add one below.</p>}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addOption(); }}
              placeholder="New validity option…"
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm, 6px)', fontSize: 14,
                border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
              }}
            />
            <button className="btn btn-primary" onClick={addOption} disabled={!newName.trim() || busy}>+ Add option</button>
          </div>
        </>
      )}
    </section>
  );
}
