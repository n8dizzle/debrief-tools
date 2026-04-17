/**
 * Warehouses — overview page
 *
 * Two warehouses: Lewisville (Plumbing) and Argyle (HVAC).
 * Shows stock health at a glance per warehouse with quick-link to full detail.
 */

import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Warehouse, RotateCcw, AlertCircle, ChevronRight,
  Package, Truck, AlertTriangle, CheckCircle2,
  TrendingDown, ArrowUpDown, BoxSelect,
} from 'lucide-react';
import { useWarehouseList } from '../hooks/useWarehouses.js';
import Header from '../components/Header.jsx';
import Badge  from '../components/ui/Badge.jsx';

// ── Stat mini-card ────────────────────────────────────────────────────────────
function StatMini({ label, value, sub, color = 'text-slate-800' }) {
  return (
    <div className="bg-white/60 rounded-xl p-3 space-y-0.5">
      <p className={`text-2xl font-black tabular-nums ${color}`}>{value}</p>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

// ── Warehouse card ────────────────────────────────────────────────────────────
function WarehouseCard({ wh }) {
  const navigate = useNavigate();

  const dept = wh.department ?? (wh.name?.toLowerCase().includes('lewis') ? 'plumbing' : 'hvac');
  const isPlumbing = dept === 'plumbing';

  const totalSKUs   = Number(wh.sku_count          ?? wh.total_skus      ?? 0);
  const belowReorder = Number(wh.low_count ?? wh.below_reorder_count ?? 0);
  const oosCount    = Number(wh.oos_count           ?? 0);
  const truckCount  = Number(wh.truck_count         ?? 0);
  const totalUnits  = Number(wh.total_units         ?? wh.total_on_hand   ?? 0);
  const binCount    = Number(wh.active_bin_count    ?? wh.bin_count       ?? 0);
  const healthPct   = totalSKUs > 0
    ? Math.round(((totalSKUs - oosCount - belowReorder) / totalSKUs) * 100)
    : 100;

  return (
    <div
      className={`rounded-2xl border shadow-sm overflow-hidden cursor-pointer
        hover:shadow-md hover:-translate-y-0.5 transition-all
        ${isPlumbing ? 'border-blue-200 bg-blue-50/40' : 'border-orange-200 bg-orange-50/40'}`}
      onClick={() => navigate(`/warehouses/${wh.id}`)}
    >
      {/* Header strip */}
      <div className={`px-5 py-4 ${isPlumbing ? 'bg-blue-600' : 'bg-orange-500'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Warehouse className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{wh.name}</h2>
              <p className="text-xs text-white/70">{wh.city ?? wh.location ?? (isPlumbing ? 'Lewisville, TX' : 'Argyle, TX')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge status={dept} dot>
              <span className="text-white">{isPlumbing ? 'Plumbing' : 'HVAC'}</span>
            </Badge>
            <ChevronRight className="w-4 h-4 text-white/70" />
          </div>
        </div>

        {/* Health bar */}
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-xs text-white/70">
            <span>Stock health</span>
            <span className="font-semibold text-white">{healthPct}%</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all
                ${healthPct >= 90 ? 'bg-emerald-400' : healthPct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${healthPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 p-4">
        <StatMini
          label="Total SKUs"
          value={totalSKUs}
          color={isPlumbing ? 'text-blue-700' : 'text-orange-700'}
        />
        <StatMini
          label="Below Reorder"
          value={belowReorder}
          color={belowReorder > 0 ? 'text-amber-600' : 'text-slate-400'}
          sub={oosCount > 0 ? `${oosCount} OOS` : undefined}
        />
        <StatMini
          label="Total Units"
          value={totalUnits.toLocaleString()}
          color="text-slate-700"
        />
      </div>

      {/* Footer strip */}
      <div className={`px-4 pb-4 grid grid-cols-2 gap-2`}>
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg
          ${isPlumbing ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
          <Truck className="w-3.5 h-3.5 shrink-0" />
          <span><strong>{truckCount}</strong> trucks assigned</span>
        </div>
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg
          ${isPlumbing ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
          <BoxSelect className="w-3.5 h-3.5 shrink-0" />
          <span><strong>{binCount}</strong> active bin{binCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Alert strip (if needed) */}
      {(oosCount > 0 || belowReorder > 0) && (
        <div className="mx-4 mb-4 flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-medium px-3 py-2 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {oosCount > 0 && `${oosCount} out of stock`}
          {oosCount > 0 && belowReorder > 0 && ' · '}
          {belowReorder > 0 && `${belowReorder} below reorder`}
          <ChevronRight className="w-3 h-3 ml-auto" />
        </div>
      )}

      {/* View detail button */}
      <div className="px-4 pb-4">
        <button
          className={`w-full py-2 rounded-xl text-sm font-semibold transition-colors
            ${isPlumbing
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-orange-500 text-white hover:bg-orange-600'}`}
          onClick={e => { e.stopPropagation(); navigate(`/warehouses/${wh.id}`); }}
        >
          View Full Stock →
        </button>
      </div>
    </div>
  );
}

// ── Skeleton warehouse card ───────────────────────────────────────────────────
function WarehouseCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-pulse">
      <div className="h-32 bg-slate-200" />
      <div className="p-4 grid grid-cols-3 gap-2">
        {[1,2,3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl" />)}
      </div>
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
        {[1,2].map(i => <div key={i} className="h-8 bg-slate-100 rounded-lg" />)}
      </div>
      <div className="px-4 pb-4">
        <div className="h-9 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}

// ── System-wide summary strip ─────────────────────────────────────────────────
function SystemSummary({ warehouses }) {
  const totalSKUs    = warehouses.reduce((s, w) => s + Number(w.sku_count ?? w.total_skus ?? 0), 0);
  const totalUnits   = warehouses.reduce((s, w) => s + Number(w.total_units ?? w.total_on_hand ?? 0), 0);
  const totalAlerts  = warehouses.reduce((s, w) => s + Number(w.low_count ?? w.below_reorder_count ?? 0) + Number(w.oos_count ?? 0), 0);
  const totalTrucks  = warehouses.reduce((s, w) => s + Number(w.truck_count ?? 0), 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total SKUs',        val: totalSKUs,              icon: Package,       color: 'text-indigo-700 bg-indigo-50 border-indigo-100' },
        { label: 'Total Units',       val: totalUnits.toLocaleString(), icon: ArrowUpDown, color: 'text-slate-700 bg-slate-50 border-slate-200' },
        { label: 'Stock Alerts',      val: totalAlerts,            icon: AlertTriangle, color: totalAlerts > 0 ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-slate-400 bg-slate-50 border-slate-200' },
        { label: 'Trucks Across Fleet', val: totalTrucks,          icon: Truck,         color: 'text-slate-600 bg-slate-50 border-slate-200' },
      ].map(({ label, val, icon: Icon, color }) => (
        <div key={label} className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${color}`}>
          <Icon className="w-5 h-5 shrink-0 opacity-60" />
          <div>
            <p className="text-xl font-black tabular-nums">{val}</p>
            <p className="text-xs font-medium opacity-70">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Warehouses() {
  const { collapsed, onToggleSidebar } = useOutletContext();
  const { warehouses, loading, error, refresh } = useWarehouseList();

  return (
    <>
      <Header
        title="Warehouses"
        subtitle="Lewisville (Plumbing) and Argyle (HVAC) — stock locations and health"
        collapsed={collapsed}
        onToggleSidebar={onToggleSidebar}
        actions={
          <button onClick={refresh}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700
                       px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {/* System summary */}
        {!loading && warehouses.length > 0 && (
          <SystemSummary warehouses={warehouses} />
        )}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        )}

        {/* Warehouse cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {loading ? (
            <><WarehouseCardSkeleton /><WarehouseCardSkeleton /></>
          ) : warehouses.length === 0 ? (
            <div className="col-span-2 flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <Warehouse className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-semibold">No warehouses found</p>
              <p className="text-sm text-slate-400 mt-1">Warehouses are seeded from your database configuration.</p>
            </div>
          ) : (
            warehouses.map(wh => <WarehouseCard key={wh.id} wh={wh} />)
          )}
        </div>

      </main>
    </>
  );
}
