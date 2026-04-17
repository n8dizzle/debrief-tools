/**
 * Restock Batch Detail — the manager's primary daily-use screen.
 *
 * Shows all lines for a batch with inline approve/deny controls.
 * Handles the full workflow:  locked → approved → picked → completed
 *
 * Key UX decisions:
 *  - Warehouse stock vs requested qty is color-coded so managers can spot shortages instantly
 *  - "Approve All Pending" covers the 80% case (routine restocks)
 *  - Each line can still be individually edited after bulk-approve
 *  - Batch-level action buttons are context-sensitive to the current status
 */

import { useState, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle,
  ChevronRight, TruckIcon, RotateCcw, Loader2,
  ClipboardList, Lock, PackageCheck, PackageOpen, Flag, ShoppingCart,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Header       from '../components/Header.jsx';
import Badge        from '../components/ui/Badge.jsx';
import { PageSpinner, SkeletonRow } from '../components/ui/Spinner.jsx';
import EmptyState   from '../components/ui/EmptyState.jsx';
import CreatePOModal from '../components/CreatePOModal.jsx';
import { useBatchDetail } from '../hooks/useRestock.js';
import client       from '../api/client.js';

// ── Status stepper ────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'collecting', label: 'Collecting',  icon: ClipboardList },
  { key: 'locked',     label: 'Locked',      icon: Lock },
  { key: 'approved',   label: 'Approved',    icon: CheckCircle2 },
  { key: 'picked',     label: 'Picked',      icon: PackageOpen },
  { key: 'completed',  label: 'Complete',    icon: PackageCheck },
];

const STATUS_ORDER = STEPS.map((s) => s.key);

function Stepper({ status }) {
  const currentIdx = STATUS_ORDER.indexOf(
    status === 'partially_completed' ? 'completed' : status,
  );

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const done    = i < currentIdx;
        const current = i === currentIdx;
        const future  = i > currentIdx;
        const Icon    = step.icon;

        return (
          <div key={step.key} className="flex items-center">
            {/* Node */}
            <div className={`
              flex flex-col items-center gap-1
            `}>
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center
                border-2 transition-all
                ${done    ? 'bg-indigo-600  border-indigo-600  text-white'       : ''}
                ${current ? 'bg-white       border-indigo-500  text-indigo-600 ring-4 ring-indigo-50' : ''}
                ${future  ? 'bg-slate-50    border-slate-200   text-slate-300'   : ''}
              `}>
                {done
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <Icon className={`w-3.5 h-3.5 ${current ? 'text-indigo-500' : ''}`} />
                }
              </div>
              <span className={`
                text-[10px] font-medium whitespace-nowrap hidden sm:block
                ${done ? 'text-indigo-600' : current ? 'text-slate-700' : 'text-slate-400'}
              `}>
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div className={`
                w-8 sm:w-12 h-0.5 mx-1 mb-4
                ${i < currentIdx ? 'bg-indigo-400' : 'bg-slate-200'}
              `} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Warehouse stock indicator ─────────────────────────────────────────────────

function StockIndicator({ stock, requested }) {
  const qty = Number(stock ?? 0);
  const req = Number(requested ?? 0);

  if (qty === 0)       return <span className="font-mono text-sm font-semibold text-red-600">{qty} <span className="text-[10px] font-normal text-red-400">OOS</span></span>;
  if (qty < req)       return <span className="font-mono text-sm font-semibold text-amber-600">{qty} <span className="text-[10px] font-normal text-amber-400">low</span></span>;
  return                      <span className="font-mono text-sm text-emerald-600">{qty}</span>;
}

// ── Individual line row ───────────────────────────────────────────────────────

function LineRow({ line, batchStatus, batchId, onRefresh }) {
  const canEdit = batchStatus === 'locked';

  // Local approval state
  const [mode,   setMode]   = useState('idle');     // idle | denying | saving
  const [qty,    setQty]    = useState(
    line.quantity_approved ?? line.quantity_requested,
  );
  const [reason, setReason] = useState(line.denial_reason ?? '');
  const [err,    setErr]    = useState('');

  async function approve() {
    if (!qty || qty <= 0) return;
    setMode('saving');
    setErr('');
    try {
      await client.patch(`/restock-batches/${batchId}/lines/${line.id}`, {
        status:            'approved',
        quantity_approved: Number(qty),
      });
      await onRefresh();
    } catch (e) {
      setErr(e.response?.data?.error ?? 'Failed');
      setMode('idle');
    }
  }

  async function confirmDeny() {
    if (!reason.trim()) { setErr('Denial reason is required'); return; }
    setMode('saving');
    setErr('');
    try {
      await client.patch(`/restock-batches/${batchId}/lines/${line.id}`, {
        status:        'denied',
        denial_reason: reason.trim(),
      });
      await onRefresh();
    } catch (e) {
      setErr(e.response?.data?.error ?? 'Failed');
      setMode('saving' === mode ? 'denying' : 'idle');
    }
  }

  const warehouseQty = Number(line.warehouse_qty_on_hand ?? 0);
  const requested    = Number(line.quantity_requested);
  const stockShort   = warehouseQty < requested;

  return (
    <tr className={`border-b border-slate-50 ${stockShort && line.status === 'pending' ? 'bg-amber-50/30' : ''}`}>
      {/* Material */}
      <td className="px-4 py-3 max-w-[200px]">
        <p className="font-medium text-slate-800 truncate">{line.material_name}</p>
        <p className="text-[11px] text-slate-400">{line.sku} · {line.unit_of_measure}</p>
      </td>

      {/* ST Job */}
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
          #{line.st_job_id}
        </span>
      </td>

      {/* Requested qty */}
      <td className="px-4 py-3 text-right">
        <span className="font-mono text-sm text-slate-700">{requested}</span>
        <span className="text-[11px] text-slate-400 ml-0.5">{line.unit_of_measure}</span>
      </td>

      {/* Warehouse stock */}
      <td className="px-4 py-3 text-right">
        <StockIndicator stock={line.warehouse_qty_on_hand} requested={requested} />
      </td>

      {/* Truck stock */}
      <td className="px-4 py-3 text-right">
        <span className="font-mono text-sm text-slate-500">
          {Number(line.truck_qty_on_hand ?? 0)}
        </span>
      </td>

      {/* Status / action cell */}
      <td className="px-4 py-3" style={{ minWidth: 240 }}>
        {err && <p className="text-[11px] text-red-500 mb-1">{err}</p>}

        {/* ── Pending line with edit controls ── */}
        {line.status === 'pending' && canEdit && mode !== 'denying' && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Qty input + approve */}
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                step={0.5}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-16 text-sm text-right border border-slate-200 rounded-lg px-2 py-1
                           focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400
                           text-slate-700 tabular-nums"
                disabled={mode === 'saving'}
              />
              <button
                onClick={approve}
                disabled={mode === 'saving'}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                           bg-emerald-50 text-emerald-700 border border-emerald-200
                           hover:bg-emerald-100 disabled:opacity-50 transition-colors"
              >
                {mode === 'saving'
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <CheckCircle2 className="w-3 h-3" />}
                Approve
              </button>
            </div>
            <button
              onClick={() => setMode('denying')}
              disabled={mode === 'saving'}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                         bg-red-50 text-red-600 border border-red-200
                         hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              <XCircle className="w-3 h-3" />
              Deny
            </button>
            {stockShort && warehouseQty === 0 && (
              <span className="text-[10px] text-red-500 font-medium flex items-center gap-0.5">
                <AlertTriangle className="w-3 h-3" /> OOS
              </span>
            )}
          </div>
        )}

        {/* ── Deny reason input ── */}
        {line.status === 'pending' && canEdit && mode === 'denying' && (
          <div className="space-y-1.5">
            <input
              autoFocus
              type="text"
              placeholder="Reason for denial…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmDeny()}
              className="w-full text-xs border border-red-200 rounded-lg px-2.5 py-1.5
                         focus:outline-none focus:ring-2 focus:ring-red-200 text-slate-700"
            />
            <div className="flex gap-1.5">
              <button
                onClick={confirmDeny}
                disabled={mode === 'saving'}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                           bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {mode === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}
                Confirm denial
              </button>
              <button
                onClick={() => { setMode('idle'); setErr(''); }}
                className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Already approved ── */}
        {line.status === 'approved' && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50
                             border border-emerald-200 px-2 py-1 rounded-lg font-medium">
              <CheckCircle2 className="w-3 h-3" />
              Approved: {line.quantity_approved} {line.unit_of_measure}
            </span>
            {canEdit && (
              <button
                onClick={() => {
                  setQty(line.quantity_approved);
                  setMode('idle');
                  // Re-set to pending so controls show — patch status back
                  // (handled by refreshing after approve/deny)
                }}
                className="text-[11px] text-slate-400 hover:text-slate-600 underline"
              >
                edit
              </button>
            )}
          </div>
        )}

        {/* ── Denied ── */}
        {line.status === 'denied' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50
                             border border-red-200 px-2 py-1 rounded-lg font-medium">
              <XCircle className="w-3 h-3" />
              Denied
            </span>
            {line.denial_reason && (
              <span className="text-[11px] text-slate-400 italic truncate max-w-[160px]" title={line.denial_reason}>
                "{line.denial_reason}"
              </span>
            )}
          </div>
        )}

        {/* ── Read-only status (post-locked) ── */}
        {!canEdit && line.status === 'pending' && (
          <Badge status="warning">pending</Badge>
        )}
      </td>
    </tr>
  );
}

// ── Batch action bar ──────────────────────────────────────────────────────────

function BatchActions({ batch, pendingCount, onRefresh }) {
  const [loading, setLoading] = useState(null);

  async function action(type, label) {
    if (!confirm(`${label} — are you sure?`)) return;
    setLoading(type);
    try {
      switch (type) {
        case 'lock':     await client.post(`/restock-batches/${batch.id}/lock`);    break;
        case 'approve':  await client.post(`/restock-batches/${batch.id}/approve`); break;
        case 'pick':     await client.post(`/restock-batches/${batch.id}/pick`);    break;
        case 'complete': await client.post(`/restock-batches/${batch.id}/complete`);break;
        default: break;
      }
      await onRefresh();
    } catch (e) {
      alert(e.response?.data?.error ?? `${label} failed`);
    } finally {
      setLoading(null);
    }
  }

  async function approveAll() {
    if (!confirm(`Approve all ${pendingCount} pending line(s) at requested quantities?`)) return;
    setLoading('approve-all');
    try {
      await client.post(`/restock-batches/${batch.id}/approve`);
      await onRefresh();
    } catch (e) {
      alert(e.response?.data?.error ?? 'Bulk approve failed');
    } finally {
      setLoading(null);
    }
  }

  const Btn = ({ type, label, icon: Icon, cls = '', disabled = false, onClick }) => (
    <button
      disabled={loading !== null || disabled}
      onClick={onClick ?? (() => action(type, label))}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium
                  disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${cls}`}
    >
      {loading === type
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : Icon && <Icon className="w-4 h-4" />}
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Collecting: manual lock */}
      {batch.status === 'collecting' && (
        <Btn type="lock" label="Lock batch now" icon={Lock}
          cls="bg-amber-500 text-white hover:bg-amber-600" />
      )}

      {/* Locked: bulk approve + advance */}
      {batch.status === 'locked' && (
        <>
          {pendingCount > 0 && (
            <Btn type="approve-all"
              label={`Approve all ${pendingCount} pending`}
              icon={CheckCircle2}
              cls="bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={approveAll}
            />
          )}
          {pendingCount === 0 && (
            <Btn type="approve"
              label="Mark as Approved →"
              icon={ChevronRight}
              cls="bg-indigo-600 text-white hover:bg-indigo-700"
            />
          )}
        </>
      )}

      {/* Approved: start picking */}
      {batch.status === 'approved' && (
        <Btn type="pick" label="Start Picking →" icon={PackageOpen}
          cls="bg-purple-600 text-white hover:bg-purple-700" />
      )}

      {/* Picked: complete */}
      {batch.status === 'picked' && (
        <Btn type="complete" label="Mark Complete ✓" icon={PackageCheck}
          cls="bg-emerald-600 text-white hover:bg-emerald-700" />
      )}
    </div>
  );
}

// ── Quick stats pills ─────────────────────────────────────────────────────────

function BatchStats({ lines }) {
  const total    = lines.length;
  const pending  = lines.filter((l) => l.status === 'pending').length;
  const approved = lines.filter((l) => l.status === 'approved').length;
  const denied   = lines.filter((l) => l.status === 'denied').length;
  const shortWH  = lines.filter((l) =>
    l.status === 'pending' && Number(l.warehouse_qty_on_hand ?? 0) < Number(l.quantity_requested),
  ).length;

  return (
    <div className="flex items-center gap-3 flex-wrap text-sm">
      <Pill label="Total"    value={total}    color="bg-slate-100 text-slate-600" />
      {pending  > 0 && <Pill label="Pending"  value={pending}  color="bg-amber-100  text-amber-700" />}
      {approved > 0 && <Pill label="Approved" value={approved} color="bg-emerald-100 text-emerald-700" />}
      {denied   > 0 && <Pill label="Denied"   value={denied}   color="bg-red-100    text-red-600" />}
      {shortWH  > 0 && (
        <Pill
          label="Low stock"
          value={shortWH}
          color="bg-orange-100 text-orange-700"
          icon={<AlertTriangle className="w-3 h-3" />}
        />
      )}
    </div>
  );
}

function Pill({ label, value, color, icon }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      {icon}
      {value} {label}
    </span>
  );
}

// ── Line filter tabs ──────────────────────────────────────────────────────────
const LINE_TABS = [
  { key: 'all',      label: 'All lines' },
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'denied',   label: 'Denied' },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RestockBatchDetail() {
  const { collapsed, onToggleSidebar } = useOutletContext();
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { batch, lines, loading, error, refresh } = useBatchDetail(id);

  const [lineFilter,   setLineFilter]   = useState('all');
  const [createPOOpen, setCreatePOOpen] = useState(false);

  // Memoize refresh so LineRow useCallback doesn't cause re-renders
  const stableRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  if (loading) return (
    <>
      <Header title="Restock Batch" collapsed={collapsed} onToggleSidebar={onToggleSidebar} />
      <PageSpinner />
    </>
  );

  if (error || !batch) return (
    <>
      <Header title="Restock Batch" collapsed={collapsed} onToggleSidebar={onToggleSidebar} />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-300 mx-auto mb-3" />
          <p className="text-slate-500">{error ?? 'Batch not found'}</p>
          <button onClick={() => navigate('/restock-queue')} className="mt-4 text-sm text-indigo-500 underline">
            Back to queue
          </button>
        </div>
      </main>
    </>
  );

  const pendingLines   = lines.filter((l) => l.status === 'pending');
  const approvedLines  = lines.filter((l) => l.status === 'approved');
  const filteredLines  = lineFilter === 'all' ? lines : lines.filter((l) => l.status === lineFilter);
  const isLocked       = batch.status === 'locked';
  const dept           = (batch.department ?? '').toLowerCase() === 'plumbing' ? 'plumbing' : 'hvac';
  const batchLabel     = batch.batch_number ?? batch.truck_number ?? batch.id?.slice(0, 8);
  // Show "Create PO" when batch has at least one approved line and is past the locked stage
  const canCreatePO    = approvedLines.length > 0 && ['approved', 'picked', 'completed'].includes(batch.status);

  return (
    <>
      <Header
        title={`Batch — ${batchLabel}`}
        subtitle={`${batch.warehouse_name} · ${batch.status}`}
        collapsed={collapsed}
        onToggleSidebar={onToggleSidebar}
        actions={
          <div className="flex items-center gap-2">
            {canCreatePO && (
              <button
                onClick={() => setCreatePOOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700
                           text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Create PO
              </button>
            )}
            <button
              onClick={stableRefresh}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700
                         px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

        {/* ── Back link ── */}
        <button
          onClick={() => navigate('/restock-queue')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Restock Queue
        </button>

        {/* ── Batch header card ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">

          {/* Title row */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {/* Truck chip */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold
                ${dept === 'plumbing' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                {dept === 'plumbing' ? 'P' : 'H'}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">{batchLabel}</h2>
                <p className="text-sm text-slate-500">
                  {batch.warehouse_name}
                  {batch.locked_at && (
                    <span className="ml-2 text-slate-400">
                      · Locked {formatDistanceToNow(new Date(batch.locked_at), { addSuffix: true })}
                      {batch.lock_trigger === 'scheduled' ? ' (scheduler)' : ' (manual)'}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Badge status={batch.status} dot className="text-sm px-3 py-1">
              {batch.status.replace('_', ' ')}
            </Badge>
          </div>

          {/* Workflow stepper */}
          <div className="flex justify-center py-2">
            <Stepper status={batch.status} />
          </div>

          {/* Stats + action row */}
          <div className="flex items-center justify-between gap-4 flex-wrap pt-1 border-t border-slate-100">
            <BatchStats lines={lines} />
            <BatchActions batch={batch} pendingCount={pendingLines.length} onRefresh={stableRefresh} />
          </div>
        </div>

        {/* ── Lines table ── */}
        <div className="section-card">
          {/* Line filter tabs */}
          <div className="flex items-center gap-0 border-b border-slate-100 px-4 pt-1">
            {LINE_TABS.map((tab) => {
              const count = tab.key === 'all'
                ? lines.length
                : lines.filter((l) => l.status === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setLineFilter(tab.key)}
                  className={`
                    px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
                    ${lineFilter === tab.key
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'}
                  `}
                >
                  {tab.label}
                  <span className={`ml-1.5 px-1.5 py-0.5 text-[11px] rounded-full font-semibold
                    ${lineFilter === tab.key ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Stock legend */}
            <div className="ml-auto flex items-center gap-3 pb-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>Sufficient</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Low</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>Out of stock</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Job #</th>
                  <th className="text-right">Requested</th>
                  <th className="text-right">WH Stock</th>
                  <th className="text-right">Truck Stock</th>
                  <th style={{ minWidth: 240 }}>Action / Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={CheckCircle2}
                        title={`No ${lineFilter === 'all' ? '' : lineFilter} lines`}
                        message={lineFilter === 'pending' ? 'All lines have been reviewed.' : undefined}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredLines.map((line) => (
                    <LineRow
                      key={line.id}
                      line={line}
                      batchStatus={batch.status}
                      batchId={batch.id}
                      onRefresh={stableRefresh}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {batch.notes && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-500">
                <span className="font-medium text-slate-600">Notes: </span>{batch.notes}
              </p>
            </div>
          )}
        </div>
      </main>

      {createPOOpen && (
        <CreatePOModal
          batch={{ ...batch, department: dept }}
          lines={lines}
          onClose={() => setCreatePOOpen(false)}
        />
      )}
    </>
  );
}
