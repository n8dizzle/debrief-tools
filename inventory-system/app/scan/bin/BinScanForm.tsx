'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, Loader2, RotateCcw, Search } from 'lucide-react';
import { BarcodeInput } from '@/components/scanner/BarcodeInput';

type Bin = {
  id: string;
  bin_label: string;
  technician_name?: string;
  warehouse_name?: string;
  status: string;
};

type Result = {
  message: string;
  transferred: number;
  details?: Array<{ material_id: string; quantity: number }>;
};

export default function BinScanForm() {
  const [barcode, setBarcode] = useState('');
  const [bin, setBin] = useState<Bin | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setBarcode('');
    setBin(null);
    setResult(null);
    setError(null);
  }

  async function lookupAndScan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = barcode.trim();
    if (!code) return;
    startTransition(async () => {
      // 1. Look up bin
      const r1 = await fetch(`/api/tech-bins/by-barcode/${encodeURIComponent(code)}`, { cache: 'no-store' });
      if (!r1.ok) {
        const j = await r1.json().catch(() => ({}));
        setError(j.error || `No bin found for barcode ${code}`);
        return;
      }
      const { bin: foundBin } = (await r1.json()) as { bin: Bin };
      setBin(foundBin);

      // 2. Trigger scan (transfers items)
      const r2 = await fetch(`/api/tech-bins/${foundBin.id}/scan`, { method: 'POST' });
      if (!r2.ok) {
        const j = await r2.json().catch(() => ({}));
        setError(j.error || `Scan failed (${r2.status})`);
        return;
      }
      setResult((await r2.json()) as Result);
    });
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="bg-christmas-green/15 border border-christmas-green/40 rounded-lg p-5 text-center">
          <Check size={36} className="mx-auto text-christmas-green-light" />
          <div className="mt-3 text-lg font-medium text-christmas-cream">{result.message}</div>
          {result.details && result.details.length > 0 && (
            <div className="mt-3 text-xs text-text-secondary text-left">
              {result.details.map((d, i) => (
                <div key={i}>
                  {d.quantity} × <span className="text-text-muted">material {d.material_id.slice(0, 8)}…</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={reset}
          className="w-full bg-christmas-green hover:bg-christmas-green-light text-white font-medium rounded-lg px-4 py-3 flex items-center justify-center gap-2"
        >
          <RotateCcw size={16} /> Scan another bin
        </button>
        <Link href="/scan" className="block text-center text-sm text-text-secondary py-2">
          Back to scanner home
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={lookupAndScan} className="space-y-4">
      <label className="block">
        <span className="block text-xs uppercase tracking-wide text-text-muted mb-2">Bin barcode</span>
        <BarcodeInput
          value={barcode}
          onChange={(e) => setBarcode((e.target as HTMLInputElement).value)}
          placeholder="Scan or type…"
        />
      </label>
      {bin && !error && !result && (
        <div className="bg-bg-card border border-border-subtle rounded-lg p-3 text-xs text-text-secondary">
          Found bin <strong className="text-text-primary">{bin.bin_label}</strong>
          {bin.technician_name ? ` for ${bin.technician_name}` : ''} — running scan…
        </div>
      )}
      {error && (
        <div className="text-sm text-red-300 bg-red-900/20 border border-red-900/40 rounded px-3 py-2">{error}</div>
      )}
      <button
        type="submit"
        disabled={pending || !barcode}
        className="w-full bg-christmas-green hover:bg-christmas-green-light disabled:opacity-50 text-white font-medium rounded-lg px-4 py-3 flex items-center justify-center gap-2"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Scan bin
      </button>
    </form>
  );
}
