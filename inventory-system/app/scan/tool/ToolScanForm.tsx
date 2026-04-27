'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, Loader2, RotateCcw, Search, X } from 'lucide-react';
import { BarcodeInput } from '@/components/scanner/BarcodeInput';

type Tool = {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  status: string;
  current_condition: string | null;
  checked_out_to: string | null;
  checked_out_to_name: string | null;
};

type Step = 'scan' | 'action' | 'success';
type Action = 'checkout' | 'checkin';

const CONDITIONS = [
  { v: 'good', label: 'Good' },
  { v: 'needs_service', label: 'Needs service' },
  { v: 'damaged', label: 'Damaged' },
];

export default function ToolScanForm({
  currentTechId,
  truck,
}: {
  currentTechId: string;
  truck: { id: string; truck_number: string } | null;
}) {
  const [step, setStep] = useState<Step>('scan');
  const [barcode, setBarcode] = useState('');
  const [tool, setTool] = useState<Tool | null>(null);
  const [action, setAction] = useState<Action>('checkout');
  const [condition, setCondition] = useState('good');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setStep('scan');
    setBarcode('');
    setTool(null);
    setNotes('');
    setCondition('good');
    setError(null);
  }

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = barcode.trim();
    if (!code) return;
    startTransition(async () => {
      const res = await fetch(`/api/tools/by-barcode/${encodeURIComponent(code)}`, { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `No tool found for barcode ${code}`);
        return;
      }
      const data = (await res.json()) as { tool: Tool };
      setTool(data.tool);
      // Default action depending on current state
      if (data.tool.status === 'checked_out') setAction('checkin');
      else setAction('checkout');
      setCondition(data.tool.current_condition || 'good');
      setStep('action');
    });
  }

  async function submit() {
    if (!tool) return;
    setError(null);

    if (action === 'checkout') {
      if (tool.status !== 'available') {
        setError(`Tool is ${tool.status.replace('_', ' ')} — cannot check out.`);
        return;
      }
      if (!truck) {
        setError('You have no truck assigned. Ask an admin.');
        return;
      }
    } else {
      if (tool.status !== 'checked_out') {
        setError('Tool is not currently checked out.');
        return;
      }
    }

    startTransition(async () => {
      const url = `/api/tools/${tool.id}/${action}`;
      const body =
        action === 'checkout'
          ? { technician_id: currentTechId, truck_id: truck?.id, condition, notes: notes || null }
          : { condition, notes: notes || null };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
          <div className="mt-3 text-lg font-medium text-christmas-cream">
            {action === 'checkout' ? 'Checked out' : 'Checked in'}
          </div>
          <div className="mt-1 text-sm text-text-secondary">{tool?.name}</div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="w-full bg-christmas-green hover:bg-christmas-green-light text-white font-medium rounded-lg px-4 py-3 transition flex items-center justify-center gap-2"
        >
          <RotateCcw size={16} /> Scan another
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
          <span className="block text-xs uppercase tracking-wide text-text-muted mb-2">Tool barcode</span>
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

  // step === 'action'
  return (
    <div className="space-y-4">
      <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
        <div className="text-xs text-text-muted">{tool?.manufacturer} {tool?.model}</div>
        <div className="text-base font-medium mt-0.5">{tool?.name}</div>
        <div className="text-xs text-text-secondary mt-1">
          SN {tool?.serial_number} · status: <span className="capitalize">{tool?.status.replace('_', ' ')}</span>
          {tool?.checked_out_to_name ? ` · with ${tool.checked_out_to_name}` : ''}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setAction('checkout')}
          disabled={tool?.status !== 'available'}
          className={`rounded-lg px-3 py-3 text-sm font-medium transition border-2 ${
            action === 'checkout'
              ? 'bg-christmas-green/20 border-christmas-green text-christmas-cream'
              : 'bg-bg-card border-border-default text-text-secondary disabled:opacity-40'
          }`}
        >
          Check out
        </button>
        <button
          type="button"
          onClick={() => setAction('checkin')}
          disabled={tool?.status !== 'checked_out'}
          className={`rounded-lg px-3 py-3 text-sm font-medium transition border-2 ${
            action === 'checkin'
              ? 'bg-christmas-green/20 border-christmas-green text-christmas-cream'
              : 'bg-bg-card border-border-default text-text-secondary disabled:opacity-40'
          }`}
        >
          Check in
        </button>
      </div>

      <label className="block">
        <span className="block text-xs uppercase tracking-wide text-text-muted mb-2">Condition</span>
        <div className="grid grid-cols-3 gap-2">
          {CONDITIONS.map((c) => (
            <button
              key={c.v}
              type="button"
              onClick={() => setCondition(c.v)}
              className={`rounded-lg px-3 py-2 text-sm transition border-2 ${
                condition === c.v
                  ? 'bg-bg-card-hover border-christmas-green text-christmas-cream'
                  : 'bg-bg-card border-border-default text-text-secondary'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
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
          onClick={submit}
          disabled={pending}
          className="bg-christmas-green hover:bg-christmas-green-light disabled:opacity-50 text-white font-medium rounded-lg px-4 py-3 transition flex items-center justify-center gap-2"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Confirm {action}
        </button>
      </div>
    </div>
  );
}
