'use client';

import { useTransition, useRef } from 'react';
import { Check, Loader2 } from 'lucide-react';

interface MinMaxFormProps {
  action: (formData: FormData) => Promise<void>;
  minQty: number;
  maxQty: number | null;
}

export default function MinMaxForm({ action, minQty, maxQty }: MinMaxFormProps) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await action(formData);
      } catch {
        // ignore — server action handles errors
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex items-center gap-1">
      <input
        type="number"
        name="min"
        defaultValue={minQty}
        min={0}
        placeholder="Min"
        className="bg-transparent border border-border-subtle rounded px-1.5 py-0.5 text-xs w-16 text-center focus:border-christmas-green outline-none"
      />
      <span className="text-text-muted text-xs">/</span>
      <input
        type="number"
        name="max"
        defaultValue={maxQty ?? ''}
        min={0}
        placeholder="Max"
        className="bg-transparent border border-border-subtle rounded px-1.5 py-0.5 text-xs w-16 text-center focus:border-christmas-green outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        title="Save min/max"
        className="flex items-center justify-center w-6 h-6 rounded text-christmas-green hover:bg-christmas-green/10 disabled:opacity-40 transition flex-shrink-0"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
      </button>
    </form>
  );
}
