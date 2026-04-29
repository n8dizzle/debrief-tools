'use client';

import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { applyTruckTemplateAction } from '../actions';

export default function ApplyTemplateButton({ truckId }: { truckId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm('Apply template? This will set min quantities for all template items on this truck. Existing qty on hand is not changed.')) return;
    startTransition(async () => {
      try {
        await applyTruckTemplateAction(truckId);
      } catch {
        // ignore — page will still revalidate
      }
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="flex items-center gap-2 bg-christmas-green hover:bg-christmas-green-light disabled:opacity-50 text-white text-xs font-medium rounded px-3 py-1.5 transition w-full justify-center"
    >
      {pending && <Loader2 size={12} className="animate-spin" />}
      Apply template
    </button>
  );
}
