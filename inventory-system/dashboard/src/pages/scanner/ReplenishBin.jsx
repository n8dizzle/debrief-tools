/**
 * ReplenishBin — scan a warehouse bin barcode, show its contents,
 * let the tech select quantities to load onto their truck.
 *
 * Flow:
 *   1. Scan bin barcode (or enter bin code manually)
 *   2. Bin contents list — qty stepper per item
 *   3. Confirm → POST bin_to_truck movements
 *   4. Success screen
 */

import { useState } from 'react';
import { ScanLine, AlertTriangle, CheckCircle, RefreshCcw, Box, Plus, Minus } from 'lucide-react';
import BarcodeScanner from '../../components/scanner/BarcodeScanner.jsx';
import client from '../../api/client.js';

/* ── Step 1: scan bin ── */
function ScanStep({ onFound }) {
  const [scanning, setScanning] = useState(false);
  const [manual,   setManual]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function lookup(value) {
    setError('');
    setLoading(true);
    setScanning(false);
    try {
      // Fetch all warehouses and search for bin by bin_code
      const { data } = await client.get('/warehouses');
      let foundBin  = null;
      let foundWH   = null;

      for (const wh of data.warehouses ?? []) {
        const bin = (wh.bins ?? []).find(
          b => b.bin_code?.toLowerCase() === value.toLowerCase() || b.id === value
        );
        if (bin) { foundBin = bin; foundWH = wh; break; }
      }

      if (!foundBin) {
        // Try fetching warehouse detail for each to get bins
        setError(`Bin "${value}" not found. Check the bin code and try again.`);
        return;
      }

      // Get warehouse stock as bin contents proxy
      const detail = await client.get(`/warehouses/${foundWH.id}`);
      const stock  = (detail.data.stock ?? []).slice(0, 12); // show top items

      onFound({ bin: foundBin, warehouse: foundWH, items: stock });
    } catch {
      setError('Lookup failed. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (manual.trim()) lookup(manual.trim());
  }

  return (
    <div className="flex flex-col px-4 py-6 gap-6">
      <div>
        <h2 className="text-white text-xl font-bold">Replenish from Bin</h2>
        <p className="text-slate-400 text-sm mt-1">Scan the bin barcode to load items onto your truck</p>
      </div>

      <button
        onClick={() => setScanning(true)}
        className="flex items-center justify-center gap-3 bg-emerald-600 active:bg-emerald-700
                   text-white rounded-2xl py-5 text-lg font-semibold"
      >
        <ScanLine size={24} />
        Scan Bin Barcode
      </button>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={manual}
          onChange={e => setManual(e.target.value)}
          placeholder="Bin code (e.g. L01, A12)…"
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                     text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-base"
        />
        <button
          type="submit"
          disabled={!manual.trim() || loading}
          className="bg-slate-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-semibold"
        >
          {loading ? '…' : 'Find'}
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {scanning && (
        <BarcodeScanner
          onScan={lookup}
          onClose={() => setScanning(false)}
          hint="Bin barcode or code"
        />
      )}
    </div>
  );
}

/* ── Step 2: select quantities ── */
function SelectStep({ binData, onBack, onSuccess }) {
  const { bin, warehouse, items } = binData;
  const truckId = sessionStorage.getItem('scanner_truck') ?? '';

  const [qtys,    setQtys]    = useState(() =>
    Object.fromEntries(items.map(item => [item.id, 0]))
  );
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  function setQty(id, delta) {
    setQtys(q => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + delta) }));
  }

  function setQtyDirect(id, val) {
    const n = parseInt(val);
    setQtys(q => ({ ...q, [id]: isNaN(n) || n < 0 ? 0 : n }));
  }

  const selected = items.filter(item => (qtys[item.id] ?? 0) > 0);

  async function submit() {
    if (selected.length === 0) { setError('Select at least one item to load.'); return; }
    setError(''); setLoading(true);
    try {
      // Post a movement for each selected item
      await Promise.all(selected.map(item =>
        client.post('/stock/adjust', {
          material_id:   item.id,
          location_type: 'truck',
          location_id:   truckId,
          quantity:      qtys[item.id],
          movement_type: 'bin_to_truck',
          bin_id:        bin.id,
          bin_code:      bin.bin_code,
        })
      ));
      onSuccess({ bin, items: selected.map(i => ({ ...i, qty: qtys[i.id] })) });
    } catch (err) {
      setError(err.response?.data?.error ?? 'Submission failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col px-4 py-6 gap-5">
      {/* Bin header */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Box size={18} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-white font-semibold">Bin {bin.bin_code}</p>
          <p className="text-slate-400 text-sm">{warehouse.name} warehouse</p>
        </div>
      </div>

      {/* Item list */}
      <div>
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-3">
          Set quantities to load onto truck
        </p>
        <div className="flex flex-col gap-2">
          {items.map(item => (
            <div key={item.id} className="bg-slate-800 rounded-xl border border-slate-700 p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{item.name}</p>
                <p className="text-slate-500 text-xs">{item.sku}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setQty(item.id, -1)}
                  className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-white active:bg-slate-600"
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min="0"
                  value={qtys[item.id] ?? 0}
                  onChange={e => setQtyDirect(item.id, e.target.value)}
                  className="w-12 bg-slate-900 border border-slate-700 rounded-lg text-white text-center py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => setQty(item.id, +1)}
                  className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-white active:bg-slate-600"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Summary */}
      {selected.length > 0 && (
        <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl px-4 py-3 text-sm text-emerald-300">
          Loading {selected.length} item{selected.length !== 1 ? 's' : ''} onto truck.
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={onBack} className="flex-1 bg-slate-700 text-white rounded-xl py-3.5 font-semibold">Back</button>
        <button
          onClick={submit}
          disabled={loading || selected.length === 0}
          className="flex-1 bg-emerald-600 disabled:opacity-60 text-white rounded-xl py-3.5 font-semibold"
        >
          {loading ? 'Loading…' : `Load ${selected.length > 0 ? selected.length + ' item' + (selected.length > 1 ? 's' : '') : 'Items'}`}
        </button>
      </div>
    </div>
  );
}

/* ── Step 3: success ── */
function SuccessStep({ result, onAnother }) {
  const totalItems = result.items.reduce((s, i) => s + i.qty, 0);
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 gap-6 text-center">
      <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
        <CheckCircle size={40} className="text-emerald-400" />
      </div>
      <div>
        <h2 className="text-white text-xl font-bold">Truck Loaded!</h2>
        <p className="text-slate-400 mt-2 text-sm">
          {totalItems} unit{totalItems !== 1 ? 's' : ''} across{' '}
          {result.items.length} item{result.items.length !== 1 ? 's' : ''} loaded from bin{' '}
          <span className="text-emerald-300 font-semibold">{result.bin.bin_code}</span>.
        </p>
      </div>
      <div className="w-full bg-slate-800 rounded-2xl border border-slate-700 divide-y divide-slate-700 text-left overflow-hidden">
        {result.items.map(item => (
          <div key={item.id} className="flex items-center justify-between px-4 py-3">
            <span className="text-white text-sm">{item.name}</span>
            <span className="text-emerald-400 font-semibold text-sm">+{item.qty}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onAnother}
        className="w-full bg-emerald-600 text-white rounded-2xl py-4 text-lg font-semibold active:bg-emerald-700"
      >
        Scan Another Bin
      </button>
    </div>
  );
}

/* ── Page wrapper ── */
export default function ReplenishBin() {
  const [step,    setStep]    = useState('scan');
  const [binData, setBinData] = useState(null);
  const [result,  setResult]  = useState(null);

  if (step === 'success') {
    return <SuccessStep result={result} onAnother={() => { setStep('scan'); setBinData(null); }} />;
  }
  if (step === 'select' && binData) {
    return (
      <SelectStep
        binData={binData}
        onBack={() => setStep('scan')}
        onSuccess={r => { setResult(r); setStep('success'); }}
      />
    );
  }
  return <ScanStep onFound={d => { setBinData(d); setStep('select'); }} />;
}
