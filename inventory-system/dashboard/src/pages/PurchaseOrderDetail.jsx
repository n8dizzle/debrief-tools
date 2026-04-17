/**
 * Purchase Order Detail — review, add lines, send to supply house, receive delivery
 *
 * PO lifecycle:  draft → sent → partially_received → received
 *
 * Actions available per status:
 *   draft    — add lines, edit, send (email)
 *   sent     — receive lines (mark as received)
 *   partial  — continue receiving
 *   received — read-only view
 */

import { useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft, Send, PackageCheck, Plus, Trash2, CheckCircle2,
  AlertCircle, RotateCcw, ShoppingCart, FileText, Zap,
  ChevronDown, ChevronUp, Clock, Package, ExternalLink,
  Upload, Download, Link2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Header       from '../components/Header.jsx';
import Badge        from '../components/ui/Badge.jsx';
import { SkeletonRow, Spinner } from '../components/ui/Spinner.jsx';
import { usePODetail } from '../hooks/usePurchaseOrders.js';
import client       from '../api/client.js';

// ── Currency formatter ────────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// ── Stepper ───────────────────────────────────────────────────────────────────
const STEPS = [
  { key: 'draft',              label: 'Draft' },
  { key: 'sent',               label: 'Sent' },
  { key: 'partially_received', label: 'Partial' },
  { key: 'received',           label: 'Received' },
];

function Stepper({ status }) {
  const stepOrder = STEPS.map(s => s.key);
  // partially_received is an optional intermediate; collapse it if not reached
  const showPartial = ['partially_received', 'received'].includes(status);

  const visibleSteps = STEPS.filter(s =>
    s.key !== 'partially_received' || showPartial
  );

  const currentIdx = stepOrder.indexOf(status);

  return (
    <div className="flex items-center gap-0">
      {visibleSteps.map((step, i) => {
        const stepIdx  = stepOrder.indexOf(step.key);
        const isDone   = stepIdx < currentIdx;
        const isCur    = stepIdx === currentIdx;
        const isLast   = i === visibleSteps.length - 1;

        return (
          <div key={step.key} className="flex items-center">
            {/* Node */}
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${isDone ? 'bg-indigo-500 border-indigo-500 text-white'
                  : isCur ? 'bg-white border-indigo-500 text-indigo-600'
                  : 'bg-white border-slate-200 text-slate-300'}`}>
                {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap
                ${isDone || isCur ? 'text-indigo-600' : 'text-slate-300'}`}>
                {step.label}
              </span>
            </div>
            {/* Connector */}
            {!isLast && (
              <div className={`h-0.5 w-10 mx-1 mb-4 rounded-full transition-all
                ${isDone ? 'bg-indigo-400' : 'bg-slate-100'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── PO stats pills ────────────────────────────────────────────────────────────
function POStats({ po, lines }) {
  const totalLines    = lines.length;
  const receivedLines = lines.filter(l => l.status === 'received' || Number(l.qty_received) >= Number(l.qty_ordered)).length;
  const pendingLines  = totalLines - receivedLines;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {[
        { label: 'Lines',     val: totalLines,    color: 'bg-slate-100 text-slate-600' },
        { label: 'Received',  val: receivedLines, color: 'bg-emerald-50 text-emerald-700' },
        { label: 'Pending',   val: pendingLines,  color: pendingLines > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-400' },
        { label: 'Total',     val: fmt.format(po.total_value ?? po.total_amount ?? 0), color: 'bg-indigo-50 text-indigo-700' },
      ].map(({ label, val, color }) => (
        <div key={label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${color}`}>
          <span className="opacity-60">{label}</span>
          <span>{val}</span>
        </div>
      ))}
    </div>
  );
}

// ── Add line form ─────────────────────────────────────────────────────────────
function AddLinePanel({ poId, onAdded }) {
  const [open, setOpen]     = useState(false);
  const [form, setForm]     = useState({ material_id: '', qty_ordered: 1, unit_cost: '' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await client.post(`/purchase-orders/${poId}/lines`, {
        material_id:  form.material_id,
        qty_ordered:  Number(form.qty_ordered),
        unit_cost:    form.unit_cost ? Number(form.unit_cost) : undefined,
      });
      setForm({ material_id: '', qty_ordered: 1, unit_cost: '' });
      onAdded();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to add line');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-dashed border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3
                   text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2 font-medium">
          <Plus className="w-4 h-4" />
          Add line item
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <form onSubmit={handleAdd} className="px-4 pb-4 space-y-3 bg-slate-50">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="col-span-3 sm:col-span-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">Material ID</label>
              <input
                required
                type="text"
                placeholder="UUID…"
                value={form.material_id}
                onChange={e => setForm(f => ({ ...f, material_id: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Qty</label>
              <input
                required
                type="number"
                min="1"
                value={form.qty_ordered}
                onChange={e => setForm(f => ({ ...f, qty_ordered: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Unit Cost (opt.)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="auto"
                value={form.unit_cost}
                onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg
                         bg-indigo-600 text-white font-medium hover:bg-indigo-700
                         disabled:opacity-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {saving ? 'Adding…' : 'Add Line'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Line row ──────────────────────────────────────────────────────────────────
function LineRow({ line, poStatus, onReceived }) {
  const canReceive   = ['sent', 'partially_received'].includes(poStatus);
  const qtyOrdered   = Number(line.qty_ordered  ?? 0);
  const qtyReceived  = Number(line.qty_received ?? 0);
  const isFullyRcvd  = qtyReceived >= qtyOrdered;

  const [receiveQty, setReceiveQty] = useState(qtyOrdered - qtyReceived);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState(null);
  const [expanded,   setExpanded]   = useState(false);

  async function handleReceive(e) {
    e.preventDefault();
    if (!receiveQty || receiveQty <= 0) return;
    setSaving(true);
    setError(null);
    try {
      await client.post(`/purchase-orders/${line.purchase_order_id}/lines/${line.id}/receive`, {
        qty_received: Number(receiveQty),
      });
      onReceived();
      setExpanded(false);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Receive failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
        {/* Material */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Package className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">{line.material_name ?? line.material_id}</p>
              {(line.sku ?? line.part_number) && (
                <p className="text-[11px] text-slate-400 font-mono">{line.sku ?? line.part_number}</p>
              )}
            </div>
          </div>
        </td>

        {/* Qty ordered */}
        <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{qtyOrdered}</td>

        {/* Qty received */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isFullyRcvd ? 'bg-emerald-500' : 'bg-blue-400'}`}
                style={{ width: `${Math.min(100, (qtyReceived / qtyOrdered) * 100)}%` }}
              />
            </div>
            <span className={`text-sm tabular-nums font-medium ${isFullyRcvd ? 'text-emerald-600' : 'text-slate-600'}`}>
              {qtyReceived}
            </span>
          </div>
        </td>

        {/* Unit cost */}
        <td className="px-4 py-3 text-sm tabular-nums text-slate-500">
          {line.unit_cost != null ? fmt.format(line.unit_cost) : '—'}
        </td>

        {/* Line total */}
        <td className="px-4 py-3 text-sm tabular-nums font-semibold text-slate-700">
          {line.line_total != null ? fmt.format(line.line_total) : '—'}
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          {isFullyRcvd
            ? <Badge status="received" dot>Received</Badge>
            : qtyReceived > 0
            ? <Badge status="partially_received" dot>Partial</Badge>
            : <Badge status="sent" dot>Pending</Badge>
          }
        </td>

        {/* Receive button */}
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          {canReceive && !isFullyRcvd && (
            <button
              onClick={() => setExpanded(x => !x)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors
                ${expanded
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                }`}
            >
              <PackageCheck className="w-3 h-3" />
              Receive
            </button>
          )}
          {isFullyRcvd && (
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <CheckCircle2 className="w-3 h-3" />
              Done
            </span>
          )}
        </td>
      </tr>

      {/* Expanded receive form */}
      {expanded && (
        <tr className="bg-emerald-50/60 border-b border-slate-100">
          <td colSpan={7} className="px-4 py-3">
            <form onSubmit={handleReceive} className="flex items-center gap-3 flex-wrap">
              {error && (
                <span className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="w-3 h-3" /> {error}
                </span>
              )}
              <label className="text-xs font-medium text-slate-600">Qty receiving:</label>
              <input
                type="number"
                min="1"
                max={qtyOrdered - qtyReceived}
                value={receiveQty}
                onChange={e => setReceiveQty(e.target.value)}
                className="w-20 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5
                           focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
              />
              <span className="text-xs text-slate-400">of {qtyOrdered - qtyReceived} remaining</span>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg
                           bg-emerald-600 text-white font-medium hover:bg-emerald-700
                           disabled:opacity-50 transition-colors"
              >
                <PackageCheck className="w-3 h-3" />
                {saving ? 'Saving…' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

// ── ServiceTitan Sync Panel ───────────────────────────────────────────────────
const ST_STATUS_CFG = {
  synced:     { dot: 'bg-emerald-500', label: 'Synced',      cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  not_synced: { dot: 'bg-slate-300',   label: 'Not synced',  cls: 'text-slate-500   bg-slate-50   border-slate-200'   },
  linked:     { dot: 'bg-blue-400',    label: 'Linked',      cls: 'text-blue-700    bg-blue-50    border-blue-200'    },
  error:      { dot: 'bg-red-500',     label: 'Sync error',  cls: 'text-red-700     bg-red-50     border-red-200'     },
};

function STSyncPanel({ po, onRefresh }) {
  const [stNum,    setStNum]    = useState(po.st_po_number ?? '');
  const [pushing,  setPushing]  = useState(false);
  const [pulling,  setPulling]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState(null); // { type: 'success'|'error', text }

  const isSynced = po.st_sync_status === 'synced';
  const stUrl    = po.st_po_number
    ? `https://go.servicetitan.com/#/Inventory/PurchaseOrders/Detail/${po.st_po_number}`
    : null;

  const cfg = ST_STATUS_CFG[po.st_sync_status] ?? ST_STATUS_CFG.not_synced;

  async function handlePush() {
    setPushing(true);
    setMsg(null);
    try {
      const { data } = await client.post(`/purchase-orders/${po.id}/st-push`,
        stNum ? { st_po_number: stNum } : {}
      );
      setStNum(data.st_po_number ?? stNum);
      setMsg({ type: 'success', text: `Pushed to ServiceTitan as ${data.st_po_number}` });
      onRefresh();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error ?? 'Push failed' });
    } finally {
      setPushing(false);
    }
  }

  async function handlePull() {
    setPulling(true);
    setMsg(null);
    try {
      const { data } = await client.post(`/purchase-orders/${po.id}/st-pull`);
      const updated  = data.lines_updated ?? 0;
      setMsg({ type: 'success', text: `Pulled from ServiceTitan · ${updated} line${updated !== 1 ? 's' : ''} updated` });
      onRefresh();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error ?? 'Pull failed' });
    } finally {
      setPulling(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await client.patch(`/purchase-orders/${po.id}`, { st_po_number: stNum || null });
      setMsg({ type: 'success', text: 'ST PO# saved' });
      onRefresh();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error ?? 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  const numChanged = stNum !== (po.st_po_number ?? '');

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">ServiceTitan Sync</p>
            <p className="text-[11px] text-slate-400">Link and sync this PO with ServiceTitan</p>
          </div>
        </div>
        {/* Status pill */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${cfg.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
          {cfg.label}
        </div>
      </div>

      {/* Panel body */}
      <div className="px-5 py-4 space-y-3">
        {/* Message banner */}
        {msg && (
          <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border
            ${msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'}`}>
            {msg.type === 'success'
              ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              : <AlertCircle  className="w-3.5 h-3.5 shrink-0" />}
            {msg.text}
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-end gap-3 flex-wrap">
          {/* ST PO# input */}
          <form onSubmit={handleSave} className="flex items-end gap-2 flex-1 min-w-[220px]">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                ST PO Number
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="e.g. ST-24-10042"
                  value={stNum}
                  onChange={e => setStNum(e.target.value)}
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 font-mono
                             focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {stUrl && (
                  <a
                    href={stUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in ServiceTitan"
                    className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200
                               text-indigo-500 hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
            {numChanged && (
              <button
                type="submit"
                disabled={saving}
                className="text-xs px-3 py-2 rounded-lg bg-slate-700 text-white
                           font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </form>

          {/* Push / Pull buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePush}
              disabled={pushing || pulling}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg
                         bg-indigo-600 text-white font-medium hover:bg-indigo-700
                         disabled:opacity-50 transition-colors"
              title="Send this PO to ServiceTitan (creates or updates ST record)"
            >
              <Upload className="w-3.5 h-3.5" />
              {pushing ? 'Pushing…' : 'Push to ST'}
            </button>
            <button
              onClick={handlePull}
              disabled={pushing || pulling || !isSynced}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg
                         bg-emerald-600 text-white font-medium hover:bg-emerald-700
                         disabled:opacity-50 transition-colors"
              title={!isSynced ? 'Push to ST first to enable pull' : 'Pull receipt status updates from ServiceTitan'}
            >
              <Download className="w-3.5 h-3.5" />
              {pulling ? 'Pulling…' : 'Pull from ST'}
            </button>
          </div>
        </div>

        {/* Last sync timestamp */}
        {po.st_last_sync_at && (
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last synced {formatDistanceToNow(new Date(po.st_last_sync_at), { addSuffix: true })}
            {po.st_po_number && (
              <span className="ml-1 font-mono text-slate-500">· {po.st_po_number}</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Send PO action ────────────────────────────────────────────────────────────
function SendPOButton({ poId, onSent }) {
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!confirm('Send this PO to the supply house via email?')) return;
    setLoading(true);
    try {
      await client.post(`/purchase-orders/${poId}/send`);
      onSent();
    } catch (err) {
      alert(err.response?.data?.error ?? 'Send failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={loading}
      className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg
                 bg-blue-600 text-white font-medium hover:bg-blue-700
                 disabled:opacity-50 transition-colors"
    >
      <Send className="w-3.5 h-3.5" />
      {loading ? 'Sending…' : 'Send PO Email'}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { collapsed, onToggleSidebar } = useOutletContext();
  const { po, lines, loading, error, refresh } = usePODetail(id);

  const [lineFilter, setLineFilter] = useState('all');

  const isDraft    = po?.status === 'draft';
  const isSent     = po?.status === 'sent';
  const isPartial  = po?.status === 'partially_received';
  const isReceived = po?.status === 'received';
  const canReceive = isSent || isPartial;
  const canSend    = isDraft;

  // Filter lines by receive status
  const filteredLines = lines.filter(l => {
    if (lineFilter === 'all')      return true;
    if (lineFilter === 'pending')  return Number(l.qty_received ?? 0) < Number(l.qty_ordered ?? 0);
    if (lineFilter === 'received') return Number(l.qty_received ?? 0) >= Number(l.qty_ordered ?? 0);
    return true;
  });

  const pendingCount  = lines.filter(l => Number(l.qty_received ?? 0) < Number(l.qty_ordered ?? 0)).length;
  const receivedCount = lines.filter(l => Number(l.qty_received ?? 0) >= Number(l.qty_ordered ?? 0)).length;

  if (loading) {
    return (
      <>
        <Header
          title="Purchase Order"
          subtitle="Loading…"
          collapsed={collapsed}
          onToggleSidebar={onToggleSidebar}
        />
        <main className="flex-1 flex items-center justify-center">
          <Spinner size="lg" className="text-indigo-400" />
        </main>
      </>
    );
  }

  if (error || !po) {
    return (
      <>
        <Header
          title="Purchase Order"
          subtitle="Error loading PO"
          collapsed={collapsed}
          onToggleSidebar={onToggleSidebar}
        />
        <main className="flex-1 px-6 py-6">
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error ?? 'Purchase order not found'}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header
        title={po.po_number}
        subtitle={`${po.vendor ?? po.supply_house_name ?? 'Unknown vendor'} · ${po.warehouse_name ?? ''}`}
        collapsed={collapsed}
        onToggleSidebar={onToggleSidebar}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700
                         px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Refresh
            </button>
            {canSend && <SendPOButton poId={po.id} onSent={refresh} />}
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

        {/* Header card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 space-y-4">
          {/* Back + status row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <button
              onClick={() => navigate('/purchase-orders')}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              All POs
            </button>
            <div className="flex items-center gap-3">
              {po.po_type === 'emergency' && (
                <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                  <Zap className="w-3 h-3" /> Emergency
                </span>
              )}
              <Badge status={po.status} dot>
                {po.status.replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>

          {/* Stepper */}
          <Stepper status={po.status} />

          {/* Meta row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {[
              { label: 'Department',    val: po.department ?? '—' },
              { label: 'Created',       val: po.created_at ? format(new Date(po.created_at), 'MMM d, yyyy') : '—' },
              { label: 'Sent',          val: po.sent_at ? format(new Date(po.sent_at), 'MMM d, yyyy') : '—' },
              { label: 'Notes',         val: po.notes ?? '—' },
            ].map(({ label, val }) => (
              <div key={label}>
                <p className="text-xs text-slate-400 font-medium">{label}</p>
                <p className="text-slate-700 mt-0.5 truncate">{val}</p>
              </div>
            ))}
          </div>

          {/* Stats */}
          <POStats po={po} lines={lines} />
        </div>

        {/* ServiceTitan sync panel */}
        <STSyncPanel po={po} onRefresh={refresh} />

        {/* Add line (draft only) */}
        {isDraft && (
          <AddLinePanel poId={po.id} onAdded={refresh} />
        )}

        {/* Lines table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Filter tabs */}
          <div className="flex items-center gap-0 border-b border-slate-100 px-2 pt-2">
            {[
              { key: 'all',      label: 'All Lines',  count: lines.length },
              { key: 'pending',  label: 'Pending',    count: pendingCount },
              { key: 'received', label: 'Received',   count: receivedCount },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setLineFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap
                  border-b-2 transition-colors -mb-px
                  ${lineFilter === tab.key
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
                  }`}
              >
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold
                  ${lineFilter === tab.key ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                  {tab.count}
                </span>
              </button>
            ))}

            {/* Receiving hint */}
            {canReceive && pendingCount > 0 && (
              <span className="ml-auto mr-3 text-xs text-amber-500 font-medium flex items-center gap-1">
                <PackageCheck className="w-3.5 h-3.5" />
                {pendingCount} line{pendingCount !== 1 ? 's' : ''} to receive
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Ordered</th>
                  <th>Received</th>
                  <th>Unit Cost</th>
                  <th>Line Total</th>
                  <th>Status</th>
                  <th>{canReceive ? 'Receive' : ''}</th>
                </tr>
              </thead>
              <tbody>
                {filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                      {lines.length === 0 ? 'No lines on this PO yet.' : 'No lines match the filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredLines.map(line => (
                    <LineRow
                      key={line.id}
                      line={line}
                      poStatus={po.status}
                      onReceived={refresh}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Total footer */}
          {lines.length > 0 && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {lines.length} line{lines.length !== 1 ? 's' : ''}
                {isReceived && ' · fully received'}
              </span>
              <span className="text-sm font-semibold text-slate-700">
                PO Total: {fmt.format(po.total_value ?? po.total_amount ?? 0)}
              </span>
            </div>
          )}
        </div>

        {/* Completed banner */}
        {isReceived && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Delivery fully received</p>
              {po.received_at && (
                <p className="text-xs text-emerald-600 mt-0.5">
                  Completed {formatDistanceToNow(new Date(po.received_at), { addSuffix: true })}
                </p>
              )}
            </div>
          </div>
        )}

      </main>
    </>
  );
}
