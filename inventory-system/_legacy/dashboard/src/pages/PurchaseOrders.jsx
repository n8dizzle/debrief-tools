/**
 * Purchase Orders — list page
 *
 * Shows all POs filterable by status.
 * Managers create emergency POs; weekly POs are auto-generated Monday 7 AM.
 *
 * PO lifecycle:  draft → sent → partially_received → received
 *                      → cancelled (any time before received)
 */

import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  ShoppingCart, Plus, RotateCcw, AlertCircle,
  ChevronRight, Send, PackageCheck, Clock, CheckCircle2,
  FileText, Zap, Link2, Minus,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import Header       from '../components/Header.jsx';
import Badge        from '../components/ui/Badge.jsx';
import { SkeletonRow } from '../components/ui/Spinner.jsx';
import EmptyState   from '../components/ui/EmptyState.jsx';
import { usePOList } from '../hooks/usePurchaseOrders.js';
import client       from '../api/client.js';

// ── Status tab config ─────────────────────────────────────────────────────────
const TABS = [
  { key: 'all',                label: 'All',             color: 'text-slate-600' },
  { key: 'draft',              label: 'Draft',           color: 'text-slate-600' },
  { key: 'sent',               label: 'Sent',            color: 'text-blue-600' },
  { key: 'partially_received', label: 'Partial',         color: 'text-amber-600' },
  { key: 'received',           label: 'Received',        color: 'text-emerald-600' },
  { key: 'cancelled',          label: 'Cancelled',       color: 'text-red-500' },
];

// ── Currency formatter ────────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// ── Receive progress bar ──────────────────────────────────────────────────────
function ReceiveBar({ received, total }) {
  const pct = total > 0 ? Math.round((received / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-slate-500 whitespace-nowrap">
        {received}/{total}
      </span>
    </div>
  );
}

// ── ST sync status indicator ──────────────────────────────────────────────────
function STStatusCell({ po }) {
  if (po.st_sync_status === 'synced' && po.st_po_number) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-xs font-mono text-slate-700 font-medium">{po.st_po_number}</span>
      </div>
    );
  }
  if (po.st_po_number) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
        <span className="text-xs font-mono text-slate-500">{po.st_po_number}</span>
      </div>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-slate-300">
      <Minus className="w-3 h-3" />
    </span>
  );
}

// ── Trigger weekly PO run ─────────────────────────────────────────────────────
function RunPOButton({ onSuccess }) {
  const [loading, setLoading] = useState(false);

  async function handleRun(e) {
    e.stopPropagation();
    if (!confirm('Trigger the weekly PO run now? This generates POs for all items below reorder threshold.')) return;
    setLoading(true);
    try {
      const { data } = await client.post('/admin/jobs/po-run');
      alert(`PO run complete: ${data.pos_created ?? 0} PO(s) created, ${data.lines_added ?? 0} line(s) added.`);
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.error ?? 'PO run failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRun}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800
                 px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50
                 transition-colors disabled:opacity-50"
      title="Run weekly PO generation now"
    >
      <Zap className="w-3.5 h-3.5" />
      {loading ? 'Running…' : 'Run PO'}
    </button>
  );
}

// ── PO row ────────────────────────────────────────────────────────────────────
function PORow({ po }) {
  const navigate = useNavigate();

  const totalLines    = Number(po.line_count     ?? 0);
  const receivedLines = Number(po.received_count ?? 0);
  const isDraft       = po.status === 'draft';
  const isSent        = po.status === 'sent';
  const isPartial     = po.status === 'partially_received';
  const isReceived    = po.status === 'received';
  const isCancelled   = po.status === 'cancelled';

  const canView = !isCancelled;

  function statusIcon() {
    if (isDraft)     return <FileText className="w-3 h-3" />;
    if (isSent)      return <Send className="w-3 h-3" />;
    if (isPartial)   return <PackageCheck className="w-3 h-3" />;
    if (isReceived)  return <CheckCircle2 className="w-3 h-3 text-emerald-500" />;
    return null;
  }

  return (
    <tr
      className={`border-b border-slate-50 transition-colors
        ${canView ? 'cursor-pointer hover:bg-indigo-50/40' : 'opacity-60 hover:bg-slate-50/70'}`}
      onClick={() => canView && navigate(`/purchase-orders/${po.id}`)}
    >
      {/* PO number + type badge */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center
            ${po.po_type === 'emergency' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{po.po_number}</p>
            <span className={`text-[11px] font-medium ${po.po_type === 'emergency' ? 'text-red-500' : 'text-slate-400'}`}>
              {po.po_type === 'emergency' ? '⚡ Emergency' : 'Weekly'}
            </span>
          </div>
        </div>
      </td>

      {/* ST PO# */}
      <td className="px-4 py-3">
        <STStatusCell po={po} />
      </td>

      {/* Supply house */}
      <td className="px-4 py-3">
        <p className="text-sm text-slate-700 font-medium">{po.vendor ?? po.supply_house_name ?? '—'}</p>
        <p className="text-[11px] text-slate-400">{po.warehouse_name}</p>
      </td>

      {/* Department */}
      <td className="px-4 py-3">
        <Badge status={po.department ?? 'default'} dot>
          {po.department ?? '—'}
        </Badge>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge status={po.status} dot>
          <span className="flex items-center gap-1">
            {statusIcon()}
            {po.status.replace(/_/g, ' ')}
          </span>
        </Badge>
      </td>

      {/* Lines received */}
      <td className="px-4 py-3">
        {totalLines > 0
          ? <ReceiveBar received={receivedLines} total={totalLines} />
          : <span className="text-xs text-slate-400">No lines</span>
        }
      </td>

      {/* Total */}
      <td className="px-4 py-3 text-sm font-semibold text-slate-700 tabular-nums">
        {(po.total_value ?? po.total_amount) != null ? fmt.format(po.total_value ?? po.total_amount) : '—'}
      </td>

      {/* Timing */}
      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
        {po.sent_at && (
          <span className="flex items-center gap-1 text-blue-400">
            <Send className="w-3 h-3" />
            {formatDistanceToNow(new Date(po.sent_at), { addSuffix: true })}
          </span>
        )}
        {!po.sent_at && po.created_at && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(po.created_at), 'MMM d')}
          </span>
        )}
        {po.received_at && (
          <span className="flex items-center gap-1 text-emerald-500">
            <CheckCircle2 className="w-3 h-3" />
            {formatDistanceToNow(new Date(po.received_at), { addSuffix: true })}
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        {canView && (
          <button
            onClick={() => navigate(`/purchase-orders/${po.id}`)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg
                       bg-indigo-50 text-indigo-600 hover:bg-indigo-100
                       border border-indigo-200 font-medium transition-colors"
          >
            {isDraft ? 'Edit' : 'View'}
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Create emergency PO modal ─────────────────────────────────────────────────
function CreatePOModal({ onClose, onCreated }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    warehouse_id: '',
    supply_house_id: '',
    department: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data } = await client.post('/purchase-orders', {
        ...form,
        po_type: 'emergency',
      });
      const id = data.purchase_order?.id ?? data.po?.id ?? data.id;
      onCreated();
      onClose();
      if (id) navigate(`/purchase-orders/${id}`);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to create PO');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-red-500" />
            New Emergency PO
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            For urgent orders outside the weekly run
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Warehouse</label>
            <select
              required
              value={form.warehouse_id}
              onChange={(e) => setForm(f => ({ ...f, warehouse_id: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Select warehouse…</option>
              <option value="lewisville">Lewisville (Plumbing)</option>
              <option value="argyle">Argyle (HVAC)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
            <select
              required
              value={form.department}
              onChange={(e) => setForm(f => ({ ...f, department: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Select department…</option>
              <option value="plumbing">Plumbing</option>
              <option value="hvac">HVAC</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Supply House ID</label>
            <input
              type="text"
              placeholder="UUID of supply house…"
              value={form.supply_house_id}
              onChange={(e) => setForm(f => ({ ...f, supply_house_id: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <p className="text-[11px] text-slate-400 mt-1">Optional — can be set later on the detail page</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              rows={2}
              placeholder="Reason for emergency PO…"
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50 border border-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white font-medium
                         hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              {saving ? 'Creating…' : 'Create PO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PurchaseOrders() {
  const { collapsed, onToggleSidebar } = useOutletContext();
  const [activeTab,    setActiveTab]    = useState('all');
  const [showCreate,   setShowCreate]   = useState(false);
  const { pos, loading, error, refresh } = usePOList(activeTab);

  // Summary counts
  const draftCount  = pos.filter(p => p.status === 'draft').length;
  const sentCount   = pos.filter(p => p.status === 'sent').length;
  const partialCount = pos.filter(p => p.status === 'partially_received').length;

  return (
    <>
      <Header
        title="Purchase Orders"
        subtitle="Weekly auto-generated POs and emergency orders — draft → sent → received"
        collapsed={collapsed}
        onToggleSidebar={onToggleSidebar}
        actions={
          <div className="flex items-center gap-2">
            <RunPOButton onSuccess={refresh} />
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700
                         px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white
                         px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Emergency PO
            </button>
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-4">

        {/* Alert banner */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Attention strip */}
        {!loading && (sentCount > 0 || partialCount > 0 || draftCount > 0) && (
          <div className="flex items-center gap-3 flex-wrap">
            {draftCount > 0 && (
              <button
                onClick={() => setActiveTab('draft')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                           bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                {draftCount} draft{draftCount !== 1 ? 's' : ''} unsent
              </button>
            )}
            {sentCount > 0 && (
              <button
                onClick={() => setActiveTab('sent')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                           bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {sentCount} awaiting delivery
              </button>
            )}
            {partialCount > 0 && (
              <button
                onClick={() => setActiveTab('partially_received')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                           bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                {partialCount} partially received
              </button>
            )}
          </div>
        )}

        {/* Main table card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center gap-0 border-b border-slate-100 px-2 pt-2 overflow-x-auto">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = tab.key === 'all'
                ? pos.length
                : pos.filter(p => p.status === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap
                    border-b-2 transition-colors -mb-px
                    ${isActive
                      ? `border-indigo-500 ${tab.color}`
                      : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
                    }
                  `}
                >
                  {tab.label}
                  {!loading && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold
                      ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                      {activeTab === tab.key || tab.key === 'all' ? count : '…'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PO #</th>
                  <th>ST PO #</th>
                  <th>Supply House</th>
                  <th>Dept</th>
                  <th>Status</th>
                  <th>Lines Received</th>
                  <th>Total</th>
                  <th>Timing</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={9} />)
                ) : pos.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        icon={ShoppingCart}
                        title={activeTab === 'all' ? 'No purchase orders yet' : `No ${activeTab.replace(/_/g, ' ')} POs`}
                        message={activeTab === 'all'
                          ? 'Weekly POs are auto-generated Monday 7 AM. Use "Run PO" to trigger now, or create an Emergency PO.'
                          : 'Switch tabs to view POs in other stages.'}
                      />
                    </td>
                  </tr>
                ) : (
                  pos.map((po) => <PORow key={po.id} po={po} />)
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {!loading && pos.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {pos.length} PO{pos.length !== 1 ? 's' : ''} shown · refreshes every 60 s
              </span>
              {(() => {
                const total = pos.reduce((s, p) => s + Number(p.total_value ?? p.total_amount ?? 0), 0);
                return total > 0 ? (
                  <span className="text-xs font-semibold text-slate-600">
                    Total outstanding: {fmt.format(total)}
                  </span>
                ) : null;
              })()}
            </div>
          )}
        </div>
      </main>

      {/* Create PO modal */}
      {showCreate && (
        <CreatePOModal
          onClose={() => setShowCreate(false)}
          onCreated={refresh}
        />
      )}
    </>
  );
}
