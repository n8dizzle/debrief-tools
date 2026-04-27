'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Loader2, RotateCcw, Search, X } from 'lucide-react';
import { BarcodeInput } from '@/components/scanner/BarcodeInput';

type Material = { id: string; sku: string; name: string; unit_of_measure: string | null };
type Place = 'warehouse' | 'truck';

export default function TransferForm({
  warehouses,
  trucks,
  ownTruckId,
}: {
  warehouses: Array<{ id: string; name: string }>;
  trucks: Array<{ id: string; label: string }>;
  ownTruckId: string | null;
}) {
  const [step, setStep] = useState<'scan' | 'qty' | 'success'>('scan');
  const [barcode, setBarcode] = useState('');
  const [material, setMaterial] = useState<Material | null>(null);

  const [fromType, setFromType] = useState<Place>('warehouse');
  const [fromId, setFromId] = useState<string>(warehouses[0]?.id ?? '');
  const [toType, setToType] = useState<Place>('truck');
  const [toId, setToId] = useState<string>(ownTruckId ?? trucks[0]?.id ?? '');

  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setStep('scan');
    setBarcode('');
    setMaterial(null);
    setQty('1');
    setNotes('');
    setError(null);
  }

  function setFrom(type: Place) {
    setFromType(type);
    setFromId(type === 'warehouse' ? (warehouses[0]?.id ?? '') : (trucks[0]?.id ?? ''));
  }
  function setTo(type: Place) {
    setToType(type);
    setToId(type === 'warehouse' ? (warehouses[0]?.id ?? '') : (ownTruckId ?? trucks[0]?.id ?? ''));
  }

  async function lookup(e: React.FormEvent) {
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

  async function submit() {
    if (!material) return;
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return setError('Quantity must be positive.');
    if (fromType === toType && fromId === toId) return setError('Source and destination cannot be the same.');
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/stock/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: material.id,
          from_type: fromType,
          from_id: fromId,
          to_type: toType,
          to_id: toId,
          quantity: n,
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
          <div className="mt-3 text-lg font-medium text-christmas-cream">Transfer recorded</div>
          <div className="mt-1 text-sm text-text-secondary">{qty} × {material?.name}</div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="w-full bg-christmas-green hover:bg-christmas-green-light text-white font-medium rounded-lg px-4 py-3 transition flex items-center justify-center gap-2"
        >
          <RotateCcw size={16} /> Transfer another
        </button>
        <Link href="/scan" className="block text-center text-sm text-text-secondary py-2">
          Back to scanner home
        </Link>
      </div>
    );
  }

  if (step === 'scan') {
    return (
      <form onSubmit={lookup} className="space-y-4">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-text-muted mb-2">Material barcode</span>
          <BarcodeInput
            value={barcode}
            onChange={(e) => setBarcode((e.target as HTMLInputElement).value)}
            placeholder="Scan or type…"
          />
        </label>
        {error && <div className="text-sm text-red-300 bg-red-900/20 border border-red-900/40 rounded px-3 py-2">{error}</div>}
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

  return (
    <div className="space-y-4">
      <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
        <div className="text-xs text-text-muted">{material?.sku}</div>
        <div className="text-base font-medium mt-0.5">{material?.name}</div>
        <div className="text-xs text-text-secondary mt-1">per {material?.unit_of_measure ?? 'unit'}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <PlacePicker label="From" type={fromType} setType={setFrom} id={fromId} setId={setFromId} warehouses={warehouses} trucks={trucks} />
        <ArrowRight size={20} className="text-text-muted hidden md:block self-center" />
        <PlacePicker label="To" type={toType} setType={setTo} id={toId} setId={setToId} warehouses={warehouses} trucks={trucks} />
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
        <span className="block text-xs uppercase tracking-wide text-text-muted mb-2">Notes (optional)</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-bg-secondary border-2 border-border-default rounded-lg px-4 py-3 outline-none focus:border-christmas-green"
        />
      </label>

      {error && <div className="text-sm text-red-300 bg-red-900/20 border border-red-900/40 rounded px-3 py-2">{error}</div>}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={reset} className="bg-bg-card-hover hover:bg-bg-secondary text-text-primary rounded-lg px-4 py-3 border border-border-default flex items-center justify-center gap-2">
          <X size={16} /> Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="bg-christmas-green hover:bg-christmas-green-light disabled:opacity-50 text-white font-medium rounded-lg px-4 py-3 flex items-center justify-center gap-2"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Confirm
        </button>
      </div>
    </div>
  );
}

function PlacePicker({
  label,
  type,
  setType,
  id,
  setId,
  warehouses,
  trucks,
}: {
  label: string;
  type: Place;
  setType: (t: Place) => void;
  id: string;
  setId: (v: string) => void;
  warehouses: Array<{ id: string; name: string }>;
  trucks: Array<{ id: string; label: string }>;
}) {
  return (
    <div>
      <span className="block text-xs uppercase tracking-wide text-text-muted mb-2">{label}</span>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          type="button"
          onClick={() => setType('warehouse')}
          className={`rounded-md py-2 text-xs font-medium border-2 ${type === 'warehouse' ? 'bg-bg-card-hover border-christmas-green text-christmas-cream' : 'bg-bg-card border-border-default text-text-secondary'}`}
        >
          Warehouse
        </button>
        <button
          type="button"
          onClick={() => setType('truck')}
          className={`rounded-md py-2 text-xs font-medium border-2 ${type === 'truck' ? 'bg-bg-card-hover border-christmas-green text-christmas-cream' : 'bg-bg-card border-border-default text-text-secondary'}`}
        >
          Truck
        </button>
      </div>
      <select
        value={id}
        onChange={(e) => setId(e.target.value)}
        className="w-full bg-bg-secondary border-2 border-border-default rounded-lg px-3 py-3 outline-none focus:border-christmas-green"
      >
        {(type === 'warehouse' ? warehouses.map((w) => ({ id: w.id, label: w.name })) : trucks).map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
