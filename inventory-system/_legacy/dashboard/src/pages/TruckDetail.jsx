/**
 * Truck Detail — full stock manifest for one truck
 *
 * Shows every material loaded on the truck with qty, par level, and low-stock alerts.
 * Also surfaces the truck's vehicle info and assigned technician.
 */

import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft, Truck, Package, AlertTriangle, RotateCcw,
  AlertCircle, Search, X, CheckCircle2, ChevronDown, ChevronUp,
  User, Hash, Clipboard, UserCog, Check, MapPin, SlidersHorizontal,
  Flag, Clock, Activity, Minus, Plus, Edit2, ArrowRightLeft,
} from 'lucide-react';
import TransferModal from '../components/TransferModal.jsx';
import { formatDistanceToNow } from 'date-fns';
import Header  from '../components/Header.jsx';
import Badge   from '../components/ui/Badge.jsx';
import { Spinner, SkeletonRow } from '../components/ui/Spinner.jsx';
import { useTruckDetail } from '../hooks/useTrucks.js';
import client from '../api/client.js';

// ── Assign Tech Modal ─────────────────────────────────────────────────────────
function AssignTechModal({ truck, onClose, onSaved }) {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [selected, setSelected] = useState(truck.assigned_user_id ?? null);
  const [error,    setError]    = useState('');

  useEffect(() => {
    client.get('/users')
      .then(({ data }) => setUsers((data.users ?? []).filter(u => u.role === 'tech')))
      .catch(() => setError('Could not load users.'))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true); setError('');
    try {
      await client.post(`/trucks/${truck.id}/assign-tech`, { user_id: selected ?? null });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-lg">Assign Technician</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <p className="text-slate-500 text-sm">
          Select the tech assigned to <span className="font-semibold text-slate-700">Truck {truck.truck_number}</span>.
          They will see this truck automatically in the field scanner.
        </p>

        {loading ? (
          <div className="flex justify-center py-6"><Spinner className="text-indigo-400" /></div>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {/* Unassign option */}
            <button
              onClick={() => setSelected(null)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors
                ${selected === null
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-slate-400" />
              </div>
              <span className="text-sm font-medium">Unassigned</span>
              {selected === null && <Check size={14} className="ml-auto text-indigo-500" />}
            </button>

            {users.map(u => (
              <button
                key={u.id}
                onClick={() => setSelected(u.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors
                  ${selected === u.id
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">
                  {u.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{u.name}</p>
                  <p className="text-xs text-slate-400 truncate">{u.email}</p>
                </div>
                {u.truck_id && u.truck_id !== truck.id && (
                  <span className="text-xs text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-md flex-shrink-0">
                    on another truck
                  </span>
                )}
                {selected === u.id && <Check size={14} className="ml-auto text-indigo-500 flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || loading}
            className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60 hover:bg-indigo-700"
          >
            {saving ? 'Saving…' : 'Save Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
}

const DEPT_META = {
  plumbing: { label: 'Plumbing', color: 'bg-blue-100 text-blue-700', border: 'border-blue-200' },
  hvac:     { label: 'HVAC',     color: 'bg-orange-100 text-orange-700', border: 'border-orange-200' },
};

// ── Stock level indicator ─────────────────────────────────────────────────────
function StockLevel({ qty, parLevel }) {
  const par = Number(parLevel ?? 0);
  const q   = Number(qty ?? 0);
  const pct = par > 0 ? Math.min(100, Math.round((q / par) * 100)) : 100;
  const isLow = par > 0 && q < par;
  const isEmpty = q === 0;

  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all
            ${isEmpty ? 'bg-red-400' : isLow ? 'bg-amber-400' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs tabular-nums font-semibold whitespace-nowrap
        ${isEmpty ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-700'}`}>
        {q}
        {par > 0 && <span className="font-normal text-slate-400">/{par}</span>}
      </span>
    </div>
  );
}

// ── Quick Adjust Modal ────────────────────────────────────────────────────────
function QuickAdjustModal({ truckId, item, onClose, onSaved }) {
  const [qty,     setQty]     = useState(String(item.qty_on_hand ?? 0));
  const [bin,     setBin]     = useState(item.bin_location ?? '');
  const [note,    setNote]    = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await client.patch(`/trucks/${truckId}/stock/${item.material_id}`, {
        qty_on_hand:  Number(qty),
        bin_location: bin || undefined,
        note:         note || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Adjust Stock</p>
              <p className="text-xs text-slate-400 truncate max-w-[200px]">{item.material_name ?? item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-5 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          {/* Qty stepper */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">
              Quantity on Hand
              {item.par_level > 0 && (
                <span className="ml-1.5 font-normal text-slate-400">(par: {item.par_level})</span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQty(q => String(Math.max(0, Number(q) - 1)))}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <Minus className="w-4 h-4 text-slate-600" />
              </button>
              <input
                type="number"
                min="0"
                value={qty}
                onChange={e => setQty(e.target.value)}
                className="flex-1 text-center text-xl font-bold border border-slate-200 rounded-xl py-2
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="button"
                onClick={() => setQty(q => String(Number(q) + 1))}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <Plus className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            {Number(qty) > 0 && item.unit_cost && (
              <p className="text-xs text-slate-400 mt-1.5 text-center">
                Value: {fmt.format(Number(qty) * Number(item.unit_cost))}
              </p>
            )}
          </div>

          {/* Bin location */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              <MapPin className="w-3 h-3 inline mr-1" />Bin Location
            </label>
            <input
              type="text"
              value={bin}
              onChange={e => setBin(e.target.value)}
              placeholder="e.g. Drawer A, Left Cabinet…"
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Reason for adjustment…"
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-sm py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 text-sm py-2.5 rounded-xl bg-indigo-600 text-white font-semibold
                         hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Stock row ─────────────────────────────────────────────────────────────────
function StockRow({ item, truckId, onAdjust, onFlag, onTransfer, onClick }) {
  const qty    = Number(item.qty_on_hand ?? 0);
  const par    = Number(item.par_level ?? item.reorder_point ?? 0);
  const isLow  = par > 0 && qty < par;
  const isEmpty = qty === 0;
  const fmtCur = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const [flagging, setFlagging] = useState(false);

  async function handleFlag(e) {
    e.stopPropagation();
    setFlagging(true);
    try { await onFlag(item); } finally { setFlagging(false); }
  }

  return (
    <tr
      className={`border-b border-slate-50 transition-colors cursor-pointer hover:bg-indigo-50/30
        ${isEmpty ? 'bg-red-50/20' : isLow ? 'bg-amber-50/20' : ''}`}
      onClick={onClick}
    >
      {/* Material */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
            ${isEmpty ? 'bg-red-100 text-red-400' : isLow ? 'bg-amber-100 text-amber-400' : 'bg-slate-100 text-slate-400'}`}>
            <Package className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
              {item.material_name ?? item.name ?? 'Unknown'}
            </p>
            {item.part_number && (
              <p className="text-[11px] font-mono text-slate-400">{item.part_number}</p>
            )}
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="px-4 py-2.5 text-xs text-slate-500">{item.category ?? '—'}</td>

      {/* Bin location */}
      <td className="px-4 py-2.5">
        {item.bin_location
          ? <span className="flex items-center gap-1 text-xs text-slate-600">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              {item.bin_location}
            </span>
          : <span className="text-xs text-slate-300">—</span>
        }
      </td>

      {/* Stock vs par */}
      <td className="px-4 py-2.5">
        <StockLevel qty={qty} parLevel={par} />
      </td>

      {/* Status */}
      <td className="px-4 py-2.5">
        {isEmpty
          ? <span className="flex items-center gap-1 text-xs font-semibold text-red-500"><AlertTriangle className="w-3 h-3" />Empty</span>
          : isLow
          ? <span className="flex items-center gap-1 text-xs font-semibold text-amber-500"><AlertTriangle className="w-3 h-3" />Low</span>
          : <span className="flex items-center gap-1 text-xs text-emerald-500"><CheckCircle2 className="w-3 h-3" />OK</span>
        }
      </td>

      {/* Last restocked */}
      <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
        {item.last_restocked_at
          ? formatDistanceToNow(new Date(item.last_restocked_at), { addSuffix: true })
          : '—'}
      </td>

      {/* Stock value */}
      <td className="px-4 py-2.5 text-xs tabular-nums font-semibold text-slate-700">
        {item.unit_cost != null
          ? fmtCur.format(qty * Number(item.unit_cost))
          : '—'}
      </td>

      {/* Actions */}
      <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <button
            onClick={e => { e.stopPropagation(); onAdjust(item); }}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg
                       border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
            title="Adjust quantity / bin"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          {(isEmpty || isLow) && (
            <button
              onClick={handleFlag}
              disabled={flagging}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg
                         border border-amber-200 text-amber-600 hover:bg-amber-50
                         disabled:opacity-50 transition-colors"
              title="Flag for restock"
            >
              <Flag className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onTransfer(item); }}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg
                       border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
            title="Transfer stock"
          >
            <ArrowRightLeft className="w-3 h-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TruckDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { collapsed, onToggleSidebar } = useOutletContext();
  const { truck, stock, loading, error, refresh } = useTruckDetail(id);

  const [search,       setSearch]       = useState('');
  const [stockFilter,  setStockFilter]  = useState('all');
  const [sortKey,      setSortKey]      = useState('name');
  const [sortDir,      setSortDir]      = useState('asc');
  const [assignOpen,   setAssignOpen]   = useState(false);
  const [adjustItem,   setAdjustItem]   = useState(null);   // item being adjusted
  const [transferItem, setTransferItem] = useState(null);   // item for stock transfer
  const [flagMsg,      setFlagMsg]      = useState('');     // flag-for-restock toast

  const dept = truck?.department ?? (truck?.truck_number?.startsWith('P') ? 'plumbing' : 'hvac');
  const deptMeta = DEPT_META[dept] ?? DEPT_META.plumbing;

  // Filter + sort
  const displayed = useMemo(() => {
    let arr = [...stock];

    // Text search
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(s =>
        (s.material_name ?? s.name ?? '').toLowerCase().includes(q) ||
        (s.part_number ?? s.sku ?? '').toLowerCase().includes(q) ||
        (s.category ?? '').toLowerCase().includes(q) ||
        (s.bin_location ?? '').toLowerCase().includes(q)
      );
    }

    // Stock filter
    arr = arr.filter(s => {
      const qty = Number(s.qty_on_hand ?? s.qty ?? 0);
      const par = Number(s.par_level ?? s.reorder_point ?? 0);
      if (stockFilter === 'empty') return qty === 0;
      if (stockFilter === 'low')   return qty > 0 && par > 0 && qty < par;
      if (stockFilter === 'ok')    return qty > 0 && (par === 0 || qty >= par);
      return true;
    });

    // Sort
    arr.sort((a, b) => {
      let av, bv;
      if (sortKey === 'name')  { av = (a.material_name ?? a.name ?? '').toLowerCase(); bv = (b.material_name ?? b.name ?? '').toLowerCase(); }
      if (sortKey === 'qty')   { av = Number(a.qty_on_hand ?? a.qty ?? 0); bv = Number(b.qty_on_hand ?? b.qty ?? 0); }
      if (sortKey === 'value') { av = Number(a.qty_on_hand ?? a.qty ?? 0) * Number(a.unit_cost ?? 0); bv = Number(b.qty_on_hand ?? b.qty ?? 0) * Number(b.unit_cost ?? 0); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });

    return arr;
  }, [stock, search, stockFilter, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  async function handleFlag(item) {
    try {
      const { data } = await client.post(`/trucks/${id}/flag-restock/${item.material_id}`);
      setFlagMsg(data.message ?? 'Flagged for restock');
      setTimeout(() => setFlagMsg(''), 3500);
    } catch (err) {
      setFlagMsg(err.response?.data?.error ?? 'Flag failed');
      setTimeout(() => setFlagMsg(''), 3500);
    }
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-indigo-500" /> : <ChevronDown className="w-3 h-3 text-indigo-500" />;
  }

  // Summary stats
  const totalSKUs   = stock.length;
  const emptyCount  = stock.filter(s => Number(s.qty_on_hand ?? s.qty ?? 0) === 0).length;
  const lowCount    = stock.filter(s => {
    const q = Number(s.qty_on_hand ?? s.qty ?? 0);
    const p = Number(s.par_level ?? s.reorder_point ?? 0);
    return q > 0 && p > 0 && q < p;
  }).length;
  const totalUnits  = stock.reduce((sum, s) => sum + Number(s.qty_on_hand ?? s.qty ?? 0), 0);
  const totalValue  = stock.reduce((sum, s) => sum + Number(s.qty_on_hand ?? s.qty ?? 0) * Number(s.unit_cost ?? 0), 0);

  if (loading) {
    return (
      <>
        <Header title="Truck" subtitle="Loading…" collapsed={collapsed} onToggleSidebar={onToggleSidebar} />
        <main className="flex-1 flex items-center justify-center"><Spinner size="lg" className="text-indigo-400" /></main>
      </>
    );
  }

  if (error || !truck) {
    return (
      <>
        <Header title="Truck" subtitle="Error" collapsed={collapsed} onToggleSidebar={onToggleSidebar} />
        <main className="flex-1 px-6 py-6">
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />{error ?? 'Truck not found'}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header
        title={`Truck ${truck.truck_number}`}
        subtitle={[truck.year, truck.make, truck.model].filter(Boolean).join(' ') || deptMeta.label}
        collapsed={collapsed}
        onToggleSidebar={onToggleSidebar}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAssignOpen(true)}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700
                         px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors font-medium">
              <UserCog className="w-3.5 h-3.5" />Assign Tech
            </button>
            <button onClick={refresh}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700
                         px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />Refresh
            </button>
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

        <button onClick={() => navigate('/trucks')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />All Trucks
        </button>

        {/* Header card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black border-2 ${deptMeta.color} ${deptMeta.border}`}>
                {truck.truck_number}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {[truck.year, truck.make, truck.model].filter(Boolean).join(' ') || `Truck ${truck.truck_number}`}
                </h2>
                <Badge status={dept} dot>{deptMeta.label}</Badge>
              </div>
            </div>
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100 text-sm">
            {[
              { label: 'Warehouse',      val: truck.warehouse_name ?? '—',    icon: Truck },
              { label: 'Technician',     val: truck.assigned_user?.name ?? truck.assigned_tech ?? 'Unassigned', icon: User },
              { label: 'License Plate',  val: truck.license_plate ?? '—',     icon: Clipboard, mono: true },
              { label: 'VIN',            val: truck.vin ? truck.vin.slice(-8) + '…' : '—', icon: Hash, mono: true },
            ].map(({ label, val, icon: Icon, mono }) => (
              <div key={label}>
                <p className="text-xs text-slate-400 font-medium flex items-center gap-1"><Icon className="w-3 h-3" />{label}</p>
                <p className={`text-slate-700 mt-0.5 ${mono ? 'font-mono text-xs' : ''}`}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'SKUs Loaded',  val: totalSKUs,  color: 'bg-indigo-50 text-indigo-700',   filter: 'all' },
            { label: 'Total Units',  val: totalUnits, color: 'bg-slate-50 text-slate-700',     filter: null },
            { label: 'Low Stock',    val: lowCount,   color: lowCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-400', filter: 'low' },
            { label: 'Empty Slots',  val: emptyCount, color: emptyCount > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-400',   filter: 'empty' },
          ].map(({ label, val, color, filter }) => (
            <button
              key={label}
              onClick={() => filter && setStockFilter(f => f === filter ? 'all' : filter)}
              className={`rounded-xl px-4 py-3 text-left transition-all ${color}
                ${filter ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}
                ${stockFilter === filter ? 'ring-2 ring-indigo-300' : ''}`}
            >
              <p className="text-2xl font-black tabular-nums">{val}</p>
              <p className="text-xs font-medium mt-0.5 opacity-70">{label}</p>
            </button>
          ))}
        </div>

        {/* Stock value banner */}
        {totalValue > 0 && (
          <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3">
            <span className="text-sm text-slate-500">Estimated stock value on this truck</span>
            <span className="text-lg font-bold text-slate-800">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue)}
            </span>
          </div>
        )}

        {/* Manifest table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Search + filter bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200 flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search manifest…"
                className="bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none flex-1"
              />
              {search && <button onClick={() => setSearch('')}><X className="w-3 h-3 text-slate-400" /></button>}
            </div>

            {/* Stock filter pills */}
            <div className="flex items-center gap-1.5">
              {[
                { key: 'all',   label: 'All' },
                { key: 'low',   label: 'Low' },
                { key: 'empty', label: 'Empty' },
                { key: 'ok',    label: 'OK' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStockFilter(f.key)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors
                    ${stockFilter === f.key
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <button className="flex items-center gap-1 hover:text-slate-700" onClick={() => toggleSort('name')}>
                      Material <SortIcon col="name" />
                    </button>
                  </th>
                  <th>Category</th>
                  <th>Bin Location</th>
                  <th>
                    <button className="flex items-center gap-1 hover:text-slate-700" onClick={() => toggleSort('qty')}>
                      Qty / Par <SortIcon col="qty" />
                    </button>
                  </th>
                  <th>Status</th>
                  <th>Last Restocked</th>
                  <th>
                    <button className="flex items-center gap-1 hover:text-slate-700" onClick={() => toggleSort('value')}>
                      Value <SortIcon col="value" />
                    </button>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                      {stock.length === 0
                        ? 'No stock loaded on this truck yet.'
                        : 'No items match the current filter.'}
                    </td>
                  </tr>
                ) : (
                  displayed.map((item, i) => (
                    <StockRow
                      key={item.material_id ?? i}
                      item={item}
                      truckId={id}
                      onAdjust={item => setAdjustItem(item)}
                      onFlag={handleFlag}
                      onTransfer={item => setTransferItem(item)}
                      onClick={() => navigate(`/materials/${item.material_id}`)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {displayed.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {displayed.length} of {totalSKUs} SKU{totalSKUs !== 1 ? 's' : ''}
              </span>
              <span className="text-xs font-semibold text-slate-600">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
                  .format(displayed.reduce((s, i) => s + Number(i.qty_on_hand ?? 0) * Number(i.unit_cost ?? 0), 0))}
              </span>
            </div>
          )}
        </div>
      </main>

      {assignOpen && (
        <AssignTechModal
          truck={truck}
          onClose={() => setAssignOpen(false)}
          onSaved={refresh}
        />
      )}

      {adjustItem && (
        <QuickAdjustModal
          truckId={id}
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
          onSaved={refresh}
        />
      )}

      {transferItem && (
        <TransferModal
          materialId={transferItem.material_id}
          fromType="truck"
          fromId={id}
          onClose={() => setTransferItem(null)}
          onDone={refresh}
        />
      )}

      {/* Flag toast */}
      {flagMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                        flex items-center gap-2 bg-slate-800 text-white text-sm
                        px-4 py-2.5 rounded-full shadow-xl border border-slate-700 whitespace-nowrap">
          <Flag className="w-3.5 h-3.5 text-amber-400" />
          {flagMsg}
        </div>
      )}
    </>
  );
}
