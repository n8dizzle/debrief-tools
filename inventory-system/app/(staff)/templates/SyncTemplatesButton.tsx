'use client';

import { useState, useTransition } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { syncTemplatesAction } from './actions';

export default function SyncTemplatesButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      const r = await syncTemplatesAction();
      if (r.ok && r.skipped) setResult(r.reason ?? 'Skipped.');
      else if (r.ok) setResult(`Synced ${r.synced} template${r.synced === 1 ? '' : 's'}${r.failed ? ` (${r.failed} failed)` : ''}`);
      else setResult(r.reason);
    });
  }

  return (
    <div className="flex items-start gap-3">
      {result && <span className="text-xs text-text-secondary max-w-xs text-right">{result}</span>}
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="bg-bg-card-hover hover:bg-bg-secondary disabled:opacity-50 text-text-primary text-sm rounded px-3 py-2 transition border border-border-default flex items-center gap-2 shrink-0"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        Sync from ServiceTitan
      </button>
    </div>
  );
}
