/**
 * TransferStock — mobile scanner flow for moving stock warehouse ↔ truck.
 *
 * Steps:
 *   1. Direction  — big tap tiles (WH→Truck or Truck→WH)
 *   2. Material   — scan barcode or search by name / SKU
 *   3. Source     — warehouse or truck selector (auto-filled from session if applicable)
 *   4. Destination — opposite location type selector
 *   5. Quantity   — stepper + confirm
 *   6. Success
 */

import { useState, useEffect } from 'react';
import {
  Warehouse, Truck, Search, ScanLine, CheckCircle, AlertTriangle,
  ArrowRight, ArrowLeft, Package, Minus, Plus, Loader2,
} from 'lucide-react';
import BarcodeScanner from '../../components/scanner/BarcodeScanner.jsx';
import client from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

// ── Step 1: direction ──────────────────────────────────────────────────────────
function DirectionStep({ onSelect }) {
  return (
    <div className="flex flex-col px-4 py-6 gap-6">
      <div>
        <h2 className="text-white text-xl font-bold">Move Stock</h2>
        <p className="text-slate-400 text-sm mt-1">Which direction are you moving material?</p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => onSelect('wh_to_truck')}
          className="flex items-center gap-4 bg-slate-800 border border-slate-700 rounded-2xl p-5
                     active:bg-slate-700 transition-colors text-left"
        >
          <div className="flex items-center gap-2 text-blue-400">
            <Warehouse size={24} />
            <ArrowRight size={18} />
            <Truck size={24} />
          </div>
          <div>
            <p className="text-white font-semibold">Warehouse → Truck</p>
            <p className="text-slate-400 text-sm mt-0.5">Load stock from warehouse onto truck</p>
          </div>
        </button>

        <button
          onClick={() => onSelect('truck_to_wh')}
          className="flex items-center gap-4 bg-slate-800 border border-slate-700 rounded-2xl p-5
                     active:bg-slate-700 transition-colors text-left"
        >
          <div className="flex items-center gap-2 text-amber-400">
            <Truck size={24} />
            <ArrowRight size={18} />
            <Warehouse size={24} />
          </div>
          <div>
            <p className="text-white font-semibold">Truck → Warehouse</p>
            <p className="text-slate-400 text-sm mt-0.5">Return unused stock back to warehouse</p>
          </div>
        </button>
      </div>
    </div>
  );
}

// ── Step 2: material search / scan ─────────────────────────────────────────────
function MaterialStep({ direction, onFound, onBack }) {
  const [scanning, setScanning] = useState(false);
  const [query,    setQuery]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function lookup(value) {
    setError(''); setLoading(true); setScanning(false);
    try {
      const { data } = await client.get('/materials', { params: { search: value, limit: 1 } });
      const mat = (data.materials ?? [])[0];
      if (!mat) { setError(`No material found for "${value}"`); return; }
      onFound(mat);
    } catch {
      setError('Lookup failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const isWH = direction === 'wh_to_truck';

  return (
    <div className="flex flex-col px-4 py-6 gap-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 text-sm self-start">
        <ArrowLeft size={16} /> Back
      </button>

      <div>
        <div className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-3
          ${isWH ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'}`}>
          {isWH ? <Warehouse size={12} /> : <Truck size={12} />}
          {isWH ? 'Warehouse → Truck' : 'Truck → Warehouse'}
        </div>
        <h2 className="text-white text-xl font-bold">Select Material</h2>
        <p className="text-slate-400 text-sm mt-1">Scan barcode or search by name / SKU</p>
      </div>

      <button
        onClick={() => setScanning(true)}
        className="flex items-center justify-center gap-3 bg-indigo-600 active:bg-indigo-700
                   text-white rounded-2xl py-5 text-lg font-semibold"
      >
        <ScanLine size={24} />
        Scan Barcode
      </button>

      <form onSubmit={e => { e.preventDefault(); if (query.trim()) lookup(query.trim()); }} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Material name or SKU…"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-3
                       text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-base"
          />
        </div>
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="bg-slate-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-semibold"
        >
          {loading ? '…' : 'Find'}
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {scanning && (
        <BarcodeScanner
          onScan={lookup}
          onClose={() => setScanning(false)}
          hint="SKU or barcode"
        />
      )}
    </div>
  );
}

// ── Step 3 + 4: source & destination ──────────────────────────────────────────
function LocationStep({ direction, material, sessionTruckId, onSelected, onBack }) {
  const [warehouses,    setWarehouses]    = useState([]);
  const [trucks,        setTrucks]        = useState([]);
  const [fromId,        setFromId]        = useState('');
  const [toId,          setToId]          = useState('');
  const [availQty,      setAvailQty]      = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');

  const isWH = direction === 'wh_to_truck'; // WH→Truck or Truck→WH

  useEffect(() => {
    Promise.all([
      client.get('/warehouses'),
      client.get('/trucks', { params: { limit: 50 } }),
    ]).then(([wRes, tRes]) => {
      const whs = wRes.data.warehouses ?? [];
      const tks = (tRes.data.trucks ?? []).filter(t => t.status === 'active');
      setWarehouses(whs);
      setTrucks(tks);

      // Auto-select source from session truck where applicable
      if (!isWH && sessionTruckId) {
        setFromId(sessionTruckId);
      } else if (isWH && whs.length === 1) {
        setFromId(whs[0].id);
      }
    }).catch(() => setError('Could not load locations.'))
    .finally(() => setLoading(false));
  }, [isWH, sessionTruckId]);

  // Lookup available qty when source is selected
  useEffect(() => {
    if (!fromId) { setAvailQty(null); return; }
    async function fetch() {
      try {
        if (isWH) {
          const { data } = await client.get(`/materials/${material.id}`);
          const ws = (data.warehouse_stock ?? []).find(w => w.warehouse_id === fromId);
          setAvailQty(ws?.qty_on_hand ?? data.material?.qty_on_hand ?? 0);
        } else {
          const { data } = await client.get(`/trucks/${fromId}`);
          const entry = (data.stock ?? []).find(s => s.material_id === material.id);
          setAvailQty(entry?.qty_on_hand ?? 0);
        }
      } catch { setAvailQty(null); }
    }
    fetch();
  }, [fromId, isWH, material.id]);

  function proceed() {
    if (!fromId) return setError(`Select a ${isWH ? 'warehouse' : 'truck'} to move from.`);
    if (!toId)   return setError(`Select a ${isWH ? 'truck' : 'warehouse'} to move to.`);
    if (fromId === toId) return setError('Source and destination cannot be the same.');
    const fromItem = fromList.find(i => i.id === fromId);
    const toItem   = toList.find(i => i.id === toId);
    const fromLabel = isWH ? fromItem?.name : `Truck ${fromItem?.truck_number}`;
    const toLabel   = isWH ? `Truck ${toItem?.truck_number}` : toItem?.name;
    onSelected({ fromId, toId, availQty, fromLabel, toLabel });
  }

  const fromList = isWH ? warehouses : trucks;
  const toList   = isWH ? trucks     : warehouses;

  if (loading) {
    return (
      <div className="flex flex-col px-4 py-6 gap-6 items-center justify-center min-h-[40vh]">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
        <p className="text-slate-400 text-sm">Loading locations…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col px-4 py-6 gap-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 text-sm self-start">
        <ArrowLeft size={16} /> Back
      </button>

      {/* Material chip */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-indigo-600/20 rounded-xl flex items-center justify-center shrink-0">
          <Package size={16} className="text-indigo-400" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate">{material.name}</p>
          <p className="text-slate-400 text-xs">{material.sku}</p>
        </div>
      </div>

      {/* Source */}
      <div>
        <label className="text-slate-300 text-sm font-medium block mb-2">
          From — {isWH ? 'Warehouse' : 'Truck'} *
        </label>
        <div className="space-y-2 max-h-44 overflow-y-auto">
          {fromList.map(item => {
            const label = isWH ? item.name : `Truck ${item.truck_number}${item.assigned_tech ? ` — ${item.assigned_tech}` : ''}`;
            return (
              <button
                key={item.id}
                onClick={() => { setFromId(item.id); setError(''); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors
                  ${fromId === item.id
                    ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                    : 'border-slate-700 bg-slate-800 text-slate-300 active:bg-slate-700'}`}
              >
                {isWH ? <Warehouse size={15} className="shrink-0" /> : <Truck size={15} className="shrink-0" />}
                <span className="text-sm font-medium">{label}</span>
                {fromId === item.id && availQty != null && (
                  <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full
                    ${availQty === 0 ? 'bg-red-900/40 text-red-300' : 'bg-emerald-900/40 text-emerald-300'}`}>
                    {availQty} avail.
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Destination */}
      <div>
        <label className="text-slate-300 text-sm font-medium block mb-2">
          To — {isWH ? 'Truck' : 'Warehouse'} *
        </label>
        <div className="space-y-2 max-h-44 overflow-y-auto">
          {toList.map(item => {
            const label = !isWH ? item.name : `Truck ${item.truck_number}${item.assigned_tech ? ` — ${item.assigned_tech}` : ''}`;
            return (
              <button
                key={item.id}
                onClick={() => { setToId(item.id); setError(''); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors
                  ${toId === item.id
                    ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                    : 'border-slate-700 bg-slate-800 text-slate-300 active:bg-slate-700'}`}
              >
                {!isWH ? <Warehouse size={15} className="shrink-0" /> : <Truck size={15} className="shrink-0" />}
                <span className="text-sm font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0" /> {error}
        </div>
      )}

      <button
        onClick={proceed}
        className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-semibold active:bg-indigo-700 transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

// ── Step 5: quantity + confirm ─────────────────────────────────────────────────
function QuantityStep({ direction, material, fromId, toId, fromLabel, toLabel, availQty, onBack, onSuccess }) {
  const { user } = useAuth();
  const [qty,     setQty]     = useState('1');
  const [notes,   setNotes]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const isWH = direction === 'wh_to_truck';
  const q    = parseInt(qty) || 0;

  async function submit() {
    if (q < 1) return setError('Enter at least 1.');
    if (availQty != null && q > availQty) return setError(`Only ${availQty} available.`);
    setError(''); setLoading(true);
    try {
      const { data } = await client.post('/stock/transfer', {
        material_id:  material.id,
        from_type:    isWH ? 'warehouse' : 'truck',
        from_id:      fromId,
        to_type:      isWH ? 'truck'     : 'warehouse',
        to_id:        toId,
        quantity:     q,
        notes:        notes.trim() || undefined,
        performed_by: user?.name ?? 'Scanner user',
      });
      onSuccess(data);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Transfer failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col px-4 py-6 gap-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 text-sm self-start">
        <ArrowLeft size={16} /> Back
      </button>

      {/* Summary card */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600/20 rounded-xl flex items-center justify-center shrink-0">
            <Package size={16} className="text-indigo-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm truncate">{material.name}</p>
            <p className="text-slate-400 text-xs">{material.sku}</p>
          </div>
          {availQty != null && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0
              ${availQty === 0 ? 'bg-red-900/40 text-red-300' : 'bg-slate-700 text-slate-300'}`}>
              {availQty} avail.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-slate-700 text-sm text-slate-400">
          {isWH ? <Warehouse size={13} /> : <Truck size={13} />}
          <span className="text-xs text-slate-300 font-medium truncate max-w-[90px]">{fromLabel ?? fromId}</span>
          <ArrowRight size={12} className="text-indigo-400 shrink-0" />
          {isWH ? <Truck size={13} /> : <Warehouse size={13} />}
          <span className="text-xs text-slate-300 font-medium truncate max-w-[90px]">{toLabel ?? toId}</span>
        </div>
      </div>

      {/* Qty stepper */}
      <div>
        <label className="text-slate-300 text-sm font-medium block mb-3">Quantity to move</label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setQty(String(Math.max(1, q - 1)))}
            className="w-14 h-14 bg-slate-700 rounded-2xl text-white text-2xl font-bold active:bg-slate-600 flex items-center justify-center"
          >
            <Minus size={20} />
          </button>
          <input
            type="number"
            min="1"
            max={availQty ?? undefined}
            value={qty}
            onChange={e => setQty(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3
                       text-white text-center text-2xl font-bold focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={() => setQty(String(q + 1))}
            className="w-14 h-14 bg-slate-700 rounded-2xl text-white text-2xl font-bold active:bg-slate-600 flex items-center justify-center"
          >
            <Plus size={20} />
          </button>
        </div>
        {availQty != null && q > availQty && (
          <p className="text-red-400 text-xs mt-2 text-center font-medium">
            ⚠ Exceeds available stock ({availQty})
          </p>
        )}
        {availQty != null && q > 0 && q <= availQty && (
          <button
            type="button"
            onClick={() => setQty(String(availQty))}
            className="w-full text-center text-xs text-indigo-400 mt-2 font-medium"
          >
            Transfer all ({availQty})
          </button>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="text-slate-300 text-sm font-medium block mb-2">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. restock before job ST-7812"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                     text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0" /> {error}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={onBack} className="flex-1 bg-slate-700 text-white rounded-xl py-3.5 font-semibold active:bg-slate-600">
          Back
        </button>
        <button
          onClick={submit}
          disabled={loading || q < 1 || (availQty != null && q > availQty)}
          className="flex-1 bg-indigo-600 disabled:opacity-60 text-white rounded-xl py-3.5 font-semibold active:bg-indigo-700 flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Moving…</> : 'Confirm Transfer'}
        </button>
      </div>
    </div>
  );
}

// ── Step 6: success ────────────────────────────────────────────────────────────
function SuccessStep({ result, onAnother }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 gap-6 text-center">
      <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
        <CheckCircle size={40} className="text-emerald-400" />
      </div>
      <div>
        <h2 className="text-white text-xl font-bold">Transfer complete!</h2>
        <p className="text-slate-400 mt-2 text-sm">
          <span className="text-white font-semibold">{result.quantity} × {result.material?.name}</span>
        </p>
        <p className="text-slate-500 text-xs mt-1.5">
          {result.from?.name} → {result.to?.name}
        </p>
        <p className="text-slate-600 text-xs mt-0.5 font-mono">{result.transfer_id}</p>
      </div>
      <button
        onClick={onAnother}
        className="w-full bg-indigo-600 text-white rounded-2xl py-4 text-lg font-semibold active:bg-indigo-700"
      >
        Transfer Again
      </button>
    </div>
  );
}

// ── Page wrapper ───────────────────────────────────────────────────────────────
export default function TransferStock() {
  const [step,      setStep]      = useState('direction');
  const [direction, setDirection] = useState(null);
  const [material,  setMaterial]  = useState(null);
  const [fromId,    setFromId]    = useState(null);
  const [toId,      setToId]      = useState(null);
  const [fromLabel, setFromLabel] = useState(null);
  const [toLabel,   setToLabel]   = useState(null);
  const [availQty,  setAvailQty]  = useState(null);
  const [result,    setResult]    = useState(null);

  const sessionTruckId = sessionStorage.getItem('scanner_truck') ?? '';

  function reset() {
    setStep('direction'); setDirection(null); setMaterial(null);
    setFromId(null); setToId(null); setFromLabel(null); setToLabel(null);
    setAvailQty(null); setResult(null);
  }

  if (step === 'success' && result) {
    return (
      <SuccessStep
        result={result}
        onAnother={reset}
      />
    );
  }

  if (step === 'quantity' && material && fromId && toId) {
    return (
      <QuantityStep
        direction={direction}
        material={material}
        fromId={fromId}
        toId={toId}
        fromLabel={fromLabel}
        toLabel={toLabel}
        availQty={availQty}
        onBack={() => setStep('location')}
        onSuccess={r => { setResult(r); setStep('success'); }}
      />
    );
  }

  if (step === 'location' && material) {
    return (
      <LocationStep
        direction={direction}
        material={material}
        sessionTruckId={sessionTruckId}
        onBack={() => setStep('material')}
        onSelected={({ fromId: fid, toId: tid, availQty: avail, fromLabel: fl, toLabel: tl }) => {
          setFromId(fid); setToId(tid); setAvailQty(avail);
          setFromLabel(fl); setToLabel(tl);
          setStep('quantity');
        }}
      />
    );
  }

  if (step === 'material' && direction) {
    return (
      <MaterialStep
        direction={direction}
        onBack={() => setStep('direction')}
        onFound={mat => { setMaterial(mat); setStep('location'); }}
      />
    );
  }

  return (
    <DirectionStep
      onSelect={dir => { setDirection(dir); setStep('material'); }}
    />
  );
}
