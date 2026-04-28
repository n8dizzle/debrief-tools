'use client';

import { useState, useTransition } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { assignTechToTruckAction, unassignTechAction } from '../actions';

type Tech = { id: string; name: string; email: string };

export default function TechAssignmentCard({
  truckId,
  assigned,
  candidates,
}: {
  truckId: string;
  assigned: Array<{ id: string; name: string; role: string }>;
  candidates: Tech[];
}) {
  const [open, setOpen] = useState(false);
  const [pickedId, setPickedId] = useState(candidates[0]?.id ?? '');
  const [pending, startTransition] = useTransition();

  function add() {
    if (!pickedId) return;
    const fd = new FormData();
    fd.set('user_id', pickedId);
    startTransition(async () => {
      try {
        await assignTechToTruckAction(truckId, fd);
        setOpen(false);
      } catch { /* ignore */ }
    });
  }

  function remove(userId: string) {
    startTransition(async () => {
      try { await unassignTechAction(truckId, userId); } catch { /* ignore */ }
    });
  }

  return (
    <div className="bg-bg-card border border-border-subtle rounded-lg p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-medium text-text-primary">Assigned technicians</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-christmas-green-light hover:text-christmas-green flex items-center gap-1"
        >
          <Plus size={14} /> Assign
        </button>
      </div>

      {assigned.length === 0 ? (
        <p className="text-sm text-text-muted">No technicians assigned to this truck.</p>
      ) : (
        <ul className="space-y-2">
          {assigned.map((u) => (
            <li key={u.id} className="flex items-center justify-between text-sm">
              <div>
                <div className="text-text-primary">{u.name}</div>
                <div className="text-xs text-text-muted capitalize">{u.role.replace('_', ' ')}</div>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(u.id)}
                className="text-text-muted hover:text-red-300 transition disabled:opacity-50"
                aria-label="Unassign"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-4 pt-4 border-t border-border-subtle space-y-3">
          <select
            value={pickedId}
            onChange={(e) => setPickedId(e.target.value)}
            className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
          >
            {candidates.length === 0 && <option value="">No available technicians</option>}
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.email}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={add}
            disabled={pending || !pickedId}
            className="w-full bg-christmas-green hover:bg-christmas-green-light disabled:opacity-50 text-white text-sm font-medium rounded px-3 py-2 transition flex items-center justify-center gap-2"
          >
            {pending && <Loader2 size={14} className="animate-spin" />} Assign technician
          </button>
        </div>
      )}
    </div>
  );
}
