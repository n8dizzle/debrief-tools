/**
 * Restock Queue — list page
 *
 * Shows all restock batches, filterable by status.
 * Managers review locked batches; warehouse staff track picked/completed ones.
 *
 * Batch lifecycle:  collecting → locked → approved → picked → completed
 */

import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  RefreshCw, Lock, ChevronRight, TruckIcon,
  AlertCircle, RotateCcw, Clock, CheckCircle2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Header      from '../components/Header.jsx';
import Badge       from '../components/ui/Badge.jsx';
import { SkeletonRow } from '../components/ui/Spinner.jsx';
import EmptyState  from '../components/ui/EmptyState.jsx';
import { useBatchList } from '../hooks/useRestock.js';
import client      from '../api/client.js';

// ── Status tab config ─────────────────────────────────────────────────────────
const TABS = [
  { key: 'all',                 label: 'All',          color: 'text-slate-600' },
  { key: 'collecting',          label: 'Collecting',   color: 'text-blue-600' },
  { key: 'locked',              label: 'Locked',       color: 'text-amber-600' },
  { key: 'approved',            label: 'Approved',     color: 'text-indigo-600' },
  { key: 'picked',              label: 'Picked',       color: 'text-purple-600' },
  { key: 'completed',           label: 'Completed',    color: 'text-emerald-600' },
  { key: 'partially_completed', label: 'Partial',      color: 'text-orange-600' },
];

// ── Progress bar (approved lines / total lines) ───────────────────────────────
function ProgressBar({ approved, total }) {
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-slate-500 whitespace-nowrap">
        {approved}/{total}
      </span>
    </div>
  );
}

// ── Lock action ───────────────────────────────────────────────────────────────
function LockButton({ batchId, onSuccess }) {
  const [loading, setLoading] = useState(false);

  async function handleLock(e) {
    e.stopPropagation();
    if (!confirm('Manually lock this collecting batch now?')) return;
    setLoading(true);
    try {
      await client.post(`/restock-batches/${batchId}/lock`);
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.error ?? 'Lock failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleLock}
      disabled={loading}
      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg
                 border border-amber-200 text-amber-700 bg-amber-50
                 hover:bg-amber-100 disabled:opacity-50 transition-colors"
      title="Lock batch early"
    >
      <Lock className="w-3 h-3" />
      {loading ? 'Locking…' : 'Lock now'}
    </button>
  );
}

// ── Batch row ─────────────────────────────────────────────────────────────────
function BatchRow({ batch, onRefresh }) {
  const navigate = useNavigate();
  const isLocked     = batch.status === 'locked';
  const isCollecting = batch.status === 'collecting';
  const canReview    = ['locked', 'approved', 'picked'].includes(batch.status);

  const totalLines    = Number(batch.item_count ?? batch.line_count ?? 0);
  const approvedCount = Number(batch.approved_count ?? 0);
  const pendingCount  = Number(batch.pending_count  ?? 0);
  const deniedCount   = Number(batch.denied_count   ?? 0);
  const isPlumbing    = (batch.department ?? '').toLowerCase() === 'plumbing';
  const batchLabel    = batch.batch_number ?? batch.truck_number ?? batch.id?.slice(0, 8);

  return (
    <tr
      className={`border-b border-slate-50 transition-colors ${canReview ? 'cursor-pointer hover:bg-indigo-50/40' : 'hover:bg-slate-50/70'}`}
      onClick={() => canReview && navigate(`/restock-queue/${batch.id}`)}
    >
      {/* Batch */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold
            ${isPlumbing ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
            {isPlumbing ? 'P' : 'H'}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{batchLabel}</p>
            <p className="text-[11px] text-slate-400">
              {isPlumbing ? 'Plumbing' : 'HVAC'}
            </p>
          </div>
        </div>
      </td>

      {/* Warehouse */}
      <td className="px-4 py-3 text-sm text-slate-600">{batch.warehouse_name}</td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge status={batch.status} dot>{batch.status.replace('_', ' ')}</Badge>
      </td>

      {/* Line progress */}
      <td className="px-4 py-3">
        {totalLines > 0 ? (
          <div className="space-y-1">
            <ProgressBar approved={approvedCount} total={totalLines} />
            <div className="flex gap-2 text-[10px]">
              {pendingCount > 0 && <span className="text-amber-500">{pendingCount} pending</span>}
              {deniedCount  > 0 && <span className="text-red-400">{deniedCount} denied</span>}
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-400">No lines yet</span>
        )}
      </td>

      {/* Timing */}
      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
        {isLocked && batch.locked_at && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(batch.locked_at), { addSuffix: true })}
          </span>
        )}
        {isCollecting && (
          <span className="flex items-center gap-1 text-blue-400">
            <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} />
            Collecting
          </span>
        )}
        {batch.completed_at && (
          <span className="flex items-center gap-1 text-emerald-500">
            <CheckCircle2 className="w-3 h-3" />
            {formatDistanceToNow(new Date(batch.completed_at), { addSuffix: true })}
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {isCollecting && <LockButton batchId={batch.id} onSuccess={onRefresh} />}
          {canReview && (
            <button
              onClick={() => navigate(`/restock-queue/${batch.id}`)}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg
                         bg-indigo-50 text-indigo-600 hover:bg-indigo-100
                         border border-indigo-200 font-medium transition-colors"
            >
              {isLocked ? 'Review' : 'View'}
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RestockQueue() {
  const { collapsed, onToggleSidebar } = useOutletContext();
  const [activeTab, setActiveTab] = useState('locked'); // default to what needs attention
  const { batches, loading, error, refresh } = useBatchList(activeTab);

  // Tab counts computed from current fetch
  const counts = TABS.reduce((acc, t) => {
    acc[t.key] = t.key === 'all'
      ? batches.length
      : batches.filter((b) => b.status === t.key).length;
    return acc;
  }, {});

  // When showing "locked" tab, locked count is the full list count
  // So we do a second pass if showing a filtered view — the counts only reflect that filter.
  // For a quick visual, this is acceptable; a separate counts endpoint can be added later.

  return (
    <>
      <Header
        title="Restock Queue"
        subtitle="Batch restock workflow — collecting → locked → approved → picked → complete"
        collapsed={collapsed}
        onToggleSidebar={onToggleSidebar}
        actions={
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700
                       px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-4">

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Status tabs */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center gap-0 border-b border-slate-100 px-2 pt-2 overflow-x-auto">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
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
                  {/* Show count only if we have data and tab matches status or is "all" */}
                  {!loading && (
                    <span className={`
                      px-1.5 py-0.5 rounded-full text-[11px] font-semibold
                      ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}
                    `}>
                      {activeTab === tab.key || tab.key === 'all'
                        ? batches.filter(b => tab.key === 'all' || b.status === tab.key).length
                        : '…'}
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
                  <th>Batch</th>
                  <th>Warehouse</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Timing</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                ) : batches.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={activeTab === 'locked' ? CheckCircle2 : RefreshCw}
                        title={activeTab === 'locked' ? 'No batches awaiting review' : `No ${activeTab} batches`}
                        message={activeTab === 'locked'
                          ? 'Locked batches appear here at 6 AM daily or when manually locked.'
                          : 'Switch tabs to view batches in other stages.'}
                      />
                    </td>
                  </tr>
                ) : (
                  batches.map((b) => (
                    <BatchRow key={b.id} batch={b} onRefresh={refresh} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer hint */}
          {!loading && batches.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {batches.length} batch{batches.length !== 1 ? 'es' : ''} shown · auto-refreshes every 30 s
              </span>
              {activeTab === 'locked' && batches.length > 0 && (
                <span className="text-xs text-amber-500 font-medium">
                  {batches.length} batch{batches.length !== 1 ? 'es' : ''} need manager review
                </span>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
