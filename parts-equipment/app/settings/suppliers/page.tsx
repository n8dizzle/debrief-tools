'use client';
import { useState, useEffect, useCallback } from 'react';
import { useOrders } from '@/hooks/useOrders';

interface Supplier {
  id: number;
  name: string;
  sort_order: number;
  active: boolean;
}

export default function SuppliersSettings() {
  const { showToast, refreshSuppliers } = useOrders();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/suppliers');
      if (res.ok) {
        const { suppliers: data } = await res.json();
        setSuppliers(data || []);
      }
    } catch {
      showToast('Failed to load suppliers', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Reflect any change back to the dropdowns' shared context.
  const syncAndReload = useCallback(async () => {
    await Promise.all([load(), refreshSuppliers()]);
  }, [load, refreshSuppliers]);

  async function addSupplier() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setNewName('');
        showToast('Supplier added', 'success');
        await syncAndReload();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to add supplier', 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function rename(id: number, name: string) {
    const supplier = suppliers.find(s => s.id === id);
    const trimmed = name.trim();
    if (!supplier || !trimmed || trimmed === supplier.name) {
      // Nothing changed — restore canonical value.
      setSuppliers(prev => prev.map(s => (s.id === id ? { ...s, name: supplier?.name || s.name } : s)));
      return;
    }
    const res = await fetch(`/api/suppliers/${id}`, {
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
    // Optimistic.
    setSuppliers(prev => prev.map(s => (s.id === id ? { ...s, active } : s)));
    const res = await fetch(`/api/suppliers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      await refreshSuppliers();
    } else {
      showToast('Update failed', 'error');
      await load();
    }
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Remove "${name}"? Existing orders keep this supplier name; it just won't be selectable anymore.`)) return;
    const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Supplier removed', 'success');
      await syncAndReload();
    } else {
      showToast('Delete failed', 'error');
    }
  }

  async function move(id: number, dir: -1 | 1) {
    const idx = suppliers.findIndex(s => s.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= suppliers.length) return;
    const reordered = [...suppliers];
    [reordered[idx], reordered[swap]] = [reordered[swap], reordered[idx]];
    setSuppliers(reordered); // optimistic
    const res = await fetch('/api/suppliers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map(s => s.id) }),
    });
    if (res.ok) {
      await refreshSuppliers();
    } else {
      showToast('Reorder failed', 'error');
      await load();
    }
  }

  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius, 10px)', padding: 20 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Suppliers</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Controls the <strong>Supplier / Ordered From</strong> dropdown across the Service and Install boards,
        the order detail modal, and the new-order form. Inactive suppliers are hidden from the dropdowns but keep their history.
      </p>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {suppliers.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button className="btn" onClick={() => move(s.id, -1)} disabled={i === 0}
                    style={{ padding: '0 6px', fontSize: 11, lineHeight: '16px', opacity: i === 0 ? 0.3 : 1 }} title="Move up">↑</button>
                  <button className="btn" onClick={() => move(s.id, 1)} disabled={i === suppliers.length - 1}
                    style={{ padding: '0 6px', fontSize: 11, lineHeight: '16px', opacity: i === suppliers.length - 1 ? 0.3 : 1 }} title="Move down">↓</button>
                </div>
                <input
                  defaultValue={s.name}
                  key={`${s.id}-${s.name}`}
                  onBlur={e => rename(s.id, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm, 6px)', fontSize: 14,
                    border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
                    opacity: s.active ? 1 : 0.5,
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={s.active} onChange={e => toggleActive(s.id, e.target.checked)} />
                  Active
                </label>
                <button className="btn" onClick={() => remove(s.id, s.name)}
                  style={{ padding: '6px 10px', fontSize: 12, color: 'var(--red)' }} title="Remove">✕</button>
              </div>
            ))}
            {suppliers.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No suppliers yet — add one below.</p>}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSupplier(); }}
              placeholder="New supplier name…"
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm, 6px)', fontSize: 14,
                border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
              }}
            />
            <button className="btn btn-primary" onClick={addSupplier} disabled={!newName.trim() || busy}>+ Add supplier</button>
          </div>
        </>
      )}
    </section>
  );
}
