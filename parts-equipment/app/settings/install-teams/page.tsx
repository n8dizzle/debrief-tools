'use client';
import { useState, useEffect, useCallback } from 'react';
import { useOrders } from '@/hooks/useOrders';

interface Team {
  id: number;
  name: string;
  sort_order: number;
  active: boolean;
}

export default function InstallTeamsSettings() {
  const { showToast, refreshInstallTeams } = useOrders();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/install-teams');
      if (res.ok) {
        const { teams: data } = await res.json();
        setTeams(data || []);
      }
    } catch {
      showToast('Failed to load teams', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Reflect any change back to the dropdowns' shared context.
  const syncAndReload = useCallback(async () => {
    await Promise.all([load(), refreshInstallTeams()]);
  }, [load, refreshInstallTeams]);

  async function addTeam() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/install-teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setNewName('');
        showToast('Team added', 'success');
        await syncAndReload();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to add team', 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function rename(id: number, name: string) {
    const team = teams.find(t => t.id === id);
    const trimmed = name.trim();
    if (!team || !trimmed || trimmed === team.name) {
      // Nothing changed — restore canonical value.
      setTeams(prev => prev.map(t => (t.id === id ? { ...t, name: team?.name || t.name } : t)));
      return;
    }
    const res = await fetch(`/api/install-teams/${id}`, {
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
    setTeams(prev => prev.map(t => (t.id === id ? { ...t, active } : t)));
    const res = await fetch(`/api/install-teams/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      await refreshInstallTeams();
    } else {
      showToast('Update failed', 'error');
      await load();
    }
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Remove "${name}"? Existing orders keep this team name; it just won't be selectable anymore.`)) return;
    const res = await fetch(`/api/install-teams/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Team removed', 'success');
      await syncAndReload();
    } else {
      showToast('Delete failed', 'error');
    }
  }

  async function move(id: number, dir: -1 | 1) {
    const idx = teams.findIndex(t => t.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= teams.length) return;
    const reordered = [...teams];
    [reordered[idx], reordered[swap]] = [reordered[swap], reordered[idx]];
    setTeams(reordered); // optimistic
    const res = await fetch('/api/install-teams', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map(t => t.id) }),
    });
    if (res.ok) {
      await refreshInstallTeams();
    } else {
      showToast('Reorder failed', 'error');
      await load();
    }
  }

  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius, 10px)', padding: 20 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Install Teams</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Controls the <strong>Install team</strong> dropdown on the Install board and in order detail.
        Inactive teams are hidden from the dropdowns but keep their history.
      </p>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {teams.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button className="btn" onClick={() => move(t.id, -1)} disabled={i === 0}
                    style={{ padding: '0 6px', fontSize: 11, lineHeight: '16px', opacity: i === 0 ? 0.3 : 1 }} title="Move up">↑</button>
                  <button className="btn" onClick={() => move(t.id, 1)} disabled={i === teams.length - 1}
                    style={{ padding: '0 6px', fontSize: 11, lineHeight: '16px', opacity: i === teams.length - 1 ? 0.3 : 1 }} title="Move down">↓</button>
                </div>
                <input
                  defaultValue={t.name}
                  key={`${t.id}-${t.name}`}
                  onBlur={e => rename(t.id, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm, 6px)', fontSize: 14,
                    border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
                    opacity: t.active ? 1 : 0.5,
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={t.active} onChange={e => toggleActive(t.id, e.target.checked)} />
                  Active
                </label>
                <button className="btn" onClick={() => remove(t.id, t.name)}
                  style={{ padding: '6px 10px', fontSize: 12, color: 'var(--red)' }} title="Remove">✕</button>
              </div>
            ))}
            {teams.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No teams yet — add one below.</p>}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTeam(); }}
              placeholder="New team name…"
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm, 6px)', fontSize: 14,
                border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
              }}
            />
            <button className="btn btn-primary" onClick={addTeam} disabled={!newName.trim() || busy}>+ Add team</button>
          </div>
        </>
      )}
    </section>
  );
}
