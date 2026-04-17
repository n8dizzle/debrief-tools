/**
 * TransferModal — shared modal for moving stock between warehouse ↔ truck.
 *
 * Props:
 *   materialId?   — pre-fill a specific material (UUID)
 *   fromType?     — 'warehouse' | 'truck'  (pre-fill source type)
 *   fromId?       — pre-fill source location ID
 *   onClose()     — dismiss without saving
 *   onDone()      — called after a successful transfer
 *
 * When materialId is supplied the material picker is skipped.
 * When fromType + fromId are supplied the source row is locked.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X, ArrowRight, ArrowLeft, Package, Truck, Warehouse,
  CheckCircle2, AlertTriangle, Loader2, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';

// ── Direction config ───────────────────────────────────────────────────────────
const DIRECTIONS = [
  {
    key:       'wh_to_truck',
    label:     'Warehouse → Truck',
    from_type: 'warehouse',
    to_type:   'truck',
    icon:      Warehouse,
    color:     'border-blue-500 bg-blue-500/10 text-blue-300',
    arrowCls:  'text-blue-400',
  },
  {
    key:       'truck_to_wh',
    label:     'Truck → Warehouse',
    from_type: 'truck',
    to_type:   'warehouse',
    icon:      Truck,
    color:     'border-amber-500 bg-amber-500/10 text-amber-300',
    arrowCls:  'text-amber-400',
  },
];

// ── Simple select ──────────────────────────────────────────────────────────────
function Select({ value, onChange, options, placeholder, disabled }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none border border-slate-200 rounded-xl px-3 py-2.5 pr-9 text-sm
                   bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400
                   disabled:bg-slate-50 disabled:text-slate-400 text-slate-700"
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

// ── Available stock badge ──────────────────────────────────────────────────────
function AvailBadge({ qty, unit }) {
  if (qty == null) return null;
  const color = qty === 0 ? 'bg-red-50 text-red-600 border-red-200'
    : qty <= 5             ? 'bg-amber-50 text-amber-700 border-amber-200'
    :                        'bg-emerald-50 text-emerald-700 border-emerald-200';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      {qty} {unit ?? 'units'} avail.
    </span>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────
export default function TransferModal({ materialId: initMatId, fromType: initFromType, fromId: initFromId, onClose, onDone }) {
  const { user } = useAuth();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [direction,   setDirection]   = useState(
    initFromType === 'truck' ? 'truck_to_wh' : 'wh_to_truck'
  );
  const [matId,       setMatId]       = useState(initMatId ?? '');
  const [fromId,      setFromId]      = useState(initFromId ?? '');
  const [toId,        setToId]        = useState('');
  const [qty,         setQty]         = useState('');
  const [notes,       setNotes]       = useState('');

  // ── Data ───────────────────────────────────────────────────────────────────
  const [materials,   setMaterials]   = useState([]);
  const [warehouses,  setWarehouses]  = useState([]);
  const [trucks,      setTrucks]      = useState([]);
  const [availQty,    setAvailQty]    = useState(null);
  const [matUnit,     setMatUnit]     = useState('');

  // ── UI state ───────────────────────────────────────────────────────────────
  const [loadingData, setLoadingData] = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [done,        setDone]        = useState(null); // transfer result

  const dir = DIRECTIONS.find(d => d.key === direction);

  // ── Load materials + locations ─────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      client.get('/materials', { params: { limit: 200 } }),
      client.get('/warehouses'),
      client.get('/trucks', { params: { limit: 50 } }),
    ]).then(([mRes, wRes, tRes]) => {
      setMaterials(mRes.data.materials ?? []);
      setWarehouses(wRes.data.warehouses ?? []);
      setTrucks((tRes.data.trucks ?? []).filter(t => t.status === 'active'));
    }).catch(() => setError('Could not load locations.')).finally(() => setLoadingData(false));
  }, []);

  // ── Derive available quantity when source changes ──────────────────────────
  const lookupAvail = useCallback(async () => {
    if (!matId || !fromId || !dir) { setAvailQty(null); return; }
    try {
      if (dir.from_type === 'warehouse') {
        const { data } = await client.get(`/materials/${matId}`);
        const wStock = (data.warehouse_stock ?? []).find(w => w.warehouse_id === fromId);
        setAvailQty(wStock?.qty_on_hand ?? data.material?.qty_on_hand ?? 0);
        setMatUnit(data.material?.unit ?? '');
      } else {
        // from truck
        const { data } = await client.get(`/trucks/${fromId}`);
        const entry = (data.stock ?? []).find(s => s.material_id === matId);
        setAvailQty(entry?.qty_on_hand ?? 0);
        setMatUnit(entry?.unit ?? '');
      }
    } catch {
      setAvailQty(null);
    }
  }, [matId, fromId, dir]);

  useEffect(() => { lookupAvail(); }, [lookupAvail]);

  // ── When direction flips, swap from/to only if they weren't props ──────────
  function flipDirection(newDir) {
    setDirection(newDir);
    if (!initFromId) setFromId('');
    setToId('');
    setAvailQty(null);
    setError('');
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!matId)  return setError('Select a material.');
    if (!fromId) return setError('Select the source location.');
    if (!toId)   return setError('Select the destination.');
    if (fromId === toId && dir.from_type === dir.to_type) return setError('Source and destination cannot be the same.');
    const q = Number(qty);
    if (!q || q <= 0) return setError('Enter a valid quantity.');
    if (availQty != null && q > availQty) return setError(`Only ${availQty} available — reduce quantity.`);

    setSaving(true);
    try {
      const { data } = await client.post('/stock/transfer', {
        material_id:  matId,
        from_type:    dir.from_type,
        from_id:      fromId,
        to_type:      dir.to_type,
        to_id:        toId,
        quantity:     q,
        notes:        notes.trim() || undefined,
        performed_by: user?.name ?? 'Unknown',
      });
      setDone(data);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Transfer failed. Try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Location option lists ──────────────────────────────────────────────────
  const whOptions    = warehouses.map(w => ({ value: w.id, label: w.name }));
  const truckOptions = trucks.map(t => ({
    value: t.id,
    label: `Truck ${t.truck_number}${t.assigned_tech ? ` — ${t.assigned_tech}` : ''}`,
  }));
  const matOptions = materials.map(m => ({ value: m.id, label: `${m.name} (${m.sku})` }));

  const fromOptions = dir?.from_type === 'warehouse' ? whOptions : truckOptions;
  const toOptions   = dir?.to_type   === 'warehouse' ? whOptions : truckOptions;

  // ── Success screen ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800">Transfer complete</p>
            <p className="text-slate-500 text-sm mt-1">
              <span className="font-semibold text-slate-700">{done.quantity} × {done.material?.name}</span>
            </p>
            <p className="text-slate-400 text-sm mt-1.5">
              {done.from?.name} <ArrowRight size={12} className="inline" /> {done.to?.name}
            </p>
            <p className="text-slate-400 text-xs mt-0.5 font-mono">{done.transfer_id}</p>
          </div>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => { setDone(null); setMatId(initMatId ?? ''); setFromId(initFromId ?? ''); setToId(''); setQty(''); setNotes(''); setAvailQty(null); setError(''); }}
              className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Transfer again
            </button>
            <button
              onClick={() => { onDone?.(); onClose(); }}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <ArrowRight size={16} className="text-indigo-600" />
            </div>
            <h2 className="font-bold text-slate-800 text-lg">Move Stock</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {loadingData ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-indigo-400" />
            </div>
          ) : (
            <form id="transfer-form" onSubmit={submit} className="space-y-5">

              {/* Direction toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Direction</label>
                <div className="grid grid-cols-2 gap-2">
                  {DIRECTIONS.map(d => {
                    const Icon = d.icon;
                    const active = direction === d.key;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => flipDirection(d.key)}
                        disabled={!!initFromType}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold
                                    transition-colors disabled:opacity-60 disabled:cursor-default
                                    ${active
                                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                      : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      >
                        <Icon size={15} className={active ? 'text-indigo-500' : 'text-slate-400'} />
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Material */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Material</label>
                {initMatId ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <Package size={14} className="text-slate-400 shrink-0" />
                    <span className="text-sm font-medium text-slate-700">
                      {materials.find(m => m.id === initMatId)?.name ?? initMatId}
                    </span>
                  </div>
                ) : (
                  <Select
                    value={matId}
                    onChange={v => { setMatId(v); setAvailQty(null); }}
                    options={matOptions}
                    placeholder="Select material…"
                  />
                )}
              </div>

              {/* Source */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  From — {dir?.from_type === 'warehouse' ? 'Warehouse' : 'Truck'}
                </label>
                {initFromId ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    {dir?.from_type === 'warehouse'
                      ? <Warehouse size={14} className="text-slate-400 shrink-0" />
                      : <Truck size={14} className="text-slate-400 shrink-0" />}
                    <span className="text-sm font-medium text-slate-700">
                      {dir?.from_type === 'warehouse'
                        ? (warehouses.find(w => w.id === initFromId)?.name ?? initFromId)
                        : (() => { const t = trucks.find(t => t.id === initFromId); return t ? `Truck ${t.truck_number}` : initFromId; })()}
                    </span>
                    {availQty != null && <AvailBadge qty={availQty} unit={matUnit} />}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select
                        value={fromId}
                        onChange={setFromId}
                        options={fromOptions}
                        placeholder={`Select ${dir?.from_type === 'warehouse' ? 'warehouse' : 'truck'}…`}
                      />
                    </div>
                    {availQty != null && <AvailBadge qty={availQty} unit={matUnit} />}
                  </div>
                )}
              </div>

              {/* Arrow */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-100" />
                <ArrowRight size={16} className="text-indigo-400 shrink-0" />
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              {/* Destination */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  To — {dir?.to_type === 'warehouse' ? 'Warehouse' : 'Truck'}
                </label>
                <Select
                  value={toId}
                  onChange={setToId}
                  options={toOptions}
                  placeholder={`Select ${dir?.to_type === 'warehouse' ? 'warehouse' : 'truck'}…`}
                />
              </div>

              {/* Quantity */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Quantity</label>
                  {availQty != null && (
                    <button
                      type="button"
                      onClick={() => setQty(String(availQty))}
                      className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                    >
                      Transfer all ({availQty})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-700"
                />
                {availQty != null && qty && Number(qty) > availQty && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> Exceeds available stock ({availQty})
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Spring resupply run"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-700"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  <AlertTriangle size={15} className="shrink-0" />
                  {error}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        {!loadingData && (
          <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="transfer-form"
              disabled={saving || !matId || !fromId || !toId || !qty}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                         text-white rounded-xl py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {saving
                ? <><Loader2 size={15} className="animate-spin" /> Moving…</>
                : <><ArrowRight size={15} /> Move Stock</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
