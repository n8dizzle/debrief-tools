/**
 * Warehouse Detail — full stock breakdown for one warehouse
 *
 * Sections:
 *  - Header card: name, location, dept, health bar
 *  - Assigned trucks strip
 *  - Active restock bins
 *  - Full stock table: search, filter by category/dept/status, sortable
 */

import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft, Warehouse, Package, Truck, RotateCcw,
  AlertCircle, Search, X, AlertTriangle, CheckCircle2,
  TrendingDown, ChevronDown, ChevronUp, BoxSelect, Clock, ArrowRightLeft,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Header  from '../components/Header.jsx';
import Badge   from '../components/ui/Badge.jsx';
import { Spinner, SkeletonRow } from '../components/ui/Spinner.jsx';
import { useWarehouseDetail } from '../hooks/useWarehouses.js';
import TransferModal from '../components/TransferModal.jsx';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// ── Stock fill bar ────────────────────────────────────────────────────────────
function FillBar({ onHand, max, rop }) {
  const q   = Number(onHand ?? 0);
  const m   = Number(max  ?? 0);
  const r   = Number(rop  ?? 0);
  const pct = m > 0 ? Math.min(100, Math.round((q / m) * 100)) : 0;
  const isEmpty = q === 0;
  const isLow   = !isEmpty && r > 0 && q <= r;

  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all
            ${isEmpty ? 'bg-red-400' : isLow ? 'bg-amber-400' : 'bg-indigo-500'}`}
          style={{ width: m > 0 ? `${pct}%` : '0%' }}
        />
      </div>
      <span className={`text-xs tabular-nums font-semibold whitespace-nowrap
        ${isEmpty ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-700'}`}>
        {q}
        {m > 0 && <span className="font-normal text-slate-400">/{m}</span>}
      </span>
    </div>
  );
}

// ── Bin status pill ───────────────────────────────────────────────────────────
const BIN_META = {
  empty:        { label: 'Empty',        color: 'bg-slate-100 text-slate-500' },
  loading:      { label: 'Loading',      color: 'bg-blue-100 text-blue-700' },
  pending_scan: { label: 'Pending Scan', color: 'bg-amber-100 text-amber-700' },
  scanned:      { label: 'Scanned',      color: 'bg-emerald-100 text-emerald-700' },
};

function BinCard({ bin }) {
  const meta = BIN_META[bin.status] ?? { label: bin.status, color: 'bg-slate-100 text-slate-500' };
  const isPendingScan = bin.status === 'pending_scan';
  const isOverdue = isPendingScan && bin.loaded_at &&
    (Date.now() - new Date(bin.loaded_at).getTime()) > 24 * 60 * 60 * 1000;

  return (
    <div className={`rounded-xl border px-4 py-3 space-y-1.5
      ${isOverdue ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
          <BoxSelect className="w-3.5 h-3.5 text-slate-400" />
          {bin.bin_label ?? bin.bin_code ?? bin.id?.slice(0, 8)}
        </span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>
          {meta.label}
        </span>
      </div>
      {bin.truck_number && (
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Truck className="w-3 h-3" />
          {bin.truck_number}
        </p>
      )}
      {(bin.sku_count ?? bin.item_count) != null && (
        <p className="text-xs text-slate-400">{bin.sku_count ?? bin.item_count} SKU{(bin.sku_count ?? bin.item_count) !== 1 ? 's' : ''}</p>
      )}
      {isPendingScan && bin.loaded_at && (
        <p className={`text-[11px] flex items-center gap-1 font-medium
          ${isOverdue ? 'text-amber-600' : 'text-slate-400'}`}>
          <Clock className="w-3 h-3" />
          {isOverdue ? '⚠ ' : ''}
          {formatDistanceToNow(new Date(bin.loaded_at), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}

// ── Stock row ─────────────────────────────────────────────────────────────────
function StockRow({ row, onClick, onTransfer }) {
  const onHand   = Number(row.qty_on_hand  ?? 0);
  const reserved = Number(row.qty_reserved ?? 0);
  const rop      = Number(row.reorder_point ?? 0);
  const maxStock = Number(row.max_stock    ?? 0);
  const isEmpty  = onHand === 0;
  const isLow    = !isEmpty && rop > 0 && onHand <= rop;

  return (
    <tr
      className={`border-b border-slate-50 cursor-pointer transition-colors hover:bg-indigo-50/30
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
              {row.material_name ?? row.name ?? 'Unknown'}
            </p>
            {(row.sku ?? row.part_number) && (
              <p className="text-[11px] font-mono text-slate-400">{row.sku ?? row.part_number}</p>
            )}
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="px-4 py-2.5 text-xs text-slate-500">{row.category ?? '—'}</td>

      {/* Dept */}
      <td className="px-4 py-2.5">
        <Badge status={row.department ?? 'default'} dot>{row.department ?? '—'}</Badge>
      </td>

      {/* On hand / max */}
      <td className="px-4 py-2.5">
        <FillBar onHand={onHand} max={maxStock} rop={rop} />
      </td>

      {/* Reserved */}
      <td className="px-4 py-2.5 text-xs tabular-nums text-slate-500">
        {reserved > 0 ? (
          <span className="text-indigo-600 font-medium">{reserved} reserved</span>
        ) : '—'}
      </td>

      {/* Reorder point */}
      <td className="px-4 py-2.5 text-xs tabular-nums text-slate-500">{rop || '—'}</td>

      {/* Status */}
      <td className="px-4 py-2.5">
        {isEmpty
          ? <span className="flex items-center gap-1 text-xs font-semibold text-red-500"><AlertTriangle className="w-3 h-3" />OOS</span>
          : isLow
          ? <span className="flex items-center gap-1 text-xs font-semibold text-amber-500"><TrendingDown className="w-3 h-3" />Low</span>
          : <span className="flex items-center gap-1 text-xs text-emerald-500"><CheckCircle2 className="w-3 h-3" />OK</span>
        }
      </td>

      {/* Unit cost */}
      <td className="px-4 py-2.5 text-xs tabular-nums text-slate-500">
        {row.unit_cost != null ? fmt.format(row.unit_cost) : '—'}
      </td>

      {/* Stock value */}
      <td className="px-4 py-2.5 text-xs tabular-nums font-semibold text-slate-700">
        {row.unit_cost != null ? fmt.format(onHand * Number(row.unit_cost)) : '—'}
      </td>

      {/* Transfer action */}
      <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onTransfer(row)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg
                     border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
          title="Transfer to truck"
        >
          <ArrowRightLeft className="w-3 h-3" />
        </button>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WarehouseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { collapsed, onToggleSidebar } = useOutletContext();
  const { warehouse, stock, bins, trucks, loading, error, refresh } = useWarehouseDetail(id);

  const [search,      setSearch]      = useState('');
  const [deptFilter,  setDeptFilter]  = useState('');
  const [catFilter,   setCatFilter]   = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortKey,     setSortKey]     = useState('name');
  const [sortDir,     setSortDir]     = useState('asc');
  const [transferRow, setTransferRow] = useState(null);

  const dept = warehouse?.department ?? 'plumbing';
  const isPlumbing = dept === 'plumbing';

  // Categories from data
  const categories = useMemo(() =>
    [...new Set(stock.map(s => s.category).filter(Boolean))].sort()
  , [stock]);

  // Summary counts
  const oosCount    = stock.filter(s => Number(s.qty_on_hand ?? 0) === 0).length;
  const lowCount    = stock.filter(s => { const q = Number(s.qty_on_hand ?? 0); const r = Number(s.reorder_point ?? 0); return q > 0 && r > 0 && q <= r; }).length;
  const totalValue  = stock.reduce((sum, s) => sum + Number(s.qty_on_hand ?? 0) * Number(s.unit_cost ?? 0), 0);
  const totalUnits  = stock.reduce((sum, s) => sum + Number(s.qty_on_hand ?? 0), 0);
  const pendingScan = bins.filter(b => b.status === 'pending_scan').length;

  // Filter + sort
  const displayed = useMemo(() => {
    let arr = [...stock];
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(s =>
        (s.material_name ?? s.name ?? '').toLowerCase().includes(q) ||
        (s.sku ?? s.part_number ?? '').toLowerCase().includes(q) ||
        (s.category ?? '').toLowerCase().includes(q)
      );
    }
    if (deptFilter) arr = arr.filter(s => s.department === deptFilter);
    if (catFilter)  arr = arr.filter(s => s.category === catFilter);
    if (stockFilter === 'oos')   arr = arr.filter(s => Number(s.qty_on_hand ?? 0) === 0);
    if (stockFilter === 'low')   arr = arr.filter(s => { const q = Number(s.qty_on_hand ?? 0); const r = Number(s.reorder_point ?? 0); return q > 0 && r > 0 && q <= r; });
    if (stockFilter === 'ok')    arr = arr.filter(s => { const q = Number(s.qty_on_hand ?? 0); const r = Number(s.reorder_point ?? 0); return q > 0 && (r === 0 || q > r); });

    arr.sort((a, b) => {
      let av, bv;
      if (sortKey === 'name')  { av = (a.material_name ?? a.name ?? '').toLowerCase(); bv = (b.material_name ?? b.name ?? '').toLowerCase(); }
      if (sortKey === 'qty')   { av = Number(a.qty_on_hand ?? 0); bv = Number(b.qty_on_hand ?? 0); }
      if (sortKey === 'value') { av = Number(a.qty_on_hand ?? 0) * Number(a.unit_cost ?? 0); bv = Number(b.qty_on_hand ?? 0) * Number(b.unit_cost ?? 0); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
    return arr;
  }, [stock, search, deptFilter, catFilter, stockFilter, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-indigo-500" /> : <ChevronDown className="w-3 h-3 text-indigo-500" />;
  }

  if (loading) {
    return (
      <>
        <Header title="Warehouse" subtitle="Loading…" collapsed={collapsed} onToggleSidebar={onToggleSidebar} />
        <main className="flex-1 flex items-center justify-center"><Spinner size="lg" className="text-indigo-400" /></main>
      </>
    );
  }

  if (error || !warehouse) {
    return (
      <>
        <Header title="Warehouse" subtitle="Error" collapsed={collapsed} onToggleSidebar={onToggleSidebar} />
        <main className="flex-1 px-6 py-6">
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />{error ?? 'Warehouse not found'}
          </div>
        </main>
      </>
    );
  }

  const healthPct = stock.length > 0
    ? Math.round(((stock.length - oosCount - lowCount) / stock.length) * 100)
    : 100;

  return (
    <>
      <Header
        title={warehouse.name}
        subtitle={warehouse.city ?? warehouse.location ?? (isPlumbing ? 'Lewisville, TX — Plumbing' : 'Argyle, TX — HVAC')}
        collapsed={collapsed}
        onToggleSidebar={onToggleSidebar}
        actions={
          <button onClick={refresh}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700
                       px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />Refresh
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

        <button onClick={() => navigate('/warehouses')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />All Warehouses
        </button>

        {/* Header card */}
        <div className={`rounded-2xl border shadow-sm overflow-hidden
          ${isPlumbing ? 'border-blue-200' : 'border-orange-200'}`}>
          <div className={`px-6 py-5 ${isPlumbing ? 'bg-blue-600' : 'bg-orange-500'}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <Warehouse className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white">{warehouse.name}</h2>
                <p className="text-white/70 text-sm">{isPlumbing ? 'Plumbing Division' : 'HVAC Division'}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-white tabular-nums">{healthPct}%</p>
                <p className="text-white/70 text-xs">Stock health</p>
              </div>
            </div>
            <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${healthPct >= 90 ? 'bg-emerald-400' : healthPct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${healthPct}%` }}
              />
            </div>
          </div>

          {/* Stat row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-0 divide-x divide-slate-100">
            {[
              { label: 'SKUs',        val: stock.length },
              { label: 'Total Units', val: totalUnits.toLocaleString() },
              { label: 'Out of Stock',val: oosCount,    alert: oosCount > 0 },
              { label: 'Below Reorder',val: lowCount,   alert: lowCount > 0 },
              { label: 'Stock Value', val: fmt.format(totalValue) },
            ].map(({ label, val, alert }) => (
              <div key={label} className="px-4 py-3 text-center">
                <p className={`text-lg font-black tabular-nums ${alert ? 'text-amber-600' : 'text-slate-800'}`}>{val}</p>
                <p className="text-[11px] text-slate-400 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trucks strip */}
        {trucks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
              Assigned Trucks ({trucks.length})
            </h3>
            <div className="flex gap-2 flex-wrap">
              {trucks.map(t => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/trucks/${t.id}`)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors
                    ${isPlumbing
                      ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                      : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'}`}
                >
                  <Truck className="w-3 h-3" />
                  {t.truck_number}
                  {(t.assigned_tech ?? t.assigned_tech_name) && (
                    <span className="font-normal opacity-70">· {t.assigned_tech ?? t.assigned_tech_name}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active bins */}
        {bins.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1 flex items-center gap-2">
              Restock Bins
              {pendingScan > 0 && (
                <span className="text-amber-500 font-bold normal-case">· {pendingScan} pending scan</span>
              )}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {bins.map(b => <BinCard key={b.id} bin={b} />)}
            </div>
          </div>
        )}

        {/* Stock table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200 flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search stock…"
                className="bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none flex-1"
              />
              {search && <button onClick={() => setSearch('')}><X className="w-3 h-3 text-slate-400" /></button>}
            </div>

            {/* Dept */}
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="">All depts</option>
              <option value="plumbing">Plumbing</option>
              <option value="hvac">HVAC</option>
            </select>

            {/* Category */}
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Stock status filter */}
            <div className="flex items-center gap-1">
              {[
                { key: 'all', label: 'All' },
                { key: 'oos', label: 'OOS' },
                { key: 'low', label: 'Low' },
                { key: 'ok',  label: 'OK' },
              ].map(f => (
                <button key={f.key} onClick={() => setStockFilter(f.key)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors
                    ${stockFilter === f.key
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
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
                  <th>Dept</th>
                  <th>
                    <button className="flex items-center gap-1 hover:text-slate-700" onClick={() => toggleSort('qty')}>
                      On Hand / Max <SortIcon col="qty" />
                    </button>
                  </th>
                  <th>Reserved</th>
                  <th>Reorder At</th>
                  <th>Status</th>
                  <th>Unit Cost</th>
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
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                      {stock.length === 0 ? 'No stock records for this warehouse.' : 'No items match the current filters.'}
                    </td>
                  </tr>
                ) : (
                  displayed.map((row, i) => (
                    <StockRow
                      key={row.material_id ?? i}
                      row={row}
                      onClick={() => navigate(`/materials/${row.material_id}`)}
                      onTransfer={row => setTransferRow(row)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {displayed.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {displayed.length} of {stock.length} SKU{stock.length !== 1 ? 's' : ''}
                {(oosCount > 0 || lowCount > 0) && (
                  <span className="ml-2 text-amber-500 font-medium">
                    · {oosCount > 0 ? `${oosCount} OOS` : ''}
                    {oosCount > 0 && lowCount > 0 ? ', ' : ''}
                    {lowCount > 0 ? `${lowCount} low` : ''}
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold text-slate-600">
                {fmt.format(displayed.reduce((s, r) => s + Number(r.qty_on_hand ?? 0) * Number(r.unit_cost ?? 0), 0))}
              </span>
            </div>
          )}
        </div>

      </main>

      {transferRow && (
        <TransferModal
          materialId={transferRow.material_id ?? transferRow.id}
          fromType="warehouse"
          fromId={id}
          onClose={() => setTransferRow(null)}
          onDone={() => { setTransferRow(null); refresh(); }}
        />
      )}
    </>
  );
}
