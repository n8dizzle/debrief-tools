/**
 * ToolAction — scan or search a tool, then check it out or return it.
 *
 * Flow:
 *   1. Scan / search
 *   2. Tool status card → checkout form OR return/condition form
 *   3. Success screen
 */

import { useState } from 'react';
import { Search, ScanLine, CheckCircle, AlertTriangle, Wrench, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import BarcodeScanner from '../../components/scanner/BarcodeScanner.jsx';
import client from '../../api/client.js';

const CONDITION_OPTIONS = [
  { value: 'excellent', label: 'Excellent',     color: 'border-emerald-500 bg-emerald-500/10 text-emerald-300' },
  { value: 'good',      label: 'Good',          color: 'border-blue-500 bg-blue-500/10 text-blue-300' },
  { value: 'fair',      label: 'Fair / Worn',   color: 'border-amber-500 bg-amber-500/10 text-amber-300' },
  { value: 'damaged',   label: 'Damaged',       color: 'border-red-500 bg-red-500/10 text-red-300' },
];

const STATUS_COLORS = {
  available:       'bg-emerald-500/20 text-emerald-300',
  checked_out:     'bg-amber-500/20 text-amber-300',
  out_for_service: 'bg-purple-500/20 text-purple-300',
  retired:         'bg-slate-600/40 text-slate-400',
};

/* ── Step 1: search ── */
function SearchStep({ onFound }) {
  const [scanning, setScanning] = useState(false);
  const [query,    setQuery]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function lookup(value) {
    setError('');
    setLoading(true);
    setScanning(false);
    try {
      const { data } = await client.get('/tools', { params: { search: value, limit: 1 } });
      const tool = (data.tools ?? [])[0];
      if (!tool) { setError(`No tool found for "${value}"`); return; }
      onFound(tool);
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
        <h2 className="text-white text-xl font-bold">Tool Checkout / Return</h2>
        <p className="text-slate-400 text-sm mt-1">Scan barcode or search by name / serial</p>
      </div>

      <button
        onClick={() => setScanning(true)}
        className="flex items-center justify-center gap-3 bg-amber-500 active:bg-amber-600
                   text-white rounded-2xl py-5 text-lg font-semibold"
      >
        <ScanLine size={24} />
        Scan Tool Barcode
      </button>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tool name or serial number…"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-3
                       text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-base"
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
          <AlertTriangle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {scanning && (
        <BarcodeScanner
          onScan={lookup}
          onClose={() => setScanning(false)}
          hint="Tool serial or barcode"
        />
      )}
    </div>
  );
}

/* ── Step 2: action (checkout or return) ── */
function ActionStep({ tool, onBack, onSuccess }) {
  const canCheckout = tool.status === 'available';
  const canReturn   = tool.status === 'checked_out';

  // Checkout state
  const [returnDate,  setReturnDate]  = useState('');
  const [checkedTo,   setCheckedTo]   = useState('');

  // Return state
  const [condition,   setCondition]   = useState('good');

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function submitCheckout(e) {
    e.preventDefault();
    if (!checkedTo.trim()) { setError('Enter the tech name.'); return; }
    setError(''); setLoading(true);
    try {
      await client.post(`/tools/${tool.id}/checkout`, {
        checked_out_to:       checkedTo.trim(),
        expected_return_date: returnDate || undefined,
      });
      onSuccess({ action: 'checkout', tool, checkedTo: checkedTo.trim() });
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function submitReturn(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await client.post(`/tools/${tool.id}/checkin`, { condition });
      const goService = ['damaged'].includes(condition);
      onSuccess({ action: goService ? 'service' : 'return', tool, condition });
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col px-4 py-6 gap-5">
      {/* Tool card */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Wrench size={18} className="text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold">{tool.name}</p>
            <p className="text-slate-400 text-sm">{tool.serial_number ?? tool.sku}</p>
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0 ${STATUS_COLORS[tool.status] ?? 'bg-slate-700 text-slate-400'}`}>
            {tool.status?.replace(/_/g, ' ')}
          </span>
        </div>
        {tool.checked_out_to && (
          <p className="text-slate-400 text-sm mt-3 pt-3 border-t border-slate-700">
            Checked out to: <span className="text-white">{tool.checked_out_to}</span>
          </p>
        )}
      </div>

      {/* Cannot act */}
      {!canCheckout && !canReturn && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 text-center">
          <p className="text-slate-400 text-sm">
            This tool is <span className="text-white font-semibold">{tool.status?.replace(/_/g, ' ')}</span> and cannot be checked out or returned from the scanner.
          </p>
          <button onClick={onBack} className="mt-4 text-indigo-400 text-sm font-medium">
            ← Search again
          </button>
        </div>
      )}

      {/* Checkout form */}
      {canCheckout && (
        <form onSubmit={submitCheckout} className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <ArrowUpRight size={16} />
            Checking out this tool
          </div>

          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1.5">Your Name *</label>
            <input
              type="text"
              value={checkedTo}
              onChange={e => setCheckedTo(e.target.value)}
              placeholder="e.g. Carlos Mendez"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                         text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-base"
            />
          </div>

          <div>
            <label className="text-slate-300 text-sm font-medium block mb-1.5">Expected Return (optional)</label>
            <input
              type="date"
              value={returnDate}
              onChange={e => setReturnDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                         text-white focus:outline-none focus:border-amber-500 text-base"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-xl px-4 py-3">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onBack} className="flex-1 bg-slate-700 text-white rounded-xl py-3.5 font-semibold">Back</button>
            <button type="submit" disabled={loading} className="flex-1 bg-amber-500 disabled:opacity-60 text-white rounded-xl py-3.5 font-semibold">
              {loading ? 'Checking out…' : 'Check Out'}
            </button>
          </div>
        </form>
      )}

      {/* Return form */}
      {canReturn && (
        <form onSubmit={submitReturn} className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
            <ArrowDownLeft size={16} />
            Returning this tool
          </div>

          <div>
            <label className="text-slate-300 text-sm font-medium block mb-2">Condition *</label>
            <div className="grid grid-cols-2 gap-2">
              {CONDITION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCondition(opt.value)}
                  className={`py-3 px-3 rounded-xl border-2 text-sm font-semibold transition-colors
                    ${condition === opt.value ? opt.color : 'border-slate-700 text-slate-400 bg-slate-800'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {condition === 'damaged' && (
              <p className="text-red-300 text-xs mt-2 pl-1">⚠ Tool will be flagged for service.</p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-xl px-4 py-3">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onBack} className="flex-1 bg-slate-700 text-white rounded-xl py-3.5 font-semibold">Back</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 disabled:opacity-60 text-white rounded-xl py-3.5 font-semibold">
              {loading ? 'Returning…' : 'Return Tool'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ── Step 3: success ── */
function SuccessStep({ result, onAnother }) {
  const isService  = result.action === 'service';
  const isCheckout = result.action === 'checkout';

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 gap-6 text-center">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isService ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
        <CheckCircle size={40} className={isService ? 'text-amber-400' : 'text-emerald-400'} />
      </div>
      <div>
        <h2 className="text-white text-xl font-bold">
          {isCheckout ? 'Checked Out!' : isService ? 'Flagged for Service' : 'Returned!'}
        </h2>
        <p className="text-slate-400 mt-2 text-sm">
          <span className="text-white font-semibold">{result.tool.name}</span>
          {isCheckout && ` checked out to ${result.checkedTo}`}
          {isService  && ' has been flagged for service'}
          {result.action === 'return' && ' returned successfully'}
          .
        </p>
      </div>
      <button
        onClick={onAnother}
        className="w-full bg-amber-500 text-white rounded-2xl py-4 text-lg font-semibold active:bg-amber-600"
      >
        Scan Another Tool
      </button>
    </div>
  );
}

/* ── Page wrapper ── */
export default function ToolAction() {
  const [step, setStep]   = useState('search');
  const [tool, setTool]   = useState(null);
  const [result, setResult] = useState(null);

  if (step === 'success') {
    return <SuccessStep result={result} onAnother={() => { setStep('search'); setTool(null); }} />;
  }
  if (step === 'action' && tool) {
    return <ActionStep tool={tool} onBack={() => setStep('search')} onSuccess={r => { setResult(r); setStep('success'); }} />;
  }
  return <SearchStep onFound={t => { setTool(t); setStep('action'); }} />;
}
