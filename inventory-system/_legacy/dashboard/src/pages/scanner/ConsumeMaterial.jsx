/**
 * ConsumeMaterial — scan or search a material, enter job # and qty, submit.
 *
 * Flow:
 *   1. Scan / search screen  → barcode opens BarcodeScanner, search queries API
 *   2. Item confirmed card   → shows name, truck stock, fields for job + qty
 *   3. Success screen        → confirmation with "Do another" button
 */

import { useState, useEffect } from 'react';
import { Search, ScanLine, CheckCircle, AlertTriangle, Package } from 'lucide-react';
import BarcodeScanner from '../../components/scanner/BarcodeScanner.jsx';
import JobPicker from '../../components/scanner/JobPicker.jsx';
import client from '../../api/client.js';

function useTruckId() {
  return sessionStorage.getItem('scanner_truck') ?? '';
}

/* ── Step 1: search / scan ── */
function SearchStep({ onFound }) {
  const [scanning, setScanning]   = useState(false);
  const [query,    setQuery]      = useState('');
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState('');

  async function lookup(value) {
    setError('');
    setLoading(true);
    setScanning(false);
    try {
      const { data } = await client.get('/materials', {
        params: { search: value, limit: 1 },
      });
      const mat = (data.materials ?? [])[0];
      if (!mat) { setError(`No material found for "${value}"`); return; }
      onFound(mat);
    } catch {
      setError('Lookup failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    if (query.trim()) lookup(query.trim());
  }

  return (
    <div className="flex flex-col px-4 py-6 gap-6">
      <div>
        <h2 className="text-white text-xl font-bold">Consume Material</h2>
        <p className="text-slate-400 text-sm mt-1">Scan barcode or search by SKU / name</p>
      </div>

      {/* Scan button */}
      <button
        onClick={() => setScanning(true)}
        className="flex items-center justify-center gap-3 bg-indigo-600 active:bg-indigo-700
                   text-white rounded-2xl py-5 text-lg font-semibold transition-colors"
      >
        <ScanLine size={24} />
        Scan Barcode
      </button>

      {/* Manual search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="SKU or material name…"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-3
                       text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-base"
          />
        </div>
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="bg-slate-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-semibold active:bg-slate-600"
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
          hint="SKU or barcode number"
        />
      )}
    </div>
  );
}

/* ── Step 2: confirm + form ── */
function ConfirmStep({ material, onBack, onSuccess }) {
  const truckId = useTruckId();

  const [job,      setJob]      = useState(null);  // full job object from JobPicker
  const [qty,      setQty]      = useState('1');
  const [notes,    setNotes]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Truck stock for this material
  const [truckQty, setTruckQty] = useState(null);

  // Fetch truck stock once on mount
  useEffect(() => {
    if (!truckId) return;
    client.get(`/materials/${material.id}`)
      .then(({ data }) => {
        const ts = (data.truck_stock ?? []).find(t => t.truck_id === truckId);
        setTruckQty(ts?.qty_on_truck ?? null);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.id, truckId]);

  async function submit(e) {
    e.preventDefault();
    if (!job) { setError('Please select a job.'); return; }
    const q = parseInt(qty);
    if (!q || q < 1) { setError('Enter a valid quantity.'); return; }

    setError('');
    setLoading(true);
    try {
      await client.post('/stock/adjust', {
        material_id:    material.id,
        location_type:  'truck',
        location_id:    truckId,
        quantity:       -q,
        movement_type:  'consumed_on_job',
        job_number:     job.job_number,
        job_id:         job.id,
        customer_name:  job.customer_name,
        notes:          notes.trim() || undefined,
      });
      onSuccess({ material, qty: q, job: job.job_number, customer: job.customer_name });
    } catch (err) {
      setError(err.response?.data?.error ?? 'Submission failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const isLow = material.qty_on_hand > 0 && material.qty_on_hand <= material.reorder_point;
  const isOOS = material.qty_on_hand === 0;

  return (
    <div className="flex flex-col px-4 py-6 gap-5">
      {/* Material card */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Package size={18} className="text-indigo-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold leading-snug">{material.name}</p>
            <p className="text-slate-400 text-sm mt-0.5">{material.sku}</p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-700 grid grid-cols-2 gap-3">
          <div>
            <p className="text-slate-500 text-xs">Warehouse stock</p>
            <p className={`font-semibold mt-0.5 ${isOOS ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-white'}`}>
              {material.qty_on_hand} {material.unit ?? 'units'}
              {isOOS && <span className="text-xs ml-1">(OOS)</span>}
              {isLow && !isOOS && <span className="text-xs ml-1">(LOW)</span>}
            </p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">On your truck</p>
            <p className="text-white font-semibold mt-0.5">
              {truckQty !== null ? `${truckQty} ${material.unit ?? 'units'}` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className="text-slate-300 text-sm font-medium block mb-1.5">ServiceTitan Job *</label>
          <JobPicker
            truckId={truckId}
            value={job}
            onChange={setJob}
          />
          {job && (
            <p className="text-slate-500 text-xs mt-1.5 pl-1">
              {job.customer_address}
            </p>
          )}
        </div>

        <div>
          <label className="text-slate-300 text-sm font-medium block mb-1.5">Quantity Used *</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQty(q => String(Math.max(1, parseInt(q || '1') - 1)))}
              className="w-12 h-12 bg-slate-700 rounded-xl text-white text-xl font-bold active:bg-slate-600 flex items-center justify-center"
            >
              −
            </button>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={e => setQty(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                         text-white text-center text-xl font-semibold focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={() => setQty(q => String(parseInt(q || '0') + 1))}
              className="w-12 h-12 bg-slate-700 rounded-xl text-white text-xl font-bold active:bg-slate-600 flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="text-slate-300 text-sm font-medium block mb-1.5">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. replaced with customer-supplied part"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                       text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 bg-slate-700 text-white rounded-xl py-3.5 font-semibold active:bg-slate-600"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 disabled:opacity-60 text-white rounded-xl py-3.5 font-semibold active:bg-indigo-700"
          >
            {loading ? 'Submitting…' : 'Confirm'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Step 3: success ── */
function SuccessStep({ result, onAnother }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 gap-6 text-center">
      <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
        <CheckCircle size={40} className="text-emerald-400" />
      </div>
      <div>
        <h2 className="text-white text-xl font-bold">Logged!</h2>
        <p className="text-slate-400 mt-2 text-sm">
          <span className="text-white font-semibold">{result.qty}× {result.material.name}</span>
          {' '}consumed on{' '}
          <span className="text-indigo-300 font-semibold">{result.job}</span>
          {result.customer && (
            <span className="block text-slate-500 text-xs mt-1">{result.customer}</span>
          )}
        </p>
      </div>
      <button
        onClick={onAnother}
        className="w-full bg-indigo-600 text-white rounded-2xl py-4 text-lg font-semibold active:bg-indigo-700"
      >
        Scan Another
      </button>
    </div>
  );
}

/* ── Page wrapper ── */
export default function ConsumeMaterial() {
  const [step,     setStep]     = useState('search'); // 'search' | 'confirm' | 'success'
  const [material, setMaterial] = useState(null);
  const [result,   setResult]   = useState(null);

  if (step === 'success') {
    return <SuccessStep result={result} onAnother={() => { setStep('search'); setMaterial(null); }} />;
  }
  if (step === 'confirm' && material) {
    return (
      <ConfirmStep
        material={material}
        onBack={() => setStep('search')}
        onSuccess={r => { setResult(r); setStep('success'); }}
      />
    );
  }
  return (
    <SearchStep onFound={mat => { setMaterial(mat); setStep('confirm'); }} />
  );
}
