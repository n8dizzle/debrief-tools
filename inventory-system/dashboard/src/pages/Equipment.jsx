/**
 * Equipment — ServiceTitan mirror (read-only)
 *
 * Equipment records are synced from ServiceTitan every 4 hours.
 * This view is read-only — all edits happen inside ServiceTitan.
 *
 * Filterable by: department, equipment type, warranty status, install year.
 * Searchable by: name, model, serial number, customer name.
 */

import { useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Cpu, Search, RotateCcw, RefreshCw, AlertCircle,
  ChevronRight, X, SlidersHorizontal, ShieldCheck,
  ShieldAlert, ShieldOff, ExternalLink, Clock, Info,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import Header      from '../components/Header.jsx';
import Badge       from '../components/ui/Badge.jsx';
import { SkeletonRow } from '../components/ui/Spinner.jsx';
import EmptyState  from '../components/ui/EmptyState.jsx';
import { useEquipmentList, useSTSyncStatus } from '../hooks/useEquipment.js';
import client      from '../api/client.js';

// ── Warranty status helpers ───────────────────────────────────────────────────
function warrantyStatus(expiresAt) {
  if (!expiresAt) return 'unknown';
  const exp = new Date(expiresAt);
  const now = new Date();
  const daysLeft = Math.floor((exp - now) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0)   return 'expired';
  if (daysLeft < 90)  return 'expiring';
  return 'active';
}

const WARRANTY_META = {
  active:   { label: 'Active',    icon: ShieldCheck,  color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  expiring: { label: 'Expiring',  icon: ShieldAlert,  color: 'text-amber-600 bg-amber-50 border-amber-100' },
  expired:  { label: 'Expired',   icon: ShieldOff,    color: 'text-red-500 bg-red-50 border-red-100' },
  unknown:  { label: 'No Warranty', icon: ShieldOff,  color: 'text-slate-400 bg-slate-50 border-slate-100' },
};

function WarrantyBadge({ expiresAt }) {
  const status = warrantyStatus(expiresAt);
  const { label, icon: Icon, color } = WARRANTY_META[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ── ST Sync banner ────────────────────────────────────────────────────────────
function SyncBanner({ syncs, onSync }) {
  const [syncing, setSyncing] = useState(false);

  const equipSync = syncs.find(s =>
    s.entity_type === 'equipment' || s.sync_type === 'equipment'
  );
  const lastSynced = equipSync?.completed_at ?? equipSync?.synced_at;

  async function handleSync() {
    setSyncing(true);
    try {
      await client.post('/admin/jobs/st-sync', { entity: 'equipment' });
    } catch {
      // ignore — sync runs in background
    }
    // Poll for a few seconds then refresh
    setTimeout(onSync, 5000);
    setSyncing(false);
  }

  return (
    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
      <div className="flex items-center gap-2 text-xs text-indigo-600 flex-1">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span>
          <strong>Read-only mirror</strong> — data synced from ServiceTitan every 4 hours.
          {lastSynced && (
            <span className="ml-1 text-indigo-400">
              Last sync: {formatDistanceToNow(new Date(lastSynced), { addSuffix: true })}
            </span>
          )}
        </span>
      </div>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                   bg-indigo-600 text-white font-medium hover:bg-indigo-700
                   disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing…' : 'Sync Now'}
      </button>
    </div>
  );
}

// ── Equipment row ─────────────────────────────────────────────────────────────
function EquipmentRow({ item }) {
  const navigate = useNavigate();
  const warranty = warrantyStatus(item.warranty_expiry ?? item.warranty_end ?? item.warranty_expires_at);
  const meta     = WARRANTY_META[warranty];
  const WarrantyIcon = meta.icon;

  const installDate = item.installation_date ?? item.install_date;
  const installYear = installDate ? new Date(installDate).getFullYear() : null;

  return (
    <tr
      className="border-b border-slate-50 cursor-pointer hover:bg-indigo-50/40 transition-colors"
      onClick={() => navigate(`/equipment/${item.id}`)}
    >
      {/* Icon + Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-500 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate max-w-[200px]">
              {item.name ?? item.equipment_name ?? 'Unknown Equipment'}
            </p>
            {item.model && (
              <p className="text-[11px] text-slate-400">{item.model}</p>
            )}
          </div>
        </div>
      </td>

      {/* Type */}
      <td className="px-4 py-3 text-sm text-slate-500">{item.equipment_type ?? item.type ?? '—'}</td>

      {/* Serial # */}
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
          {item.serial_number ?? '—'}
        </span>
      </td>

      {/* Department */}
      <td className="px-4 py-3">
        <Badge status={item.department ?? 'default'} dot>
          {item.department ?? '—'}
        </Badge>
      </td>

      {/* Customer */}
      <td className="px-4 py-3">
        <p className="text-sm text-slate-700 truncate max-w-[160px]">
          {item.customer_name ?? '—'}
        </p>
        {item.location_name && (
          <p className="text-[11px] text-slate-400 truncate max-w-[160px]">{item.location_name}</p>
        )}
      </td>

      {/* Install date */}
      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
        {installDate ? (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-300" />
            {format(new Date(installDate), 'MMM d, yyyy')}
          </span>
        ) : '—'}
      </td>

      {/* Warranty */}
      <td className="px-4 py-3">
        <WarrantyBadge expiresAt={item.warranty_expiry ?? item.warranty_end ?? item.warranty_expires_at} />
        {(warranty === 'active' || warranty === 'expiring') && (item.warranty_expiry ?? item.warranty_end ?? item.warranty_expires_at) && (
          <p className={`text-[10px] mt-0.5 ${warranty === 'expiring' ? 'text-amber-500 font-medium' : 'text-slate-400'}`}>
            {warranty === 'expiring' ? '⚠ ' : ''}
            Exp. {format(new Date(item.warranty_expiry ?? item.warranty_end ?? item.warranty_expires_at), 'MMM yyyy')}
          </p>
        )}
      </td>

      {/* ST link */}
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          {item.st_equipment_id && (
            <span className="font-mono text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
              ST#{item.st_equipment_id}
            </span>
          )}
          <button
            onClick={() => navigate(`/equipment/${item.id}`)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg
                       bg-indigo-50 text-indigo-600 hover:bg-indigo-100
                       border border-indigo-200 font-medium transition-colors"
          >
            View
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Equipment() {
  const { collapsed, onToggleSidebar } = useOutletContext();

  const [search,       setSearch]       = useState('');
  const [apiSearch,    setApiSearch]    = useState('');
  const [department,   setDepartment]   = useState('');
  const [equipType,    setEquipType]    = useState('');
  const [warrantyFilt, setWarrantyFilt] = useState('');
  const [showFilters,  setShowFilters]  = useState(false);

  const apiFilters = useMemo(() => ({
    search:     apiSearch    || undefined,
    department: department   || undefined,
    type:       equipType    || undefined,
    warranty:   warrantyFilt || undefined,
  }), [apiSearch, department, equipType, warrantyFilt]);

  const { equipment, loading, error, refresh } = useEquipmentList(apiFilters);
  const { syncs, refresh: refreshSync }        = useSTSyncStatus();

  // Client-side text filter
  const displayed = useMemo(() => {
    if (!search) return equipment;
    const q = search.toLowerCase();
    return equipment.filter(e =>
      (e.name ?? e.equipment_name ?? '').toLowerCase().includes(q) ||
      (e.model ?? '').toLowerCase().includes(q) ||
      (e.serial_number ?? '').toLowerCase().includes(q) ||
      (e.customer_name ?? '').toLowerCase().includes(q) ||
      (e.equipment_type ?? e.type ?? '').toLowerCase().includes(q)
    );
  }, [equipment, search]);

  // Equipment types for filter dropdown
  const equipTypes = useMemo(() =>
    [...new Set(equipment.map(e => e.equipment_type ?? e.type).filter(Boolean))].sort()
  , [equipment]);

  // Warranty alert counts
  const expiringCount = equipment.filter(e => warrantyStatus(e.warranty_expiry ?? e.warranty_end ?? e.warranty_expires_at) === 'expiring').length;
  const expiredCount  = equipment.filter(e => warrantyStatus(e.warranty_expiry ?? e.warranty_end ?? e.warranty_expires_at) === 'expired').length;

  function handleSync() {
    refresh();
    refreshSync();
  }

  const activeFilters = [department, equipType, warrantyFilt].filter(Boolean).length;

  return (
    <>
      <Header
        title="Equipment"
        subtitle="ServiceTitan equipment records — read-only sync every 4 hours"
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

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ST sync banner */}
        <SyncBanner syncs={syncs} onSync={handleSync} />

        {/* Warranty alert strip */}
        {!loading && (expiringCount > 0 || expiredCount > 0) && (
          <div className="flex items-center gap-3 flex-wrap">
            {expiredCount > 0 && (
              <button
                onClick={() => setWarrantyFilt(w => w === 'expired' ? '' : 'expired')}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${warrantyFilt === 'expired'
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'}`}
              >
                <ShieldOff className="w-3.5 h-3.5" />
                {expiredCount} warranty expired
                {warrantyFilt === 'expired' && ' ✓'}
              </button>
            )}
            {expiringCount > 0 && (
              <button
                onClick={() => setWarrantyFilt(w => w === 'expiring' ? '' : 'expiring')}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${warrantyFilt === 'expiring'
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100'}`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                {expiringCount} expiring within 90 days
                {warrantyFilt === 'expiring' && ' ✓'}
              </button>
            )}
          </div>
        )}

        {/* Summary chips */}
        {!loading && equipment.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <span className="text-slate-400">
              <strong className="text-slate-700">{equipment.length}</strong> records synced from ServiceTitan
            </span>
            {equipTypes.slice(0, 5).map(t => (
              <button
                key={t}
                onClick={() => setEquipType(v => v === t ? '' : t)}
                className={`px-2.5 py-1 rounded-lg border font-medium transition-colors
                  ${equipType === t
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Main card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Search + filter bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <div className="flex-1 flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setApiSearch(search); }}
                placeholder="Search name, model, serial #, customer… (Enter for server search)"
                className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
              />
              {search && (
                <button onClick={() => { setSearch(''); setApiSearch(''); }}>
                  <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors
                ${showFilters || activeFilters > 0
                  ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                  : 'text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilters > 0 && (
                <span className="w-4 h-4 bg-indigo-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100 flex-wrap">
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">All departments</option>
                <option value="plumbing">Plumbing</option>
                <option value="hvac">HVAC</option>
              </select>

              <select
                value={equipType}
                onChange={e => setEquipType(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">All types</option>
                {equipTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <select
                value={warrantyFilt}
                onChange={e => setWarrantyFilt(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">All warranty statuses</option>
                <option value="active">Active warranty</option>
                <option value="expiring">Expiring (90 days)</option>
                <option value="expired">Expired</option>
              </select>

              {activeFilters > 0 && (
                <button
                  onClick={() => { setDepartment(''); setEquipType(''); setWarrantyFilt(''); }}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear filters
                </button>
              )}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Type</th>
                  <th>Serial #</th>
                  <th>Dept</th>
                  <th>Customer</th>
                  <th>Installed</th>
                  <th>Warranty</th>
                  <th>ST Ref</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
                ) : displayed.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        icon={Cpu}
                        title={search || activeFilters ? 'No equipment matches your filters' : 'No equipment synced yet'}
                        message={search || activeFilters
                          ? 'Try clearing filters or adjusting your search.'
                          : 'Equipment records sync from ServiceTitan every 4 hours. Use "Sync Now" to pull the latest.'}
                      />
                    </td>
                  </tr>
                ) : (
                  displayed.map(e => <EquipmentRow key={e.id} item={e} />)
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {!loading && displayed.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {displayed.length} of {equipment.length} record{equipment.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                Auto-syncs every 4 h · refreshes every 60 s
              </span>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
