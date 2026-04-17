/**
 * Materials — catalog list page
 *
 * Full inventory catalog with live stock levels per warehouse.
 * Reorder alerts, department filter, search, and barcode/part-number lookup.
 */

import { useState, useMemo, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Search, SlidersHorizontal, AlertTriangle, RotateCcw,
  ChevronRight, Package, X, Barcode, TrendingDown,
  ChevronDown, ChevronUp, ArrowRightLeft,
} from 'lucide-react';
import Header       from '../components/Header.jsx';
import Badge        from '../components/ui/Badge.jsx';
import { SkeletonRow } from '../components/ui/Spinner.jsx';
import EmptyState   from '../components/ui/EmptyState.jsx';
import { useMaterialList } from '../hooks/useMaterials.js';
import TransferModal from '../components/TransferModal.jsx';

// ── Currency formatter ────────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// ── Stock level pill ──────────────────────────────────────────────────────────
function StockPill({ onHand, reorderPoint, label }) {
  const qty = Number(onHand ?? 0);
  const rop = Number(reorderPoint ?? 0);
  const isOut  = qty === 0;
  const isLow  = qty > 0 && rop > 0 && qty <= rop;
  const isOk   = !isOut && !isLow;

  return (
    <div className="flex flex-col items-center min-w-[52px]">
      <span className={`text-sm font-bold tabular-nums
        ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-700'}`}>
        {qty}
      </span>
      <span className="text-[10px] text-slate-400">{label}</span>
      {isOut  && <span className="text-[9px] font-bold text-red-500 -mt-0.5">OOS</span>}
      {isLow  && <span className="text-[9px] font-bold text-amber-500 -mt-0.5">LOW</span>}
    </div>
  );
}

// ── Reorder status badge ──────────────────────────────────────────────────────
function ReorderBadge({ onHand, reorderPoint }) {
  const qty = Number(onHand ?? 0);
  const rop = Number(reorderPoint ?? 0);
  if (qty === 0) return <Badge status="cancelled" dot>Out of stock</Badge>;
  if (rop > 0 && qty <= rop) return <Badge status="locked" dot>Below reorder</Badge>;
  return <Badge status="completed" dot>In stock</Badge>;
}

// ── Sort config ───────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: 'name',       label: 'Name' },
  { key: 'part',       label: 'Part #' },
  { key: 'stock_lew',  label: 'Lewisville stock' },
  { key: 'stock_arg',  label: 'Argyle stock' },
  { key: 'cost',       label: 'Unit cost' },
];

// ── Material row ──────────────────────────────────────────────────────────────
function MaterialRow({ material }) {
  const navigate = useNavigate();

  // API may embed warehouse stock directly on the list item
  const lewStock = material.lewisville_qty ?? material.warehouse_stock?.find(s =>
    s.warehouse_name?.toLowerCase().includes('lewis'))?.qty_on_hand ?? null;
  const argStock = material.argyle_qty ?? material.warehouse_stock?.find(s =>
    s.warehouse_name?.toLowerCase().includes('argyle'))?.qty_on_hand ?? null;

  const totalOnHand = material.total_on_hand ??
    ((lewStock != null ? Number(lewStock) : 0) + (argStock != null ? Number(argStock) : 0));
  const reorderPoint = Number(material.reorder_point ?? 0);
  const isBelowReorder = totalOnHand <= reorderPoint && reorderPoint > 0;
  const isOOS = totalOnHand === 0;

  return (
    <tr
      className={`border-b border-slate-50 cursor-pointer transition-colors hover:bg-indigo-50/40
        ${isOOS ? 'bg-red-50/20' : isBelowReorder ? 'bg-amber-50/20' : ''}`}
      onClick={() => navigate(`/materials/${material.id}`)}
    >
      {/* Icon + Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
            ${isOOS ? 'bg-red-100 text-red-500' : isBelowReorder ? 'bg-amber-100 text-amber-500' : 'bg-slate-100 text-slate-400'}`}>
            <Package className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate max-w-[220px]">
              {material.name}
            </p>
            {material.description && (
              <p className="text-[11px] text-slate-400 truncate max-w-[220px]">{material.description}</p>
            )}
          </div>
        </div>
      </td>

      {/* Part # */}
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
          {material.part_number ?? '—'}
        </span>
      </td>

      {/* Category */}
      <td className="px-4 py-3 text-sm text-slate-500">{material.category ?? '—'}</td>

      {/* Department */}
      <td className="px-4 py-3">
        <Badge status={material.department ?? 'default'} dot>
          {material.department ?? '—'}
        </Badge>
      </td>

      {/* Lewisville stock */}
      <td className="px-4 py-3 text-center">
        {lewStock != null
          ? <StockPill onHand={lewStock} reorderPoint={material.reorder_point} label="Lew" />
          : <span className="text-xs text-slate-300">—</span>
        }
      </td>

      {/* Argyle stock */}
      <td className="px-4 py-3 text-center">
        {argStock != null
          ? <StockPill onHand={argStock} reorderPoint={material.reorder_point} label="Arg" />
          : <span className="text-xs text-slate-300">—</span>
        }
      </td>

      {/* Reorder status */}
      <td className="px-4 py-3">
        <ReorderBadge onHand={totalOnHand} reorderPoint={reorderPoint} />
      </td>

      {/* Unit cost */}
      <td className="px-4 py-3 text-sm tabular-nums text-slate-600">
        {material.unit_cost != null ? fmt.format(material.unit_cost) : '—'}
      </td>

      {/* Action */}
      <td className="px-4 py-3">
        <button
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg
                     bg-indigo-50 text-indigo-600 hover:bg-indigo-100
                     border border-indigo-200 font-medium transition-colors"
          onClick={e => { e.stopPropagation(); navigate(`/materials/${material.id}`); }}
        >
          View
          <ChevronRight className="w-3 h-3" />
        </button>
      </td>
    </tr>
  );
}

// ── Barcode lookup modal ──────────────────────────────────────────────────────
function BarcodeLookup({ onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query,   setQuery]   = useState('');
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // Auto-focus
  useState(() => { setTimeout(() => inputRef.current?.focus(), 50); });

  async function handleLookup(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // Try part number search
      const { data } = await import('../api/client.js').then(m =>
        m.default.get('/materials', { params: { search: query.trim(), limit: 1 } })
      );
      const mat = (data.materials ?? [])[0];
      if (mat) {
        setResult(mat);
      } else {
        setError('No material found for that barcode or part number.');
      }
    } catch (err) {
      setError(err.response?.data?.error ?? 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Barcode className="w-4 h-4 text-indigo-500" />
            Barcode / Part # Lookup
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <form onSubmit={handleLookup} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Scan barcode or enter part #…"
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium
                         hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '…' : 'Find'}
            </button>
          </form>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="border border-indigo-100 bg-indigo-50/50 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Package className="w-4 h-4 text-indigo-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{result.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{result.part_number}</p>
                </div>
              </div>
              <button
                onClick={() => { navigate(`/materials/${result.id}`); onClose(); }}
                className="w-full text-sm text-center py-2 rounded-lg bg-indigo-600 text-white
                           font-medium hover:bg-indigo-700 transition-colors"
              >
                Open Material
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Materials() {
  const { collapsed, onToggleSidebar } = useOutletContext();

  // Filters state
  const [search,       setSearch]       = useState('');
  const [department,   setDepartment]   = useState('');
  const [category,     setCategory]     = useState('');
  const [belowReorder, setBelowReorder] = useState(false);
  const [showFilters,   setShowFilters]   = useState(false);
  const [showBarcode,   setShowBarcode]   = useState(false);
  const [transferOpen,  setTransferOpen]  = useState(false);
  const [sortKey,      setSortKey]      = useState('name');
  const [sortDir,      setSortDir]      = useState('asc');

  // Debounce search — send to API on Enter or after short delay
  const [apiSearch, setApiSearch] = useState('');

  const apiFilters = useMemo(() => ({
    search:        apiSearch || undefined,
    department:    department || undefined,
    category:      category   || undefined,
    below_reorder: belowReorder || undefined,
  }), [apiSearch, department, category, belowReorder]);

  const { materials, loading, error, refresh } = useMaterialList(apiFilters);

  // Client-side sort
  const sorted = useMemo(() => {
    const arr = [...materials];
    arr.sort((a, b) => {
      let av, bv;
      if (sortKey === 'name')      { av = (a.name ?? '').toLowerCase(); bv = (b.name ?? '').toLowerCase(); }
      else if (sortKey === 'part') { av = (a.part_number ?? '').toLowerCase(); bv = (b.part_number ?? '').toLowerCase(); }
      else if (sortKey === 'stock_lew') { av = Number(a.lewisville_qty ?? 0); bv = Number(b.lewisville_qty ?? 0); }
      else if (sortKey === 'stock_arg') { av = Number(a.argyle_qty ?? 0); bv = Number(b.argyle_qty ?? 0); }
      else if (sortKey === 'cost') { av = Number(a.unit_cost ?? 0); bv = Number(b.unit_cost ?? 0); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
    return arr;
  }, [materials, sortKey, sortDir]);

  // Local text filter on top of API results
  const displayed = useMemo(() => {
    if (!search) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(m =>
      (m.name ?? '').toLowerCase().includes(q) ||
      (m.part_number ?? '').toLowerCase().includes(q) ||
      (m.category ?? '').toLowerCase().includes(q)
    );
  }, [sorted, search]);

  const belowReorderCount = materials.filter(m => {
    const total = Number(m.total_on_hand ?? 0);
    const rop   = Number(m.reorder_point ?? 0);
    return rop > 0 && total <= rop;
  }).length;

  const oosCount = materials.filter(m => Number(m.total_on_hand ?? 0) === 0).length;

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-indigo-500" />
      : <ChevronDown className="w-3 h-3 text-indigo-500" />;
  }

  // Extract categories from loaded data for filter dropdown
  const categories = useMemo(() =>
    [...new Set(materials.map(m => m.category).filter(Boolean))].sort()
  , [materials]);

  return (
    <>
      <Header
        title="Materials"
        subtitle="Full catalog — stock levels, reorder alerts, and part lookup"
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
              Move Stock
            </button>
            <button
              onClick={() => setShowBarcode(true)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700
                         px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <Barcode className="w-3.5 h-3.5" />
              Lookup
            </button>
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700
                         px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-4">

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Alert strip */}
        {!loading && (oosCount > 0 || belowReorderCount > 0) && (
          <div className="flex items-center gap-3 flex-wrap">
            {oosCount > 0 && (
              <button
                onClick={() => { setBelowReorder(true); setSortKey('stock_lew'); }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                           bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {oosCount} out of stock
              </button>
            )}
            {belowReorderCount > 0 && (
              <button
                onClick={() => setBelowReorder(b => !b)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                           border transition-colors
                           ${belowReorder
                             ? 'bg-amber-100 text-amber-700 border-amber-200'
                             : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-100'}`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                {belowReorderCount} below reorder point
                {belowReorder && ' ✓'}
              </button>
            )}
          </div>
        )}

        {/* Search + filters bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            {/* Search */}
            <div className="flex-1 flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setApiSearch(search); }}
                placeholder="Search name, part #, category… (Enter to filter via API)"
                className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
              />
              {search && (
                <button onClick={() => { setSearch(''); setApiSearch(''); }}>
                  <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors
                ${showFilters || department || category || belowReorder
                  ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                  : 'text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {(department || category || belowReorder) && (
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100 flex-wrap">
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                <option value="">All departments</option>
                <option value="plumbing">Plumbing</option>
                <option value="hvac">HVAC</option>
              </select>

              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                <option value="">All categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={belowReorder}
                  onChange={e => setBelowReorder(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
                Below reorder only
              </label>

              {(department || category || belowReorder) && (
                <button
                  onClick={() => { setDepartment(''); setCategory(''); setBelowReorder(false); }}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <button
                      className="flex items-center gap-1 hover:text-slate-700 transition-colors"
                      onClick={() => toggleSort('name')}
                    >
                      Material <SortIcon col="name" />
                    </button>
                  </th>
                  <th>
                    <button
                      className="flex items-center gap-1 hover:text-slate-700 transition-colors"
                      onClick={() => toggleSort('part')}
                    >
                      Part # <SortIcon col="part" />
                    </button>
                  </th>
                  <th>Category</th>
                  <th>Dept</th>
                  <th className="text-center">
                    <button
                      className="flex items-center gap-1 mx-auto hover:text-slate-700 transition-colors"
                      onClick={() => toggleSort('stock_lew')}
                    >
                      Lewisville <SortIcon col="stock_lew" />
                    </button>
                  </th>
                  <th className="text-center">
                    <button
                      className="flex items-center gap-1 mx-auto hover:text-slate-700 transition-colors"
                      onClick={() => toggleSort('stock_arg')}
                    >
                      Argyle <SortIcon col="stock_arg" />
                    </button>
                  </th>
                  <th>Status</th>
                  <th>
                    <button
                      className="flex items-center gap-1 hover:text-slate-700 transition-colors"
                      onClick={() => toggleSort('cost')}
                    >
                      Unit Cost <SortIcon col="cost" />
                    </button>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={9} />)
                ) : displayed.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        icon={Package}
                        title={search || department || category || belowReorder
                          ? 'No materials match your filters'
                          : 'No materials in catalog'}
                        message={search || department || category || belowReorder
                          ? 'Try clearing filters or adjusting your search.'
                          : 'Materials are synced from ServiceTitan Pricebook.'}
                      />
                    </td>
                  </tr>
                ) : (
                  displayed.map(m => <MaterialRow key={m.id} material={m} />)
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {!loading && displayed.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {displayed.length} of {materials.length} material{materials.length !== 1 ? 's' : ''}
                {belowReorderCount > 0 && (
                  <span className="ml-2 text-amber-500 font-medium">
                    · {belowReorderCount} below reorder
                  </span>
                )}
              </span>
              <span className="text-xs text-slate-400">Auto-refreshes every 60 s</span>
            </div>
          )}
        </div>
      </main>

      {showBarcode && <BarcodeLookup onClose={() => setShowBarcode(false)} />}

      {transferOpen && (
        <TransferModal
          onClose={() => setTransferOpen(false)}
          onDone={() => { setTransferOpen(false); refresh(); }}
        />
      )}
    </>
  );
}
