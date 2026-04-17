/**
 * Tools — list page
 *
 * Field tool tracking: checkout, checkin, service status.
 * Tool lifecycle: available → checked_out → out_for_service → retired
 *
 * checkin() auto-routes to out_for_service when condition = needs_service | damaged.
 */

import { useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Wrench, Search, RotateCcw, AlertTriangle, ChevronRight,
  LogIn, LogOut, Settings, X, CheckCircle2, Clock,
  User, MapPin, AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Header      from '../components/Header.jsx';
import Badge       from '../components/ui/Badge.jsx';
import { SkeletonRow } from '../components/ui/Spinner.jsx';
import EmptyState  from '../components/ui/EmptyState.jsx';
import { useToolList } from '../hooks/useTools.js';
import client      from '../api/client.js';

// ── Status tabs ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'all',             label: 'All',         color: 'text-slate-600' },
  { key: 'available',       label: 'Available',   color: 'text-emerald-600' },
  { key: 'checked_out',     label: 'Checked Out', color: 'text-amber-600' },
  { key: 'out_for_service', label: 'In Service',  color: 'text-blue-600' },
  { key: 'retired',         label: 'Retired',     color: 'text-slate-400' },
];

// ── Condition badge colors ────────────────────────────────────────────────────
const CONDITION_META = {
  excellent:     { label: 'Excellent',     color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  good:          { label: 'Good',          color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  fair:          { label: 'Fair',          color: 'text-blue-600 bg-blue-50 border-blue-100' },
  needs_service: { label: 'Needs Service', color: 'text-amber-600 bg-amber-50 border-amber-100' },
  damaged:       { label: 'Damaged',       color: 'text-red-600 bg-red-50 border-red-100' },
};

function ConditionPill({ condition }) {
  const meta = CONDITION_META[condition] ?? { label: condition ?? '—', color: 'text-slate-500 bg-slate-50 border-slate-100' };
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
      {meta.label}
    </span>
  );
}

// ── Checkout modal ────────────────────────────────────────────────────────────
function CheckoutModal({ tool, onClose, onDone }) {
  const [form, setForm] = useState({ tech_id: '', expected_return_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await client.post(`/tools/${tool.id}/checkout`, {
        tech_id:              form.tech_id || undefined,
        expected_return_date: form.expected_return_date || undefined,
        notes:                form.notes || undefined,
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Checkout failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <LogOut className="w-4 h-4 text-amber-500" />
            Check Out — {tool.name}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Technician ID</label>
            <input
              type="text"
              placeholder="UUID of technician…"
              value={form.tech_id}
              onChange={e => setForm(f => ({ ...f, tech_id: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Expected Return</label>
            <input
              type="date"
              value={form.expected_return_date}
              onChange={e => setForm(f => ({ ...f, expected_return_date: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <input
              type="text"
              placeholder="Job site, project…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50 border border-slate-200">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg
                         bg-amber-500 text-white font-medium hover:bg-amber-600
                         disabled:opacity-50 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
              {saving ? 'Checking out…' : 'Check Out'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Checkin modal ─────────────────────────────────────────────────────────────
function CheckinModal({ tool, onClose, onDone }) {
  const [form, setForm] = useState({ condition: 'good', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const willService = ['needs_service', 'damaged'].includes(form.condition);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await client.post(`/tools/${tool.id}/checkin`, {
        condition: form.condition,
        notes:     form.notes || undefined,
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Checkin failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <LogIn className="w-4 h-4 text-emerald-500" />
            Check In — {tool.name}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Condition on Return</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CONDITION_META).map(([key, meta]) => (
                <label key={key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-medium transition-all
                    ${form.condition === key ? meta.color + ' border-2' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  <input
                    type="radio"
                    name="condition"
                    value={key}
                    checked={form.condition === key}
                    onChange={() => setForm(f => ({ ...f, condition: key }))}
                    className="sr-only"
                  />
                  {meta.label}
                </label>
              ))}
            </div>
          </div>
          {willService && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2">
              <Settings className="w-3.5 h-3.5 shrink-0" />
              This tool will be automatically routed to <strong>Out for Service</strong>.
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <input
              type="text"
              placeholder="Any damage, issues observed…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50 border border-slate-200">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg
                         bg-emerald-600 text-white font-medium hover:bg-emerald-700
                         disabled:opacity-50 transition-colors">
              <LogIn className="w-3.5 h-3.5" />
              {saving ? 'Checking in…' : 'Check In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tool row ──────────────────────────────────────────────────────────────────
function ToolRow({ tool, onRefresh }) {
  const navigate = useNavigate();
  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [checkinTarget,  setCheckinTarget]  = useState(null);

  const isAvailable   = tool.status === 'available';
  const isCheckedOut  = tool.status === 'checked_out';
  const isInService   = tool.status === 'out_for_service';
  const isRetired     = tool.status === 'retired';

  const needsAttention = tool.condition === 'needs_service' || tool.condition === 'damaged';

  return (
    <>
      <tr
        className={`border-b border-slate-50 cursor-pointer transition-colors hover:bg-indigo-50/40
          ${needsAttention && !isInService ? 'bg-amber-50/30' : ''}`}
        onClick={() => navigate(`/tools/${tool.id}`)}
      >
        {/* Icon + Name */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
              ${isAvailable ? 'bg-emerald-100 text-emerald-600'
                : isCheckedOut ? 'bg-amber-100 text-amber-600'
                : isInService ? 'bg-blue-100 text-blue-600'
                : 'bg-slate-100 text-slate-400'}`}>
              <Wrench className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate max-w-[200px]">{tool.name}</p>
              {tool.serial_number && (
                <p className="text-[11px] text-slate-400 font-mono">{tool.serial_number}</p>
              )}
            </div>
          </div>
        </td>

        {/* Category */}
        <td className="px-4 py-3 text-sm text-slate-500">{tool.category ?? '—'}</td>

        {/* Department */}
        <td className="px-4 py-3">
          <Badge status={tool.department ?? 'default'} dot>{tool.department ?? '—'}</Badge>
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <Badge status={tool.status} dot>
            {tool.status?.replace(/_/g, ' ') ?? '—'}
          </Badge>
        </td>

        {/* Condition */}
        <td className="px-4 py-3">
          <ConditionPill condition={tool.condition} />
        </td>

        {/* Assigned to */}
        <td className="px-4 py-3">
          {(tool.checked_out_to ?? tool.assigned_to_name) ? (
            <span className="flex items-center gap-1.5 text-xs text-slate-600">
              <User className="w-3 h-3 text-slate-400" />
              {tool.checked_out_to ?? tool.assigned_to_name}
            </span>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </td>

        {/* Location */}
        <td className="px-4 py-3">
          {(tool.current_location ?? tool.warehouse_name) ? (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="w-3 h-3 text-slate-400" />
              {tool.current_location ?? tool.warehouse_name}
            </span>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </td>

        {/* Last activity */}
        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
          {tool.last_checkout_at ? (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(tool.last_checkout_at), { addSuffix: true })}
            </span>
          ) : '—'}
        </td>

        {/* Actions */}
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            {isAvailable && (
              <button
                onClick={() => setCheckoutTarget(tool)}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg
                           bg-amber-50 text-amber-700 border border-amber-200
                           hover:bg-amber-100 font-medium transition-colors"
              >
                <LogOut className="w-3 h-3" />
                Check Out
              </button>
            )}
            {isCheckedOut && (
              <button
                onClick={() => setCheckinTarget(tool)}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg
                           bg-emerald-50 text-emerald-700 border border-emerald-200
                           hover:bg-emerald-100 font-medium transition-colors"
              >
                <LogIn className="w-3 h-3" />
                Check In
              </button>
            )}
            {isInService && (
              <span className="flex items-center gap-1 text-xs text-blue-500 font-medium">
                <Settings className="w-3 h-3 animate-spin" style={{ animationDuration: '4s' }} />
                In Service
              </span>
            )}
            <button
              onClick={() => navigate(`/tools/${tool.id}`)}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg
                         bg-indigo-50 text-indigo-600 hover:bg-indigo-100
                         border border-indigo-200 transition-colors"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </td>
      </tr>

      {checkoutTarget && (
        <CheckoutModal
          tool={checkoutTarget}
          onClose={() => setCheckoutTarget(null)}
          onDone={onRefresh}
        />
      )}
      {checkinTarget && (
        <CheckinModal
          tool={checkinTarget}
          onClose={() => setCheckinTarget(null)}
          onDone={onRefresh}
        />
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Tools() {
  const { collapsed, onToggleSidebar } = useOutletContext();
  const [activeTab,  setActiveTab]  = useState('all');
  const [search,     setSearch]     = useState('');
  const [department, setDepartment] = useState('');

  const filters = useMemo(() => ({
    status:     activeTab !== 'all' ? activeTab : undefined,
    department: department || undefined,
  }), [activeTab, department]);

  const { tools, loading, error, refresh } = useToolList(filters);

  // Client-side search
  const displayed = useMemo(() => {
    if (!search) return tools;
    const q = search.toLowerCase();
    return tools.filter(t =>
      (t.name ?? '').toLowerCase().includes(q) ||
      (t.serial_number ?? '').toLowerCase().includes(q) ||
      (t.category ?? '').toLowerCase().includes(q)
    );
  }, [tools, search]);

  // Alert counts
  const needsServiceCount = tools.filter(t =>
    ['needs_service', 'damaged'].includes(t.condition) && t.status !== 'out_for_service'
  ).length;
  const overdueCount = tools.filter(t => {
    if (t.status !== 'checked_out' || !t.expected_return_date) return false;
    return new Date(t.expected_return_date) < new Date();
  }).length;

  // Tab counts (computed from current fetch — reflects status filter)
  function tabCount(key) {
    if (activeTab !== 'all' && key !== activeTab && key !== 'all') return '…';
    return key === 'all' ? tools.length : tools.filter(t => t.status === key).length;
  }

  return (
    <>
      <Header
        title="Tools"
        subtitle="Field tool tracking — checkout, checkin, service history"
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
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Alert strip */}
        {!loading && (needsServiceCount > 0 || overdueCount > 0) && (
          <div className="flex items-center gap-3 flex-wrap">
            {needsServiceCount > 0 && (
              <button
                onClick={() => setActiveTab('checked_out')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                           bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {needsServiceCount} tool{needsServiceCount !== 1 ? 's' : ''} need service
              </button>
            )}
            {overdueCount > 0 && (
              <button
                onClick={() => setActiveTab('checked_out')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                           bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                {overdueCount} overdue return{overdueCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Tab bar + search + dept filter */}
          <div className="flex items-center justify-between border-b border-slate-100 px-2 pt-2 gap-3 flex-wrap">
            {/* Tabs */}
            <div className="flex items-center overflow-x-auto">
              {TABS.map(tab => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap
                      border-b-2 transition-colors -mb-px
                      ${isActive
                        ? `border-indigo-500 ${tab.color}`
                        : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
                      }`}
                  >
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

            {/* Search + dept */}
            <div className="flex items-center gap-2 pb-2 pr-2">
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search tools…"
                  className="bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none w-36"
                />
                {search && (
                  <button onClick={() => setSearch('')}>
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                <option value="">All depts</option>
                <option value="plumbing">Plumbing</option>
                <option value="hvac">HVAC</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Category</th>
                  <th>Dept</th>
                  <th>Status</th>
                  <th>Condition</th>
                  <th>Assigned To</th>
                  <th>Location</th>
                  <th>Last Activity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={9} />)
                ) : displayed.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        icon={Wrench}
                        title={search ? 'No tools match your search' : `No ${activeTab === 'all' ? '' : activeTab.replace(/_/g, ' ')} tools`}
                        message={search
                          ? 'Try a different name or serial number.'
                          : activeTab === 'available'
                          ? 'All tools are currently checked out or in service.'
                          : 'Switch tabs to view tools in other states.'}
                      />
                    </td>
                  </tr>
                ) : (
                  displayed.map(t => <ToolRow key={t.id} tool={t} onRefresh={refresh} />)
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {!loading && displayed.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {displayed.length} tool{displayed.length !== 1 ? 's' : ''} · auto-refreshes every 30 s
              </span>
              <div className="flex items-center gap-3 text-xs">
                {tools.filter(t => t.status === 'available').length > 0 && (
                  <span className="text-emerald-500 font-medium">
                    {tools.filter(t => t.status === 'available').length} available
                  </span>
                )}
                {tools.filter(t => t.status === 'checked_out').length > 0 && (
                  <span className="text-amber-500 font-medium">
                    {tools.filter(t => t.status === 'checked_out').length} checked out
                  </span>
                )}
                {tools.filter(t => t.status === 'out_for_service').length > 0 && (
                  <span className="text-blue-500 font-medium">
                    {tools.filter(t => t.status === 'out_for_service').length} in service
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
