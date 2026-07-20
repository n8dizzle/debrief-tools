'use client';
import { useState, useEffect, useCallback } from 'react';
import { useOrders } from '@/hooks/useOrders';

interface Location {
  id: number;
  name: string;
  sort_order: number;
  active: boolean;
}

export default function LocationsSettings() {
  const { showToast, refreshLocations } = useOrders();

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/locations');
      if (res.ok) {
        const { locations: data } = await res.json();
        setLocations(data || []);
      }
    } catch {
      showToast('Failed to load locations', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const syncAndReload = useCallback(async () => {
    await Promise.all([load(), refreshLocations()]);
  }, [load, refreshLocations]);

  async function addLocation() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setNewName('');
        showToast('Location added', 'success');
        await syncAndReload();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to add location', 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function rename(id: number, name: string) {
    const loc = locations.find(l => l.id === id);
    const trimmed = name.trim();
    if (!loc || !trimmed || trimmed === loc.name) {
      setLocations(prev => prev.map(l => (l.id === id ? { ...l, name: loc?.name || l.name } : l)));
      return;
    }
    const res = await fetch(`/api/locations/${id}`, {
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
    setLocations(prev => prev.map(l => (l.id === id ? { ...l, active } : l)));
    const res = await fetch(`/api/locations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      await refreshLocations();
    } else {
      showToast('Update failed', 'error');
      await load();
    }
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Remove "${name}"? Existing orders keep this location; it just won't be selectable anymore.`)) return;
    const res = await fetch(`/api/locations/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Location removed', 'success');
      await syncAndReload();
    } else {
      showToast('Delete failed', 'error');
    }
  }

  async function move(id: number, dir: -1 | 1) {
    const idx = locations.findIndex(l => l.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= locations.length) return;
    const reordered = [...locations];
    [reordered[idx], reordered[swap]] = [reordered[swap], reordered[idx]];
    setLocations(reordered);
    const res = await fetch('/api/locations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map(l => l.id) }),
    });
    if (res.ok) {
      await refreshLocations();
    } else {
      showToast('Reorder failed', 'error');
      await load();
    }
  }

  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius, 10px)', padding: 20 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Locations</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Physical places a part can be, shown in the <strong>Location</strong> dropdown on the Service and Install
        boards and the order detail modal. Pipeline status lives in <strong>Stage</strong>, not here. Inactive
        locations are hidden from the dropdowns but keep their history.
      </p>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {locations.map((l, i) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button className="btn" onClick={() => move(l.id, -1)} disabled={i === 0}
                    style={{ padding: '0 6px', fontSize: 11, lineHeight: '16px', opacity: i === 0 ? 0.3 : 1 }} title="Move up">↑</button>
                  <button className="btn" onClick={() => move(l.id, 1)} disabled={i === locations.length - 1}
                    style={{ padding: '0 6px', fontSize: 11, lineHeight: '16px', opacity: i === locations.length - 1 ? 0.3 : 1 }} title="Move down">↓</button>
                </div>
                <input
                  defaultValue={l.name}
                  key={`${l.id}-${l.name}`}
                  onBlur={e => rename(l.id, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm, 6px)', fontSize: 14,
                    border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
                    opacity: l.active ? 1 : 0.5,
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={l.active} onChange={e => toggleActive(l.id, e.target.checked)} />
                  Active
                </label>
                <button className="btn" onClick={() => remove(l.id, l.name)}
                  style={{ padding: '6px 10px', fontSize: 12, color: 'var(--red)' }} title="Remove">✕</button>
              </div>
            ))}
            {locations.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No locations yet — add one below.</p>}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addLocation(); }}
              placeholder="New location name…"
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm, 6px)', fontSize: 14,
                border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
              }}
            />
            <button className="btn btn-primary" onClick={addLocation} disabled={!newName.trim() || busy}>+ Add location</button>
          </div>
        </>
      )}
    </section>
  );
}
