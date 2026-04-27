'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { sendPOAction, receivePOAction } from './actions';

type Line = {
  id: string;
  sku: string | null;
  material_name: string;
  quantity_ordered: number;
  quantity_received: number;
};

export default function POActions({
  poId,
  status,
  lines,
}: {
  poId: string;
  status: string;
  lines: Line[];
}) {
  const [open, setOpen] = useState<'receive' | null>(null);
  const [pending, startTransition] = useTransition();

  const canSend = ['draft', 'pending_review'].includes(status);
  const canReceive = ['sent', 'partially_received'].includes(status);

  if (!canSend && !canReceive) return null;

  function send() {
    startTransition(async () => {
      try { await sendPOAction(poId); } catch { /* ignore — server action surfaces */ }
    });
  }

  function submitReceive(form: HTMLFormElement) {
    const fd = new FormData(form);
    startTransition(async () => {
      try {
        await receivePOAction(poId, fd);
        setOpen(null);
      } catch {
        /* ignore */
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canSend && (
          <button
            type="button"
            onClick={send}
            disabled={pending}
            className="bg-christmas-green hover:bg-christmas-green-light disabled:opacity-50 text-white text-sm rounded px-3 py-2 transition flex items-center gap-2"
          >
            {pending && <Loader2 size={14} className="animate-spin" />} Send PO
          </button>
        )}
        {canReceive && (
          <button
            type="button"
            onClick={() => setOpen(open === 'receive' ? null : 'receive')}
            className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm rounded px-3 py-2 transition"
          >
            Receive shipment
          </button>
        )}
      </div>

      {open === 'receive' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitReceive(e.currentTarget);
          }}
          className="bg-bg-card border border-border-subtle rounded-lg p-4 space-y-3 text-sm"
        >
          <p className="text-text-muted text-xs">
            Enter quantities received for each line. Leave 0 / blank to skip.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-text-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left py-1.5">SKU</th>
                  <th className="text-left py-1.5">Material</th>
                  <th className="text-right py-1.5">Ordered</th>
                  <th className="text-right py-1.5">Already in</th>
                  <th className="text-right py-1.5">Receive now</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const remaining = Math.max(0, l.quantity_ordered - l.quantity_received);
                  return (
                    <tr key={l.id} className="border-t border-border-subtle">
                      <td className="py-1.5 font-mono text-xs text-text-secondary">{l.sku ?? '—'}</td>
                      <td className="py-1.5">{l.material_name}</td>
                      <td className="py-1.5 text-right">{l.quantity_ordered}</td>
                      <td className="py-1.5 text-right text-text-muted">{l.quantity_received}</td>
                      <td className="py-1.5 text-right">
                        <input
                          type="number"
                          name={`qty[${l.id}]`}
                          min="0"
                          step="0.001"
                          defaultValue={remaining > 0 ? remaining : 0}
                          className="w-24 bg-bg-secondary border border-border-default rounded px-2 py-1 text-right outline-none focus:border-christmas-green"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <label className="block">
            <span className="block text-xs uppercase tracking-wide text-text-muted mb-1">Notes (optional)</span>
            <input
              type="text"
              name="notes"
              className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 outline-none focus:border-christmas-green"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="bg-christmas-green hover:bg-christmas-green-light disabled:opacity-50 text-white font-medium rounded px-4 py-2 flex items-center gap-2"
          >
            {pending && <Loader2 size={14} className="animate-spin" />} Confirm receive
          </button>
        </form>
      )}
    </div>
  );
}
