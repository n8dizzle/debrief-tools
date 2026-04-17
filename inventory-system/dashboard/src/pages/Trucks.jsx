/**
 * Trucks — fleet list page with inline truck creation
 *
 * Plumbing trucks: P1–P6 (Lewisville)
 * HVAC trucks:     H1–H24 (Argyle)
 *
 * Shows stock summary per truck. Managers can create new trucks.
 */

import { useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Truck, Plus, RotateCcw, AlertCircle, ChevronRight,
  Package, X, Wrench, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import Header      from '../components/Header.jsx';
import Badge       from '../components/ui/Badge.jsx';
import { SkeletonRow } from '../components/ui/Spinner.jsx';
import EmptyState  from '../components/ui/EmptyState.jsx';
import { useTruckList } from '../hooks/useTrucks.js';
import client      from '../api/client.js';

// ── Department config ─────────────────────────────────────────────────────────
const DEPT_META = {
  plumbing: { label: 'Plumbing', color: 'bg-blue-100 text-blue-700',   border: 'border-blue-200',  prefix: 'P' },
  hvac:     { label: 'HVAC',     color: 'bg-orange-100 text-orange-700', border: 'border-orange-200', prefix: 'H' },
};

// ── Stock fill bar ────────────────────────────────────────────────────────────
function StockBar({ loaded, capacity }) {
  const cap = Number(capacity ?? 0);
  const qty = Number(loaded  ?? 0);
  const pct = cap > 0 ? Math.min(100, Math.round((qty / cap) * 100)) : 0;
  const color = pct === 0 ? 'bg-slate-200' : pct < 30 ? 'bg-amber-400' : 'bg-indigo-500';
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500 whitespace-nowrap">{qty} SKUs</span>
    </div>
  );
}

// ── Truck avatar ──────────────────────────────────────────────────────────────
function TruckAvatar({ number, dept }) {
  const meta = DEPT_META[dept] ?? DEPT_META.plumbing;
  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold border ${meta.color} ${meta.border}`}>
      {number ?? '?'}
    </div>
  );
}

// ── Create truck modal ────────────────────────────────────────────────────────
function CreateTruckModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    truck_number: '',
    department:   'plumbing',
    warehouse_id: '',
    make:         '',
    model:        '',
    year:         '',
    vin:          '',
    license_plate:'',
    notes:        '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  // Auto-suggest truck number prefix when department changes
  function handleDeptChange(dept) {
    setForm(f => {
      const prefix = DEPT_META[dept]?.prefix ?? '';
      const cleared = f.truck_number === '' || Object.values(DEPT_META).some(m =>
        f.truck_number === m.prefix || f.truck_number.startsWith(m.prefix) && f.truck_number.length <= 4
      );
      return {
        ...f,
        department:   dept,
        truck_number: cleared && f.truck_number.length <= 4 ? prefix : f.truck_number,
      };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form };
      // Clean empty optional fields
      Object.keys(payload).forEach(k => { if (!payload[k]) delete payload[k]; });
      payload.department   = form.department;
      payload.truck_number = form.truck_number;
      const { data } = await client.post('/trucks', payload);
      onCreated(data.truck ?? data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to create truck');
    } finally {
      setSaving(false);
    }
  }

  const selectedDept = DEPT_META[form.department];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-500" />
              Add New Truck
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Truck will appear in the fleet and be available for restock batches.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Department selector */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Department</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(DEPT_META).map(([key, meta]) => (
                <label key={key}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
                    ${form.department === key
                      ? `${meta.color} ${meta.border} shadow-sm`
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  <input type="radio" name="department" value={key}
                    checked={form.department === key}
                    onChange={() => handleDeptChange(key)}
                    className="sr-only" />
                  <Truck className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{meta.label}</p>
                    <p className="text-[11px] opacity-70">Prefix: {meta.prefix}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Truck number + warehouse row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Truck Number <span className="text-red-400">*</span>
              </label>
              <input
                required
                type="text"
                placeholder={`e.g. ${selectedDept?.prefix}7`}
                value={form.truck_number}
                onChange={e => setForm(f => ({ ...f, truck_number: e.target.value.toUpperCase() }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Warehouse ID</label>
              <input
                type="text"
                placeholder="UUID of home warehouse…"
                value={form.warehouse_id}
                onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Vehicle info */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Vehicle Info <span className="font-normal text-slate-400">(optional)</span></p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { field: 'year',  label: 'Year',  placeholder: '2024' },
                { field: 'make',  label: 'Make',  placeholder: 'Ford' },
                { field: 'model', label: 'Model', placeholder: 'Transit' },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="block text-[11px] text-slate-400 mb-1">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5
                               focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">VIN</label>
              <input
                type="text"
                placeholder="Vehicle identification…"
                value={form.vin}
                onChange={e => setForm(f => ({ ...f, vin: e.target.value.toUpperCase() }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">License Plate</label>
              <input
                type="text"
                placeholder="ABC 1234"
                value={form.license_plate}
                onChange={e => setForm(f => ({ ...f, license_plate: e.target.value.toUpperCase() }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <textarea
              rows={2}
              placeholder="Any notes about this truck…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50 border border-slate-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 text-sm px-5 py-2 rounded-lg
                         bg-indigo-600 text-white font-medium hover:bg-indigo-700
                         disabled:opacity-50 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              {saving ? 'Creating…' : 'Create Truck'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Truck row ─────────────────────────────────────────────────────────────────
function TruckRow({ truck }) {
  const navigate = useNavigate();
  const dept = truck.department ?? (truck.truck_number?.startsWith('P') ? 'plumbing' : 'hvac');
  const meta = DEPT_META[dept] ?? DEPT_META.plumbing;

  const skuCount    = Number(truck.sku_count    ?? truck.stock_count    ?? 0);
  const totalQty    = Number(truck.total_qty    ?? truck.total_on_hand  ?? 0);
  const lowCount    = Number(truck.low_count    ?? 0);
  const techName    = truck.assigned_tech ?? truck.assigned_tech_name ?? truck.tech_name ?? null;

  return (
    <tr
      className="border-b border-slate-50 cursor-pointer hover:bg-indigo-50/40 transition-colors"
      onClick={() => navigate(`/trucks/${truck.id}`)}
    >
      {/* Truck number */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <TruckAvatar number={truck.truck_number} dept={dept} />
          <div>
            <p className="text-sm font-bold text-slate-800">{truck.truck_number}</p>
            {truck.year && truck.make && (
              <p className="text-[11px] text-slate-400">{truck.year} {truck.make} {truck.model ?? ''}</p>
            )}
          </div>
        </div>
      </td>

      {/* Department */}
      <td className="px-4 py-3">
        <Badge status={dept} dot>{meta.label}</Badge>
      </td>

      {/* Warehouse */}
      <td className="px-4 py-3 text-sm text-slate-500">
        {truck.warehouse_name ?? '—'}
      </td>

      {/* Assigned tech */}
      <td className="px-4 py-3 text-sm text-slate-600">
        {techName ?? <span className="text-slate-300">Unassigned</span>}
      </td>

      {/* Stock loaded */}
      <td className="px-4 py-3">
        <StockBar loaded={skuCount} capacity={50} />
      </td>

      {/* Total qty */}
      <td className="px-4 py-3">
        <span className="text-sm font-semibold text-slate-700 tabular-nums">{totalQty}</span>
        <span className="text-xs text-slate-400 ml-1">units</span>
      </td>

      {/* Alerts */}
      <td className="px-4 py-3">
        {lowCount > 0 ? (
          <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
            <AlertTriangle className="w-3 h-3" />
            {lowCount} low
          </span>
        ) : skuCount > 0 ? (
          <span className="flex items-center gap-1 text-xs text-emerald-500">
            <CheckCircle2 className="w-3 h-3" />
            Stocked
          </span>
        ) : (
          <span className="text-xs text-slate-300">Empty</span>
        )}
      </td>

      {/* License plate */}
      <td className="px-4 py-3">
        {truck.license_plate
          ? <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{truck.license_plate}</span>
          : <span className="text-slate-300 text-xs">—</span>
        }
      </td>

      {/* Action */}
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => navigate(`/trucks/${truck.id}`)}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg
                     bg-indigo-50 text-indigo-600 hover:bg-indigo-100
                     border border-indigo-200 font-medium transition-colors"
        >
          Manifest
          <ChevronRight className="w-3 h-3" />
        </button>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Trucks() {
  const { collapsed, onToggleSidebar } = useOutletContext();
  const [deptFilter,  setDeptFilter]  = useState('all');
  const [showCreate,  setShowCreate]  = useState(false);

  const filters = useMemo(() => ({
    department: deptFilter !== 'all' ? deptFilter : undefined,
  }), [deptFilter]);

  const { trucks, loading, error, refresh } = useTruckList(filters);

  const plumbingCount = trucks.filter(t =>
    (t.department ?? (t.truck_number?.startsWith('P') ? 'plumbing' : 'hvac')) === 'plumbing'
  ).length;
  const hvacCount = trucks.length - plumbingCount;

  function handleCreated(newTruck) {
    refresh();
  }

  return (
    <>
      <Header
        title="Trucks"
        subtitle="Fleet stock manifests — P1–P6 Plumbing · H1–H24 HVAC"
        collapsed={collapsed}
        onToggleSidebar={onToggleSidebar}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={refresh}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700
                         px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white
                         px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors font-medium">
              <Plus className="w-3.5 h-3.5" />
              Add Truck
            </button>
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-4">

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Fleet summary chips */}
        {!loading && trucks.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDeptFilter('all')}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors
                ${deptFilter === 'all'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              All ({trucks.length + (deptFilter !== 'all' ? '' : '')})
            </button>
            <button
              onClick={() => setDeptFilter('plumbing')}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors
                ${deptFilter === 'plumbing'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
            >
              <Truck className="w-3.5 h-3.5" />
              Plumbing ({plumbingCount})
            </button>
            <button
              onClick={() => setDeptFilter('hvac')}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors
                ${deptFilter === 'hvac'
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'}`}
            >
              <Truck className="w-3.5 h-3.5" />
              HVAC ({hvacCount})
            </button>
          </div>
        )}

        {/* Main table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Truck</th>
                  <th>Dept</th>
                  <th>Warehouse</th>
                  <th>Technician</th>
                  <th>SKUs Loaded</th>
                  <th>Total Units</th>
                  <th>Stock Health</th>
                  <th>Plate</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={9} />)
                ) : trucks.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        icon={Truck}
                        title={deptFilter !== 'all' ? `No ${deptFilter} trucks` : 'No trucks in fleet'}
                        message="Add your first truck using the button above. Trucks become available for restock batches immediately."
                      />
                    </td>
                  </tr>
                ) : (
                  trucks.map(t => <TruckRow key={t.id} truck={t} />)
                )}
              </tbody>
            </table>
          </div>

          {!loading && trucks.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {trucks.length} truck{trucks.length !== 1 ? 's' : ''} · refreshes every 60 s
              </span>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add truck
              </button>
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <CreateTruckModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
