'use client';

import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { lockBatchAction, approveBatchAction, pickBatchAction, completeBatchAction } from './actions';

export default function BatchActions({ batchId, status }: { batchId: string; status: string }) {
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
      } catch {
        /* server action error surfaces via redirect/throw; UI just stays */
      }
    });
  }

  const buttons = [
    { show: status === 'collecting', label: 'Lock batch', onClick: () => run(() => lockBatchAction(batchId)) },
    { show: status === 'locked', label: 'Approve all', onClick: () => run(() => approveBatchAction(batchId)) },
    { show: status === 'approved', label: 'Start picking', onClick: () => run(() => pickBatchAction(batchId)) },
    { show: status === 'picked', label: 'Mark complete', onClick: () => run(() => completeBatchAction(batchId)) },
  ];

  const visible = buttons.filter((b) => b.show);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((b) => (
        <button
          key={b.label}
          type="button"
          disabled={pending}
          onClick={b.onClick}
          className="bg-christmas-green hover:bg-christmas-green-light disabled:opacity-50 text-white text-sm font-medium rounded px-3 py-2 transition flex items-center gap-2"
        >
          {pending && <Loader2 size={14} className="animate-spin" />} {b.label}
        </button>
      ))}
    </div>
  );
}
