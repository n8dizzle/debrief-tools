'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, Loader2, RotateCcw, Search, X } from 'lucide-react';
import { BarcodeInput } from '@/components/scanner/BarcodeInput';

type Material = {
  id: string;
  sku: string;
  name: string;
  unit_of_measure: string | null;
  unit_cost: number | string | null;
  total_truck_stock?: string | number;
};

type Job = { id: string; label: string; status: string };

type Step = 'scan' | 'qty' | 'success';

export default function ConsumeForm({ truck, jobs }: { truck: { id: string; truck_number: string }; jobs: Job[] }) {
  const [step, setStep] = useState<Step>('scan');
  const [barcode, setBarcode] = useState('');
  const [material, setMaterial] = useState<Material | null>(null);
  const [qty, setQty] = useState('1');
  const [jobId, setJobId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Auto-select first job if any
  useEffect(() => {
    if (!jobId && jobs[0]) setJobId(jobs[0].id);
  }, [jobs, jobId]);

  function reset() {
    setStep('scan');
    setBarcode('');
    setMaterial(null);
    setQty('1');
    setNotes('');
    setError(null);
  }

  async function lookupBarcode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = barcode.trim();
    if (!code) return;
    startTransition(async () => {
      const res = await fetch(`/api/materials/by-barcode/${encodeURIComponent(code)}`, { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `No material found for barcode ${code}`);
        return;
      }
      const data = (await res.json()) as { material: Material };
      setMaterial(data.material);
      setStep('qty');
    });
  }

  async function submitConsume() {
    if (!material) return;
    setError(null);
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) {
      setError('Quantity must be a positive number.');
      return;
    }
    if (!jobId) {
      setError('Pick a job for this consumption.');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/stock/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: material.id,
          movement_type: 'consumed_on_job',
          quantity: n,
          from_truck_id: truck.id,
          st_job_id: jobId,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Failed (${res.status})`);
        return;
      }
      setStep('success');
    });
  }

  if (step === 'success') {
    return (
      <div className="space-y-4">
        <div className="bg-christmas-green/15 border border-christmas-green/40 rounded-lg p-5 text-center">
          <Check size={36} className="mx-auto text-christmas-green-light" />
          <div className="mt-3 text-lg font-medium text-christmas-cream">Recorded</div>
          <div className="mt-1 text-sm text-text-secondary">
            {qty} × {material?.name} consumed on job
          </div>
          <div className="mt-1 text-xs text-text-muted">
            A restock line was queued for your truck.
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="w-full bg-christmas-green hover:bg-christmas-green-light text-white font-medium rounded-lg px-4 py-3 transition flex items-center justify-center gap-2"
        >
          <RotateCcw size={16} /> Scan another
        </button>
        <Link
          href="/scan"
          className="block text-center text-sm text-text-secondary hover:text-christmas-cream py-2"
        >
          Back to scanner home
        </Link>
      </div>
    );
  }

  if (step === 'scan') {
    return (
      <form onSubmit={lookupBarcode} className="space-y-4">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-text-muted mb-2">Material barcode</span>
          <BarcodeInput
            value={barcode}
            onChange={(e) => setBarcode((e.target as HTMLInputElement).value)}
            placeholder="Scan or type…"
          />
        </label>
        {error && (
          <div className="text-sm text-red-300 bg-red-900/20 border border-red-900/40 rounded px-3 py-2">{error}</div>
        )}
        <button
          type="submit"
          disabled={pending || !barcode}
          className="w-full bg-christmas-green hover:bg-christmas-green-light disabled:opacity-50 text-white font-medium rounded-lg px-4 py-3 transition flex items-center justify-center gap-2"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Look up
        </button>
      </form>
    );
  }

  // step === 'qty'
  return (
    <div className="space-y-4">
      <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
        <div className="text-xs text-text-muted">{material?.sku}</div>
        <div className="text-base font-medium mt-0.5">{material?.name}</div>
        <div className="text-xs text-text-secondary mt-1">
          per {material?.unit_of_measure ?? 'unit'}
          {material?.total_truck_stock != null && ` · on truck: ${material.total_truck_stock}`}
        </div>
      </div>

      <label className="block">
        <span className="block text-xs uppercase tracking-wide text-text-muted mb-2">Quantity</span>
        <input
          type="number"
          inputMode="decimal"
          min="0.001"
          step="0.001"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-full bg-bg-secondary border-2 border-border-default rounded-lg px-4 py-4 text-lg outline-none focus:border-christmas-green"
        />
      </label>

      <label className="block">
        <span className="block text-xs uppercase tracking-wide text-text-muted mb-2">Job</span>
        <select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          className="w-full bg-bg-secondary border-2 border-border-default rounded-lg px-4 py-3 outline-none focus:border-christmas-green"
        >
          {jobs.length === 0 ? (
            <option value="">— No active jobs found, type below —</option>
          ) : (
            jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label} · {j.status}
              </option>
            ))
          )}
        </select>
      </label>

      <label className="block">
        <span className="block text-xs uppercase tracking-wide text-text-muted mb-2">Notes (optional)</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-bg-secondary border-2 border-border-default rounded-lg px-4 py-3 outline-none focus:border-christmas-green"
        />
      </label>

      {error && (
        <div className="text-sm text-red-300 bg-red-900/20 border border-red-900/40 rounded px-3 py-2">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={reset}
          className="bg-bg-card-hover hover:bg-bg-secondary text-text-primary rounded-lg px-4 py-3 transition border border-border-default flex items-center justify-center gap-2"
        >
          <X size={16} /> Cancel
        </button>
        <button
          type="button"
          onClick={submitConsume}
          disabled={pending}
          className="bg-christmas-green hover:bg-christmas-green-light disabled:opacity-50 text-white font-medium rounded-lg px-4 py-3 transition flex items-center justify-center gap-2"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Confirm
        </button>
      </div>
    </div>
  );
}
