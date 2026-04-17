/**
 * ReceivePO — mobile scanner flow for receiving PO deliveries.
 *
 * Steps:
 *   1. Lookup   — scan barcode or type PO# / ST PO# to find a sent/partial PO
 *   2. Receive  — confirm quantities per line item; submit each via API
 *   3. Done     — summary of session + optional ST sync push
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScanLine, Search, PackageCheck, CheckCircle, AlertTriangle,
  ChevronRight, RotateCcw, Zap, ArrowLeft, Minus, Plus,
  Package, Loader2, Upload,
} from 'lucide-react';
import BarcodeScanner from '../../components/scanner/BarcodeScanner.jsx';
import client from '../../api/client.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_LABEL = {
  sent:               { label: 'Awaiting Delivery', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  partially_received: { label: 'Partial Receipt',   cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
};

// ── Step 1: PO Lookup ─────────────────────────────────────────────────────────
function LookupStep({ onFound }) {
  const [scanning, setScanning] = useState(false);
  const [query,    setQuery]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function lookup(value) {
    const raw = value.trim();
    if (!raw) return;
    setError('');
    setLoading(true);
    setScanning(false);
    try {
      const { data } = await client.get('/purchase-orders', { params: { limit: 200 } });
      const all  = data.purchase_orders ?? [];
      const match = all.find(p =>
        p.po_number?.toLowerCase()    === raw.toLowerCase() ||
        p.st_po_number?.toLowerCase() === raw.toLowerCase()
      );

      if (!match) {
        setError(`No PO found for "${raw}"`);
        return;
      }
      if (!['sent', 'partially_received'].includes(match.status)) {
        setError(`PO ${match.po_number} has status "${match.status.replace(/_/g,' ')}" — only Sent or Partial POs can be received.`);
        return;
      }
      onFound(match);
    } catch {
      setError('Lookup failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    lookup(query);
  }

  if (scanning) {
    return (
      <BarcodeScanner
        onDetected={v => { setQuery(v); lookup(v); }}
        onClose={() => setScanning(false)}
      />
    );
  }

  return (
    <div className="flex flex-col px-4 py-6 gap-6">
      <div>
        <h2 className="text-white text-xl font-bold">Receive Delivery</h2>
        <p className="text-slate-400 text-sm mt-1">Scan or enter the PO number to begin</p>
      </div>

      {/* Scan button */}
      <button
        onClick={() => setScanning(true)}
        className="flex items-center justify-center gap-3 bg-violet-600 active:bg-violet-700
                   text-white rounded-2xl py-5 text-lg font-semibold transition-colors"
      >
        <ScanLine size={24} />
        Scan PO Barcode
      </button>

      {/* Manual entry */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="PO-2024-003 or ST-24-10042"
            autoCapitalize="characters"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-3.5
                       text-white placeholder-slate-500 focus:outline-none focus:border-violet-500
                       text-base font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white
                     rounded-xl px-4 transition-colors flex items-center"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-900/40 border border-red-500/40 rounded-xl px-4 py-3.5">
          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Hint */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 px-4 py-3">
        <p className="text-slate-400 text-xs leading-relaxed">
          Enter the PO number (e.g. <span className="font-mono text-slate-300">PO-2024-003</span>) or
          the ServiceTitan PO# (e.g. <span className="font-mono text-slate-300">ST-24-10055</span>).
          Only POs with status <strong className="text-slate-300">Sent</strong> or{' '}
          <strong className="text-slate-300">Partial</strong> can be received.
        </p>
      </div>
    </div>
  );
}

// ── Step 2: Receive Lines ─────────────────────────────────────────────────────
function ReceiveStep({ po, onDone }) {
  const [lines,    setLines]    = useState(null);   // fetched on mount
  const [loadingL, setLoadingL] = useState(true);
  const [received, setReceived] = useState({});     // lineId → qty confirmed this session
  const [inputs,   setInputs]   = useState({});     // lineId → current input value
  const [busy,     setBusy]     = useState({});     // lineId → bool
  const [errors,   setErrors]   = useState({});     // lineId → error string

  // Fetch lines on mount
  useEffect(() => {
    client.get(`/purchase-orders/${po.id}`)
      .then(({ data }) => {
        const ls = data.lines ?? [];
        setLines(ls);
        // Default input to remaining qty for each pending line
        const init = {};
        ls.forEach(l => {
          const remaining = Number(l.qty_ordered) - Number(l.qty_received ?? 0);
          init[l.id] = remaining > 0 ? remaining : 0;
        });
        setInputs(init);
      })
      .catch(() => setLines([]))
      .finally(() => setLoadingL(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po.id]);

  const pendingLines   = (lines ?? []).filter(l =>
    Number(l.qty_received ?? 0) < Number(l.qty_ordered ?? 0) &&
    !received[l.id]
  );
  const confirmedLines = (lines ?? []).filter(l =>
    Number(l.qty_received ?? 0) >= Number(l.qty_ordered ?? 0) || received[l.id]
  );

  async function confirmLine(line) {
    const qty = Number(inputs[line.id]);
    if (!qty || qty <= 0) return;
    setBusy(b => ({ ...b, [line.id]: true }));
    setErrors(e => ({ ...e, [line.id]: '' }));
    try {
      await client.post(`/purchase-orders/${po.id}/lines/${line.id}/receive`, {
        qty_received: qty,
      });
      setReceived(r => ({ ...r, [line.id]: qty }));
    } catch (err) {
      setErrors(e => ({ ...e, [line.id]: err.response?.data?.error ?? 'Failed — try again' }));
    } finally {
      setBusy(b => ({ ...b, [line.id]: false }));
    }
  }

  function adjustInput(id, delta) {
    setInputs(prev => {
      const line = (lines ?? []).find(l => l.id === id);
      if (!line) return prev;
      const max  = Number(line.qty_ordered) - Number(line.qty_received ?? 0);
      const next = Math.min(max, Math.max(1, (Number(prev[id]) || 0) + delta));
      return { ...prev, [id]: next };
    });
  }

  const allDone = pendingLines.length === 0 && (lines ?? []).length > 0;

  const cfg = STATUS_LABEL[po.status] ?? STATUS_LABEL.sent;

  return (
    <div className="flex flex-col pb-24">
      {/* PO header */}
      <div className="px-4 pt-5 pb-4 bg-slate-800/60 border-b border-slate-700/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-slate-400 text-xs mb-0.5">Purchase Order</p>
            <p className="text-white text-lg font-bold font-mono">{po.po_number}</p>
            <p className="text-slate-400 text-sm mt-0.5">{po.supply_house_name ?? po.vendor ?? '—'}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
            {cfg.label}
          </span>
        </div>

        {/* Progress bar */}
        {!loadingL && lines && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>{confirmedLines.length} of {lines.length} lines received</span>
              <span>{pendingLines.length} pending</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all"
                style={{ width: `${lines.length > 0 ? (confirmedLines.length / lines.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="flex flex-col px-4 pt-4 gap-3">
        {loadingL ? (
          <div className="flex justify-center py-10">
            <Loader2 size={28} className="text-violet-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* Pending lines */}
            {pendingLines.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Pending Receipt
                </p>
                <div className="flex flex-col gap-3">
                  {pendingLines.map(line => {
                    const remaining = Number(line.qty_ordered) - Number(line.qty_received ?? 0);
                    const inputVal  = inputs[line.id] ?? remaining;
                    const isBusy    = busy[line.id];
                    const lineErr   = errors[line.id];

                    return (
                      <div
                        key={line.id}
                        className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden"
                      >
                        {/* Material info */}
                        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
                            <Package size={18} className="text-slate-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-sm leading-tight">
                              {line.material_name ?? line.name ?? line.material_id}
                            </p>
                            {line.part_number && (
                              <p className="text-slate-400 text-xs font-mono mt-0.5">{line.part_number}</p>
                            )}
                            <p className="text-slate-400 text-xs mt-1">
                              Ordered: <span className="text-slate-300 font-medium">{line.qty_ordered}</span>
                              {Number(line.qty_received) > 0 && (
                                <span> · Already received: <span className="text-amber-300 font-medium">{line.qty_received}</span></span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Qty stepper */}
                        <div className="flex items-center justify-between px-4 pb-4 gap-3">
                          <div className="flex items-center gap-0 bg-slate-700 rounded-xl overflow-hidden border border-slate-600">
                            <button
                              onClick={() => adjustInput(line.id, -1)}
                              className="px-3 py-2.5 text-slate-300 hover:bg-slate-600 active:bg-slate-500 transition-colors"
                            >
                              <Minus size={16} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={remaining}
                              value={inputVal}
                              onChange={e => setInputs(i => ({ ...i, [line.id]: e.target.value }))}
                              className="w-14 text-center bg-transparent text-white font-bold text-lg
                                         focus:outline-none py-2"
                            />
                            <button
                              onClick={() => adjustInput(line.id, 1)}
                              className="px-3 py-2.5 text-slate-300 hover:bg-slate-600 active:bg-slate-500 transition-colors"
                            >
                              <Plus size={16} />
                            </button>
                          </div>

                          <span className="text-slate-400 text-xs">of {remaining} remaining</span>

                          <button
                            onClick={() => confirmLine(line)}
                            disabled={isBusy || !inputVal || Number(inputVal) <= 0}
                            className="flex items-center gap-1.5 bg-violet-600 active:bg-violet-700
                                       disabled:opacity-40 text-white rounded-xl px-4 py-2.5
                                       font-semibold text-sm transition-colors"
                          >
                            {isBusy
                              ? <Loader2 size={15} className="animate-spin" />
                              : <CheckCircle size={15} />
                            }
                            {isBusy ? 'Saving…' : 'Confirm'}
                          </button>
                        </div>

                        {lineErr && (
                          <div className="px-4 pb-3">
                            <p className="text-red-400 text-xs flex items-center gap-1">
                              <AlertTriangle size={12} /> {lineErr}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Already received / just confirmed lines */}
            {confirmedLines.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Received
                </p>
                <div className="flex flex-col gap-2">
                  {confirmedLines.map(line => (
                    <div
                      key={line.id}
                      className="flex items-center gap-3 bg-slate-800/50 border border-emerald-500/30
                                 rounded-2xl px-4 py-3"
                    >
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle size={16} className="text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 font-medium text-sm truncate">
                          {line.material_name ?? line.name ?? line.material_id}
                        </p>
                        <p className="text-slate-400 text-xs">
                          {received[line.id]
                            ? <span className="text-emerald-400">+{received[line.id]} received this session</span>
                            : `${line.qty_received} / ${line.qty_ordered} received`
                          }
                        </p>
                      </div>
                      <PackageCheck size={16} className="text-emerald-400 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty */}
            {!loadingL && (lines ?? []).length === 0 && (
              <div className="text-center py-10">
                <p className="text-slate-400 text-sm">No line items on this PO.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Done button */}
      <div className="fixed bottom-14 left-0 right-0 px-4 max-w-lg mx-auto">
        <button
          onClick={() => onDone(Object.keys(received).length)}
          disabled={!allDone && Object.keys(received).length === 0}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-colors shadow-xl
            ${allDone
              ? 'bg-emerald-600 text-white active:bg-emerald-700'
              : Object.keys(received).length > 0
              ? 'bg-slate-700 text-white active:bg-slate-600 border border-slate-600'
              : 'bg-slate-800 text-slate-500 border border-slate-700 opacity-50'
            }`}
        >
          {allDone
            ? '✓ All Lines Received — Finish'
            : Object.keys(received).length > 0
            ? `Finish (${Object.keys(received).length} line${Object.keys(received).length !== 1 ? 's' : ''} confirmed)`
            : 'Confirm lines above to finish'
          }
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Done / Summary ────────────────────────────────────────────────────
function DoneStep({ po, receivedCount, onGoHome, onAnotherPO }) {
  const [syncing,  setSyncing]  = useState(false);
  const [syncMsg,  setSyncMsg]  = useState(null);

  const isSynced = po.st_sync_status === 'synced';

  async function handleSTSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const { data } = await client.post(`/purchase-orders/${po.id}/st-pull`);
      setSyncMsg({ ok: true, text: `ServiceTitan updated · ${data.lines_updated ?? 0} line(s) synced` });
    } catch (err) {
      setSyncMsg({ ok: false, text: err.response?.data?.error ?? 'ST sync failed' });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col items-center px-4 py-8 gap-6">
      {/* Success icon */}
      <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
        <CheckCircle size={40} className="text-emerald-400" />
      </div>

      <div className="text-center">
        <h2 className="text-white text-2xl font-bold">Delivery Received!</h2>
        <p className="text-slate-400 text-sm mt-2">
          <span className="font-mono text-slate-200">{po.po_number}</span> has been updated.
        </p>
        {receivedCount > 0 && (
          <p className="text-emerald-400 text-sm mt-1">
            {receivedCount} line{receivedCount !== 1 ? 's' : ''} confirmed this session.
          </p>
        )}
      </div>

      {/* ST Sync option */}
      {isSynced && (
        <div className="w-full bg-slate-800 border border-indigo-500/30 rounded-2xl px-4 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-indigo-400" />
            <p className="text-sm font-semibold text-slate-200">Update ServiceTitan</p>
          </div>
          <p className="text-slate-400 text-xs mb-3">
            This PO is linked to ST&nbsp;{po.st_po_number}. Push the receipt update now.
          </p>
          {syncMsg && (
            <div className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 mb-3 border
              ${syncMsg.ok
                ? 'bg-emerald-900/40 border-emerald-500/40 text-emerald-300'
                : 'bg-red-900/40 border-red-500/40 text-red-300'}`}>
              {syncMsg.ok
                ? <CheckCircle size={13} />
                : <AlertTriangle size={13} />
              }
              {syncMsg.text}
            </div>
          )}
          <button
            onClick={handleSTSync}
            disabled={syncing || syncMsg?.ok}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600
                       active:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-3
                       font-semibold text-sm transition-colors"
          >
            {syncing
              ? <><Loader2 size={15} className="animate-spin" /> Syncing…</>
              : syncMsg?.ok
              ? <><CheckCircle size={15} /> ST Updated</>
              : <><Upload size={15} /> Push to ServiceTitan</>
            }
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full">
        <button
          onClick={onAnotherPO}
          className="w-full flex items-center justify-center gap-2 bg-slate-800
                     border border-slate-600 active:bg-slate-700 text-white
                     rounded-2xl py-4 font-semibold transition-colors"
        >
          <RotateCcw size={18} />
          Receive Another PO
        </button>
        <button
          onClick={onGoHome}
          className="w-full flex items-center justify-center gap-2 bg-violet-600
                     active:bg-violet-700 text-white rounded-2xl py-4 font-bold
                     text-base transition-colors"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReceivePO() {
  const navigate = useNavigate();
  const [step,          setStep]          = useState('lookup'); // 'lookup' | 'receive' | 'done'
  const [po,            setPO]            = useState(null);
  const [receivedCount, setReceivedCount] = useState(0);

  function handleFound(foundPO) {
    setPO(foundPO);
    setStep('receive');
  }

  function handleDone(count = 0) {
    setReceivedCount(count);
    setStep('done');
  }

  function reset() {
    setPO(null);
    setReceivedCount(0);
    setStep('lookup');
  }

  return (
    <div className="flex flex-col flex-1">
      {step === 'lookup' && <LookupStep onFound={handleFound} />}
      {step === 'receive' && po && (
        <ReceiveStep
          po={po}
          onDone={count => handleDone(count)}
        />
      )}
      {step === 'done' && po && (
        <DoneStep
          po={po}
          receivedCount={receivedCount}
          onGoHome={() => navigate('/scanner')}
          onAnotherPO={reset}
        />
      )}
    </div>
  );
}
