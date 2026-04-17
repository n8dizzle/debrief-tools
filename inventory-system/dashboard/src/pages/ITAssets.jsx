/**
 * IT Assets — list page
 *
 * iPads, iPhones, laptops, hotspots — assignment and MDM tracking.
 *
 * Device lifecycle: in_storage → active → in_repair → decommissioned
 *                                       → lost | stolen
 */

import { useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Tablet, Smartphone, Laptop, Wifi, Monitor, HelpCircle,
  Plus, RotateCcw, AlertCircle, ChevronRight, Search,
  X, UserCheck, UserX, AlertTriangle, CheckCircle2,
  Package, SlidersHorizontal,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Header      from '../components/Header.jsx';
import Badge       from '../components/ui/Badge.jsx';
import { SkeletonRow } from '../components/ui/Spinner.jsx';
import EmptyState  from '../components/ui/EmptyState.jsx';
import { useITAssetList } from '../hooks/useITAssets.js';
import client      from '../api/client.js';

// ── Device type config ────────────────────────────────────────────────────────
const DEVICE_TYPES = {
  ipad:    { label: 'iPad',    Icon: Tablet,      color: 'bg-blue-100 text-blue-600' },
  iphone:  { label: 'iPhone',  Icon: Smartphone,  color: 'bg-slate-100 text-slate-600' },
  laptop:  { label: 'Laptop',  Icon: Laptop,      color: 'bg-indigo-100 text-indigo-600' },
  hotspot: { label: 'Hotspot', Icon: Wifi,        color: 'bg-emerald-100 text-emerald-600' },
  desktop: { label: 'Desktop', Icon: Monitor,     color: 'bg-purple-100 text-purple-600' },
  other:   { label: 'Other',   Icon: HelpCircle,  color: 'bg-slate-100 text-slate-400' },
};

function deviceMeta(type) {
  const key = (type ?? '').toLowerCase();
  return DEVICE_TYPES[key] ?? DEVICE_TYPES.other;
}

// ── Status tabs ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'all',            label: 'All',          color: 'text-slate-600' },
  { key: 'active',         label: 'Active',       color: 'text-emerald-600' },
  { key: 'in_storage',     label: 'In Storage',   color: 'text-blue-600' },
  { key: 'in_repair',      label: 'In Repair',    color: 'text-amber-600' },
  { key: 'lost',           label: 'Lost',         color: 'text-red-500' },
  { key: 'stolen',         label: 'Stolen',       color: 'text-red-600' },
  { key: 'decommissioned', label: 'Decommissioned', color: 'text-slate-400' },
];

// ── Create asset modal ────────────────────────────────────────────────────────
function CreateAssetModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    device_type:   'ipad',
    asset_tag:     '',
    serial_number: '',
    make:          '',
    model:         '',
    imei:          '',
    phone_number:  '',
    carrier:       '',
    mdm_enrolled:  false,
    mdm_device_id: '',
    department:    '',
    notes:         '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach(k => {
        if (payload[k] === '' || payload[k] == null) delete payload[k];
      });
      payload.device_type  = form.device_type;
      payload.mdm_enrolled = form.mdm_enrolled;
      const { data } = await client.post('/it-assets', payload);
      onCreated(data.it_asset ?? data.asset ?? data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to create asset');
    } finally {
      setSaving(false);
    }
  }

  const selectedMeta = deviceMeta(form.device_type);
  const DevIcon = selectedMeta.Icon;
  const isMobile = ['ipad', 'iphone', 'hotspot'].includes(form.device_type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <DevIcon className="w-4 h-4 text-indigo-500" />
              Add IT Asset
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">New device added to inventory and MDM tracking.</p>
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

          {/* Device type picker */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Device Type</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(DEVICE_TYPES).map(([key, meta]) => {
                const Icon = meta.Icon;
                return (
                  <label key={key}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all
                      ${form.device_type === key
                        ? `${meta.color} border-current shadow-sm`
                        : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                    <input type="radio" name="device_type" value={key}
                      checked={form.device_type === key}
                      onChange={() => setForm(f => ({ ...f, device_type: key }))}
                      className="sr-only" />
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-semibold">{meta.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Core identity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Asset Tag <span className="text-red-400">*</span>
              </label>
              <input required type="text" placeholder="e.g. IT-042"
                value={form.asset_tag}
                onChange={e => setForm(f => ({ ...f, asset_tag: e.target.value.toUpperCase() }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono font-bold" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Serial Number</label>
              <input type="text" placeholder="Device serial…"
                value={form.serial_number}
                onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Make</label>
              <input type="text" placeholder="Apple, Dell…"
                value={form.make}
                onChange={e => setForm(f => ({ ...f, make: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Model</label>
              <input type="text" placeholder="iPad Pro 12.9…"
                value={form.model}
                onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>

          {/* Mobile-specific fields */}
          {isMobile && (
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-500">Mobile Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">IMEI</label>
                  <input type="text" placeholder="15-digit IMEI"
                    value={form.imei}
                    onChange={e => setForm(f => ({ ...f, imei: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono text-xs" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Phone Number</label>
                  <input type="text" placeholder="(555) 000-0000"
                    value={form.phone_number}
                    onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Carrier</label>
                <select value={form.carrier}
                  onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                  <option value="">Select carrier…</option>
                  {['AT&T', 'Verizon', 'T-Mobile', 'Sprint', 'Other'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* MDM */}
          <div className="border-t border-slate-100 pt-3 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.mdm_enrolled}
                onChange={e => setForm(f => ({ ...f, mdm_enrolled: e.target.checked }))}
                className="w-4 h-4 accent-indigo-600 rounded" />
              <span className="text-sm text-slate-700 font-medium">Enrolled in MDM</span>
            </label>
            {form.mdm_enrolled && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">MDM Device ID</label>
                <input type="text" placeholder="MDM enrollment identifier…"
                  value={form.mdm_device_id}
                  onChange={e => setForm(f => ({ ...f, mdm_device_id: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono text-xs" />
              </div>
            )}
          </div>

          {/* Dept + notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
              <select value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                <option value="">Select…</option>
                <option value="plumbing">Plumbing</option>
                <option value="hvac">HVAC</option>
                <option value="admin">Admin / Office</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <input type="text" placeholder="Any notes…"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50 border border-slate-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 text-sm px-5 py-2 rounded-lg
                         bg-indigo-600 text-white font-medium hover:bg-indigo-700
                         disabled:opacity-50 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              {saving ? 'Creating…' : 'Add Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Asset row ─────────────────────────────────────────────────────────────────
function AssetRow({ asset }) {
  const navigate = useNavigate();
  const meta  = deviceMeta(asset.device_type);
  const Icon  = meta.Icon;

  const isActive  = asset.status === 'active';
  const isLost    = asset.status === 'lost' || asset.status === 'stolen';
  const isStorage = asset.status === 'in_storage';

  return (
    <tr
      className={`border-b border-slate-50 cursor-pointer hover:bg-indigo-50/40 transition-colors
        ${isLost ? 'bg-red-50/20' : ''}`}
      onClick={() => navigate(`/it-assets/${asset.id}`)}
    >
      {/* Device icon + name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate max-w-[180px]">
              {asset.make ? `${asset.make} ` : ''}{asset.model ?? meta.label}
            </p>
            <p className="text-[11px] font-mono text-slate-400">{asset.asset_tag ?? '—'}</p>
          </div>
        </div>
      </td>

      {/* Type */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>
          <Icon className="w-3 h-3" />
          {meta.label}
        </span>
      </td>

      {/* Serial */}
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
          {asset.serial_number ?? '—'}
        </span>
      </td>

      {/* Department */}
      <td className="px-4 py-3">
        <Badge status={asset.department ?? 'default'} dot>
          {asset.department ?? '—'}
        </Badge>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge status={asset.status ?? 'default'} dot>
          {(asset.status ?? '—').replace(/_/g, ' ')}
        </Badge>
      </td>

      {/* Assigned to */}
      <td className="px-4 py-3">
        {(asset.assigned_to ?? asset.assigned_to_name) ? (
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <UserCheck className="w-3 h-3 text-emerald-500" />
            {asset.assigned_to ?? asset.assigned_to_name}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <UserX className="w-3 h-3" />
            Unassigned
          </span>
        )}
      </td>

      {/* MDM */}
      <td className="px-4 py-3">
        {asset.mdm_enrolled ? (
          <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Enrolled
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>

      {/* Phone # */}
      <td className="px-4 py-3 text-xs font-mono text-slate-500">
        {asset.phone_number ?? '—'}
      </td>

      {/* Last activity */}
      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
        {asset.last_assigned_at
          ? formatDistanceToNow(new Date(asset.last_assigned_at), { addSuffix: true })
          : '—'}
      </td>

      {/* Action */}
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => navigate(`/it-assets/${asset.id}`)}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg
                     bg-indigo-50 text-indigo-600 hover:bg-indigo-100
                     border border-indigo-200 font-medium transition-colors"
        >
          View
          <ChevronRight className="w-3 h-3" />
        </button>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ITAssets() {
  const { collapsed, onToggleSidebar } = useOutletContext();
  const [activeTab,   setActiveTab]   = useState('all');
  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState('');
  const [deptFilter,  setDeptFilter]  = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate,  setShowCreate]  = useState(false);

  const filters = useMemo(() => ({
    status:      activeTab !== 'all' ? activeTab : undefined,
    device_type: typeFilter || undefined,
    department:  deptFilter || undefined,
  }), [activeTab, typeFilter, deptFilter]);

  const { assets, loading, error, refresh } = useITAssetList(filters);

  // Client-side search
  const displayed = useMemo(() => {
    if (!search) return assets;
    const q = search.toLowerCase();
    return assets.filter(a =>
      (a.make ?? '').toLowerCase().includes(q) ||
      (a.model ?? '').toLowerCase().includes(q) ||
      (a.asset_tag ?? '').toLowerCase().includes(q) ||
      (a.serial_number ?? '').toLowerCase().includes(q) ||
      (a.assigned_to ?? a.assigned_to_name ?? '').toLowerCase().includes(q) ||
      (a.phone_number ?? '').toLowerCase().includes(q) ||
      (a.imei ?? '').toLowerCase().includes(q)
    );
  }, [assets, search]);

  // Alert counts
  const unassignedActive = assets.filter(a => a.status === 'active' && !a.assigned_to && !a.assigned_to_name).length;
  const lostCount        = assets.filter(a => a.status === 'lost' || a.status === 'stolen').length;
  const noMDMActive      = assets.filter(a => a.status === 'active' && !a.mdm_enrolled).length;

  // Tab counts
  function tabCount(key) {
    if (activeTab !== 'all' && key !== activeTab && key !== 'all') return '…';
    return key === 'all' ? assets.length : assets.filter(a => a.status === key).length;
  }

  // Device type breakdown for chips
  const typeBreakdown = useMemo(() => {
    const map = {};
    assets.forEach(a => {
      const t = (a.device_type ?? 'other').toLowerCase();
      map[t] = (map[t] ?? 0) + 1;
    });
    return map;
  }, [assets]);

  return (
    <>
      <Header
        title="IT Assets"
        subtitle="iPads, iPhones, laptops, hotspots — assignment and MDM tracking"
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
              Add Asset
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

        {/* Alert strip */}
        {!loading && (lostCount > 0 || unassignedActive > 0 || noMDMActive > 0) && (
          <div className="flex items-center gap-3 flex-wrap">
            {lostCount > 0 && (
              <button onClick={() => setActiveTab(a => a === 'lost' ? 'all' : 'lost')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                           bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                {lostCount} lost/stolen
              </button>
            )}
            {unassignedActive > 0 && (
              <button onClick={() => setActiveTab('active')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                           bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100 transition-colors">
                <UserX className="w-3.5 h-3.5" />
                {unassignedActive} active but unassigned
              </button>
            )}
            {noMDMActive > 0 && (
              <button onClick={() => setActiveTab('active')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                           bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 transition-colors">
                <AlertCircle className="w-3.5 h-3.5" />
                {noMDMActive} active without MDM
              </button>
            )}
          </div>
        )}

        {/* Device type chips */}
        {!loading && assets.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(DEVICE_TYPES).map(([key, meta]) => {
              if (!typeBreakdown[key]) return null;
              const Icon = meta.Icon;
              return (
                <button key={key}
                  onClick={() => setTypeFilter(t => t === key ? '' : key)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors
                    ${typeFilter === key
                      ? `${meta.color} border-current`
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {meta.label} ({typeBreakdown[key]})
                </button>
              );
            })}
            {typeFilter && (
              <button onClick={() => setTypeFilter('')}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-0.5">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Tab bar + controls */}
          <div className="flex items-center justify-between border-b border-slate-100 flex-wrap gap-2 px-2 pt-2">
            {/* Tabs */}
            <div className="flex items-center overflow-x-auto">
              {TABS.map(tab => {
                const isActive = activeTab === tab.key;
                return (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap
                      border-b-2 transition-colors -mb-px
                      ${isActive
                        ? `border-indigo-500 ${tab.color}`
                        : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'}`}>
                    {tab.label}
                    {!loading && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold
                        ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        {tabCount(tab.key)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search + filter */}
            <div className="flex items-center gap-2 pb-2 pr-2">
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search assets…"
                  className="bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none w-36" />
                {search && <button onClick={() => setSearch('')}><X className="w-3 h-3 text-slate-400" /></button>}
              </div>
              <button onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${showFilters || deptFilter
                    ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                    : 'text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {deptFilter ? '1 filter' : 'Filter'}
              </button>
            </div>
          </div>

          {/* Dept filter row */}
          {showFilters && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="">All departments</option>
                <option value="plumbing">Plumbing</option>
                <option value="hvac">HVAC</option>
                <option value="admin">Admin / Office</option>
              </select>
              {deptFilter && (
                <button onClick={() => setDeptFilter('')}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
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
                  <th>Device</th>
                  <th>Type</th>
                  <th>Serial #</th>
                  <th>Dept</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>MDM</th>
                  <th>Phone #</th>
                  <th>Last Activity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 7 }).map((_, i) => <SkeletonRow key={i} cols={10} />)
                ) : displayed.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <EmptyState
                        icon={Tablet}
                        title={search || typeFilter || deptFilter ? 'No assets match your filters' : `No ${activeTab === 'all' ? '' : activeTab.replace(/_/g, ' ')} assets`}
                        message={search ? 'Try a different search term.' : 'Add your first device using the button above.'}
                      />
                    </td>
                  </tr>
                ) : (
                  displayed.map(a => <AssetRow key={a.id} asset={a} />)
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {!loading && displayed.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {displayed.length} of {assets.length} asset{assets.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-3 text-xs">
                {assets.filter(a => a.status === 'active').length > 0 && (
                  <span className="text-emerald-500 font-medium">
                    {assets.filter(a => a.status === 'active').length} active
                  </span>
                )}
                {assets.filter(a => a.mdm_enrolled).length > 0 && (
                  <span className="text-indigo-500 font-medium">
                    {assets.filter(a => a.mdm_enrolled).length} MDM enrolled
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <CreateAssetModal
          onClose={() => setShowCreate(false)}
          onCreated={() => refresh()}
        />
      )}
    </>
  );
}
