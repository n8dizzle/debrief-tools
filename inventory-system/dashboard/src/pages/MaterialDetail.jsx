/**
 * Material Detail — full stock picture for one material
 *
 * Sections:
 *  - Header: name, part #, dept, category, unit cost
 *  - Warehouse stock cards: Lewisville + Argyle (on_hand, reserved, reorder_point, max_stock)
 *  - Truck stock summary (collapsed by default, shows which trucks have stock)
 *  - Movement history table (last 50)
 *  - Manual adjustment panel (admin/manager only)
 *  - Cycle count panel
 */

import { useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft, Package, AlertTriangle, RotateCcw,
  TrendingUp, TrendingDown, ArrowUpDown, CheckCircle2,
  ChevronDown, ChevronUp, Truck, Warehouse, Settings,
  ClipboardList, AlertCircle, Clock, ArrowRightLeft,
} from 'lucide-react';
import TransferModal from '../components/TransferModal.jsx';
import { format, formatDistanceToNow } from 'date-fns';
import Header    from '../components/Header.jsx';
import Badge     from '../components/ui/Badge.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import {
  useMaterialDetail,
  useMaterialMovements,
} from '../hooks/useMaterials.js';
import client from '../api/client.js';

// ── Currency formatter ────────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// ── Movement type labels + colors ─────────────────────────────────────────────
const MOVEMENT_META = {
  received:          { label: 'Received',          color: 'text-emerald-600', Icon: TrendingUp },
  transferred:       { label: 'Transfer',           color: 'text-blue-600',    Icon: ArrowUpDown },
  loaded_to_bin:     { label: 'Loaded to Bin',      color: 'text-indigo-600',  Icon: Package },
  bin_to_truck:      { label: 'Bin → Truck',        color: 'text-purple-600',  Icon: Truck },
  consumed_on_job:   { label: 'Consumed on Job',    color: 'text-orange-500',  Icon: TrendingDown },
  returned_to_stock: { label: 'Returned',           color: 'text-teal-600',    Icon: TrendingUp },
  adjustment:        { label: 'Adjustment',         color: 'text-slate-600',   Icon: Settings },
  cycle_count:       { label: 'Cycle Count',        color: 'text-blue-500',    Icon: ClipboardList },
};

// ── Warehouse stock card ──────────────────────────────────────────────────────
function WarehouseCard({ row }) {
  const onHand    = Number(row.qty_on_hand    ?? 0);
  const reserved  = Number(row.qty_reserved   ?? 0);
  const available = onHand - reserved;
  const rop       = Number(row.reorder_point  ?? 0);
  const maxStock  = Number(row.max_stock      ?? 0);
  const isOOS     = onHand === 0;
  const isLow     = !isOOS && rop > 0 && onHand <= rop;
  const fillPct   = maxStock > 0 ? Math.min(100, Math.round((onHand / maxStock) * 100)) : 0;

  return (
    <div className={`rounded-xl border p-4 space-y-3
      ${isOOS ? 'border-red-200 bg-red-50/40' : isLow ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'}`}>
      {/* Warehouse name + status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center
            ${isOOS ? 'bg-red-100 text-red-500' : isLow ? 'bg-amber-100 text-amber-500' : 'bg-slate-100 text-slate-500'}`}>
            <Warehouse className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{row.warehouse_name}</p>
            <p className="text-[11px] text-slate-400">{row.department ?? ''}</p>
          </div>
        </div>
        {isOOS && <Badge status="cancelled" dot>Out of stock</Badge>}
        {isLow && !isOOS && <Badge status="locked" dot>Below reorder</Badge>}
        {!isOOS && !isLow && <Badge status="completed" dot>In stock</Badge>}
      </div>

      {/* Fill bar */}
      {maxStock > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>0</span>
            <span>Max {maxStock}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all
                ${isOOS ? 'bg-red-400' : isLow ? 'bg-amber-400' : 'bg-indigo-500'}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
          {/* Reorder point marker */}
          {rop > 0 && maxStock > 0 && (
            <div className="relative h-2 -mt-3">
              <div
                className="absolute top-0 w-0.5 h-3 bg-amber-400 rounded"
                style={{ left: `${Math.min(100, (rop / maxStock) * 100)}%` }}
                title={`Reorder at ${rop}`}
              />
            </div>
          )}
        </div>
      )}

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'On Hand',      val: onHand,    bold: true },
          { label: 'Available',    val: available,  bold: false },
          { label: 'Reserved',     val: reserved,   bold: false },
          { label: 'Reorder At',   val: rop || '—', bold: false },
        ].map(({ label, val, bold }) => (
          <div key={label} className="bg-white/70 rounded-lg p-2.5">
            <p className="text-[10px] text-slate-400 font-medium">{label}</p>
            <p className={`text-lg tabular-nums ${bold ? 'font-bold text-slate-800' : 'font-semibold text-slate-600'}`}>
              {val}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Truck stock panel (collapsed by default) ──────────────────────────────────
function TruckStockPanel({ truckStock = [] }) {
  const [open, setOpen] = useState(false);

  const withStock = truckStock.filter(t => Number(t.qty_on_hand ?? 0) > 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5
                   text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-slate-400" />
          Truck Stock
          <span className="text-xs font-normal text-slate-400">
            ({withStock.length} truck{withStock.length !== 1 ? 's' : ''} loaded)
          </span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-5 pb-4 border-t border-slate-100">
          {withStock.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No trucks currently have this material loaded.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-3">
              {truckStock.map(t => {
                const qty = Number(t.qty_on_hand ?? 0);
                if (qty === 0) return null;
                const isPlumbing = t.truck_number?.startsWith('P');
                return (
                  <div key={t.truck_id ?? t.truck_number}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs
                      ${isPlumbing ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-orange-50 border-orange-100 text-orange-700'}`}>
                    <Truck className="w-3 h-3 shrink-0" />
                    <span className="font-semibold">{t.truck_number}</span>
                    <span className="ml-auto font-bold tabular-nums">{qty}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Movement row ──────────────────────────────────────────────────────────────
function MovementRow({ movement }) {
  const meta = MOVEMENT_META[movement.movement_type] ?? {
    label: movement.movement_type,
    color: 'text-slate-500',
    Icon: ArrowUpDown,
  };
  const { Icon } = meta;
  const qty = Number(movement.quantity ?? 0);
  const isPositive = ['received', 'returned_to_stock', 'transferred'].includes(movement.movement_type);

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
      {/* Type */}
      <td className="px-4 py-2.5">
        <span className={`flex items-center gap-1.5 text-xs font-medium ${meta.color}`}>
          <Icon className="w-3.5 h-3.5" />
          {meta.label}
        </span>
      </td>

      {/* Qty */}
      <td className="px-4 py-2.5">
        <span className={`text-sm font-bold tabular-nums
          ${isPositive ? 'text-emerald-600' : 'text-slate-700'}`}>
          {isPositive ? '+' : ''}{qty}
        </span>
      </td>

      {/* Location */}
      <td className="px-4 py-2.5 text-xs text-slate-500">
        {movement.from_location && movement.to_location
          ? `${movement.from_location} → ${movement.to_location}`
          : movement.from_location ?? movement.to_location ?? movement.warehouse_name ?? '—'}
      </td>

      {/* Tech / user */}
      <td className="px-4 py-2.5 text-xs text-slate-500">
        {movement.performed_by_name ?? movement.tech_name ?? '—'}
      </td>

      {/* Job */}
      <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">
        {movement.st_job_id ?? '—'}
      </td>

      {/* Timestamp */}
      <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
        <span title={movement.created_at ? format(new Date(movement.created_at), 'PPpp') : ''}>
          {movement.created_at
            ? formatDistanceToNow(new Date(movement.created_at), { addSuffix: true })
            : '—'}
        </span>
      </td>

      {/* Notes */}
      <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[160px] truncate">
        {movement.notes ?? movement.reason ?? ''}
      </td>
    </tr>
  );
}

// ── Manual adjustment panel ───────────────────────────────────────────────────
function AdjustPanel({ materialId, warehouseOptions, onDone }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ warehouse_id: '', adjustment: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await client.post('/stock/adjust', {
        material_id:  materialId,
        warehouse_id: form.warehouse_id,
        adjustment:   Number(form.adjustment),
        reason:       form.reason,
      });
      setForm({ warehouse_id: '', adjustment: '', reason: '' });
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Adjustment failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-dashed border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3
                   text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-slate-400" />
          Manual Stock Adjustment
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3 bg-slate-50 border-t border-slate-100">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mt-3">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 pt-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Warehouse</label>
              <select
                required
                value={form.warehouse_id}
                onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">Select…</option>
                {warehouseOptions.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Adjustment (±)</label>
              <input
                required
                type="number"
                placeholder="e.g. -5 or +10"
                value={form.adjustment}
                onChange={e => setForm(f => ({ ...f, adjustment: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Reason</label>
              <input
                required
                type="text"
                placeholder="Damaged, found extra…"
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="text-sm px-4 py-2 rounded-lg bg-slate-700 text-white font-medium
                         hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Cycle count panel ─────────────────────────────────────────────────────────
function CycleCountPanel({ materialId, warehouseOptions, onDone }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ warehouse_id: '', counted_qty: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await client.post('/stock/cycle-count', {
        material_id:  materialId,
        warehouse_id: form.warehouse_id,
        counted_qty:  Number(form.counted_qty),
        notes:        form.notes,
      });
      setForm({ warehouse_id: '', counted_qty: '', notes: '' });
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Cycle count failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-dashed border-blue-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3
                   text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-blue-400" />
          Submit Cycle Count
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3 bg-blue-50/40 border-t border-blue-100">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mt-3">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 pt-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Warehouse</label>
              <select
                required
                value={form.warehouse_id}
                onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white
                           focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Select…</option>
                {warehouseOptions.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Physical Count</label>
              <input
                required
                type="number"
                min="0"
                placeholder="Actual qty on shelf"
                value={form.counted_qty}
                onChange={e => setForm(f => ({ ...f, counted_qty: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white
                           focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
              <input
                type="text"
                placeholder="Optional…"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white
                           focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white font-medium
                         hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Record Count'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MaterialDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { collapsed, onToggleSidebar } = useOutletContext();

  const { material, stock, loading, error, refresh } = useMaterialDetail(id);
  const { movements, loading: movLoading, refresh: refreshMov } = useMaterialMovements(id);

  const [movFilter,     setMovFilter]     = useState('all');
  const [transferOpen,  setTransferOpen]  = useState(false);

  function handleDataChange() {
    refresh();
    refreshMov();
  }

  // Warehouse options for forms
  const warehouseOptions = stock.map(s => ({ id: s.warehouse_id, name: s.warehouse_name }));

  // Truck stock from material detail payload
  const truckStock = material?.truck_stock ?? [];

  // Filter movements
  const displayedMov = movements.filter(m => {
    if (movFilter === 'all') return true;
    return m.movement_type === movFilter;
  });

  // Movement type options from actual data
  const movTypes = [...new Set(movements.map(m => m.movement_type))];

  if (loading) {
    return (
      <>
        <Header title="Material" subtitle="Loading…" collapsed={collapsed} onToggleSidebar={onToggleSidebar} />
        <main className="flex-1 flex items-center justify-center">
          <Spinner size="lg" className="text-indigo-400" />
        </main>
      </>
    );
  }

  if (error || !material) {
    return (
      <>
        <Header title="Material" subtitle="Error" collapsed={collapsed} onToggleSidebar={onToggleSidebar} />
        <main className="flex-1 px-6 py-6">
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error ?? 'Material not found'}
          </div>
        </main>
      </>
    );
  }

  const totalOnHand = stock.reduce((s, r) => s + Number(r.qty_on_hand ?? 0), 0);
  const totalReserved = stock.reduce((s, r) => s + Number(r.qty_reserved ?? 0), 0);
  const rop = Number(material.reorder_point ?? 0);
  const isOOS = totalOnHand === 0;
  const isLow = !isOOS && rop > 0 && totalOnHand <= rop;

  return (
    <>
      <Header
        title={material.name}
        subtitle={`${(material.sku ?? material.part_number) ? `SKU ${material.sku ?? material.part_number} · ` : ''}${material.category ?? ''}`}
        collapsed={collapsed}
        onToggleSidebar={onToggleSidebar}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTransferOpen(true)}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700
                         px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Transfer
            </button>
            <button
              onClick={handleDataChange}
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

        {/* Back nav */}
        <button
          onClick={() => navigate('/materials')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All Materials
        </button>

        {/* Header card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center
                ${isOOS ? 'bg-red-100 text-red-500' : isLow ? 'bg-amber-100 text-amber-500' : 'bg-indigo-100 text-indigo-500'}`}>
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">{material.name}</h2>
                {material.description && (
                  <p className="text-sm text-slate-500 mt-0.5">{material.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge status={material.department ?? 'default'} dot>{material.department ?? '—'}</Badge>
              {isOOS && <Badge status="cancelled" dot>Out of stock</Badge>}
              {isLow && !isOOS && <Badge status="locked" dot>Below reorder</Badge>}
              {!isOOS && !isLow && <Badge status="completed" dot>In stock</Badge>}
            </div>
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-4 pt-4 border-t border-slate-100">
            {[
              { label: 'Part Number',   val: material.part_number ?? '—', mono: true },
              { label: 'Category',      val: material.category    ?? '—' },
              { label: 'Unit Cost',     val: material.unit_cost != null ? fmt.format(material.unit_cost) : '—' },
              { label: 'Total On Hand', val: totalOnHand, bold: true },
              { label: 'Total Reserved',val: totalReserved },
            ].map(({ label, val, mono, bold }) => (
              <div key={label}>
                <p className="text-xs text-slate-400 font-medium">{label}</p>
                <p className={`mt-0.5 ${bold ? 'text-xl font-bold text-slate-800' : 'text-sm text-slate-700'} ${mono ? 'font-mono text-xs' : ''}`}>
                  {val}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Warehouse stock cards */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
            Warehouse Stock
          </h3>
          {stock.length === 0 ? (
            <div className="text-sm text-slate-400 bg-white rounded-xl border border-slate-200 px-5 py-8 text-center">
              No warehouse stock records found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stock.map(row => (
                <WarehouseCard key={row.warehouse_id ?? row.warehouse_name} row={row} />
              ))}
            </div>
          )}
        </div>

        {/* Truck stock */}
        <TruckStockPanel truckStock={truckStock} />

        {/* Action panels */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            Actions
          </h3>
          <AdjustPanel
            materialId={id}
            warehouseOptions={warehouseOptions}
            onDone={handleDataChange}
          />
          <CycleCountPanel
            materialId={id}
            warehouseOptions={warehouseOptions}
            onDone={handleDataChange}
          />
        </div>

        {/* Movement history */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Movement History
              <span className="text-xs font-normal text-slate-400">· last 50</span>
            </h3>
            {/* Type filter */}
            <select
              value={movFilter}
              onChange={e => setMovFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            >
              <option value="all">All types</option>
              {movTypes.map(t => (
                <option key={t} value={t}>{MOVEMENT_META[t]?.label ?? t}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Location</th>
                  <th>By</th>
                  <th>Job #</th>
                  <th>When</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {movLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-2.5">
                          <div className="h-3 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : displayedMov.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                      No movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  displayedMov.map((m, i) => <MovementRow key={m.id ?? i} movement={m} />)
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {transferOpen && (
        <TransferModal
          materialId={id}
          onClose={() => setTransferOpen(false)}
          onDone={handleDataChange}
        />
      )}
    </>
  );
}
