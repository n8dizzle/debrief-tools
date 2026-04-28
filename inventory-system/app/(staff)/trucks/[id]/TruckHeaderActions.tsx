'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { retireTruckAction, reactivateTruckAction } from '../actions';

export default function TruckHeaderActions({
  truckId,
  status,
}: {
  truckId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      try { await fn(); } catch { /* ignore */ }
    });
  }

  return (
    <div className="flex gap-2">
      <Link
        href={`/trucks/${truckId}/edit`}
        className="bg-bg-card-hover hover:bg-bg-secondary text-text-primary text-sm rounded px-3 py-2 transition border border-border-default"
      >
        Edit
      </Link>
      {status === 'out_of_service' ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => reactivateTruckAction(truckId))}
          className="bg-christmas-green hover:bg-christmas-green-light disabled:opacity-50 text-white text-sm rounded px-3 py-2 transition flex items-center gap-2"
        >
          {pending && <Loader2 size={14} className="animate-spin" />} Reactivate
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm('Mark this truck out of service?\n\n(Audit history is preserved — re-activate any time.)')) return;
            run(() => retireTruckAction(truckId));
          }}
          className="bg-red-900/30 hover:bg-red-900/50 disabled:opacity-50 text-red-200 text-sm rounded px-3 py-2 transition border border-red-900/40 flex items-center gap-2"
        >
          {pending && <Loader2 size={14} className="animate-spin" />} Retire
        </button>
      )}
    </div>
  );
}
