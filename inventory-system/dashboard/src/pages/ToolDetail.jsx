/**
 * Tool Detail — full history and actions for a single tool
 *
 * Sections:
 *  - Header card: name, serial, category, dept, condition, status
 *  - Current assignment card (if checked out)
 *  - Action buttons: Check Out / Check In / Mark Returned from Service
 *  - Checkout history table
 *  - Service log table
 */

import { useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft, Wrench, LogIn, LogOut, Settings, User,
  MapPin, Clock, Calendar, AlertCircle, RotateCcw,
  CheckCircle2, AlertTriangle, Hash, Tag, X,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import Header  from '../components/Header.jsx';
import Badge   from '../components/ui/Badge.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { useToolDetail } from '../hooks/useTools.js';
import client from '../api/client.js';

// ── Condition meta ────────────────────────────────────────────────────────────
const CONDITION_META = {
  excellent:     { label: 'Excellent',     color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  good:          { label: 'Good',          color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  fair:          { label: 'Fair',          color: 'text-blue-600 bg-blue-50 border-blue-200' },
  needs_service: { label: 'Needs Service', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  damaged:       { label: 'Damaged',       color: 'text-red-600 bg-red-50 border-red-200' },
};

function ConditionBadge({ condition }) {
  const meta = CONDITION_META[condition] ?? { label: condition ?? '—', color: 'text-slate-500 bg-slate-50 border-slate-200' };
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.color}`}>
      {meta.label}
    </span>
  );
}

// ── Checkout modal ────────────────────────────────────────────────────────────
function CheckoutModal({ tool, onClose, onDone }) {
  const [form, setForm] = useState({ checked_out_to: '', expected_return_date: '', notes: '' });
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  useState(() => {
    client.get('/users', { params: { active: 'true' } })
      .then(({ data }) => setUsers(data.users ?? []))
      .catch(() => {});
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.checked_out_to.trim()) { setError('Please select or enter a technician'); return; }
    setSaving(true);
    setError(null);
    try {
      await client.post(`/tools/${tool.id}/checkout`, {
        checked_out_to:       form.checked_out_to,
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Technician <span className="text-red-400">*</span></label>
            {users.length > 0 ? (
              <select value={form.checked_out_to}
                onChange={e => setForm(f => ({ ...f, checked_out_to: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                <option value="">— Select technician —</option>
                {users.map(u => <option key={u.id} value={u.name}>{u.name} ({u.role})</option>)}
              </select>
            ) : (
              <input type="text" placeholder="Technician name…" value={form.checked_out_to}
                onChange={e => setForm(f => ({ ...f, checked_out_to: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Expected Return</label>
            <input type="date" value={form.expected_return_date}
              min={new Date().toISOString().slice(0,10)}
              onChange={e => setForm(f => ({ ...f, expected_return_date: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <input type="text" placeholder="Job site, truck, project…" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50 border border-slate-200">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors">
              <LogOut className="w-3.5 h-3.5" />{saving ? 'Checking out…' : 'Check Out'}
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Condition on Return</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CONDITION_META).map(([key, meta]) => (
                <label key={key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-medium transition-all
                    ${form.condition === key ? meta.color + ' border-2' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  <input type="radio" name="condition" value={key} checked={form.condition === key}
                    onChange={() => setForm(f => ({ ...f, condition: key }))} className="sr-only" />
                  {meta.label}
                </label>
              ))}
            </div>
          </div>
          {willService && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2">
              <Settings className="w-3.5 h-3.5 shrink-0" />
              Tool will be auto-routed to <strong className="ml-0.5">Out for Service</strong>.
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <input type="text" placeholder="Damage, observations…" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50 border border-slate-200">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              <LogIn className="w-3.5 h-3.5" />{saving ? 'Checking in…' : 'Check In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Return from service action ────────────────────────────────────────────────
function ReturnFromServiceButton({ toolId, onDone }) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    if (!confirm('Mark this tool as returned from service and available?')) return;
    setLoading(true);
    try {
      await client.post(`/tools/${toolId}/return-from-service`);
      onDone();
    } catch (err) {
      alert(err.response?.data?.error ?? 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handle} disabled={loading}
      className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg
                 bg-emerald-600 text-white font-medium hover:bg-emerald-700
                 disabled:opacity-50 transition-colors">
      <CheckCircle2 className="w-3.5 h-3.5" />
      {loading ? 'Returning…' : 'Return from Service'}
    </button>
  );
}

// ── Checkout history row ──────────────────────────────────────────────────────
function CheckoutRow({ record }) {
  const isOverdue = record.expected_return_date &&
    !record.returned_at &&
    isPast(new Date(record.expected_return_date));

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
      <td className="px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs text-slate-600">
          <User className="w-3 h-3 text-slate-400" />
          {record.checked_out_to ?? '—'}
        </span>
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
        {record.checked_out_at
          ? format(new Date(record.checked_out_at), 'MMM d, yyyy h:mm a')
          : '—'}
      </td>
      <td className="px-4 py-2.5 text-xs whitespace-nowrap">
        {record.returned_at ? (
          <span className="text-emerald-600">{format(new Date(record.returned_at), 'MMM d, yyyy h:mm a')}</span>
        ) : (
          <span className={`flex items-center gap-1 font-medium ${isOverdue ? 'text-red-500' : 'text-amber-500'}`}>
            {isOverdue && <AlertTriangle className="w-3 h-3" />}
            {isOverdue ? 'Overdue' : 'Still out'}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
        {record.expected_return_date
          ? format(new Date(record.expected_return_date), 'MMM d, yyyy')
          : '—'}
      </td>
      <td className="px-4 py-2.5">
        {record.condition_in && <ConditionBadge condition={record.condition_in} />}
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[180px] truncate">
        {record.notes || '—'}
      </td>
    </tr>
  );
}

// ── Service log row ───────────────────────────────────────────────────────────
function ServiceRow({ record }) {
  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
      <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
        {(record.sent_out_at ?? record.sent_at) ? format(new Date(record.sent_out_at ?? record.sent_at), 'MMM d, yyyy') : '—'}
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
        {record.returned_at ? (
          <span className="text-emerald-600">{format(new Date(record.returned_at), 'MMM d, yyyy')}</span>
        ) : (
          <span className="text-blue-500 font-medium flex items-center gap-1">
            <Settings className="w-3 h-3 animate-spin" style={{ animationDuration: '4s' }} />
            In progress
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-500">{record.vendor ?? '—'}</td>
      <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[240px] truncate">
        {record.description ?? record.notes ?? '—'}
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-500">
        {record.cost != null
          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(record.cost)
          : '—'}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ToolDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { collapsed, onToggleSidebar } = useOutletContext();
  const { tool, checkouts, serviceLog, loading, error, refresh } = useToolDetail(id);

  const [showCheckout, setShowCheckout] = useState(false);
  const [showCheckin,  setShowCheckin]  = useState(false);

  if (loading) {
    return (
      <>
        <Header title="Tool" subtitle="Loading…" collapsed={collapsed} onToggleSidebar={onToggleSidebar} />
        <main className="flex-1 flex items-center justify-center">
          <Spinner size="lg" className="text-indigo-400" />
        </main>
      </>
    );
  }

  if (error || !tool) {
    return (
      <>
        <Header title="Tool" subtitle="Error" collapsed={collapsed} onToggleSidebar={onToggleSidebar} />
        <main className="flex-1 px-6 py-6">
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error ?? 'Tool not found'}
          </div>
        </main>
      </>
    );
  }

  const isAvailable   = tool.status === 'available';
  const isCheckedOut  = tool.status === 'checked_out';
  const isInService   = tool.status === 'out_for_service';
  const isRetired     = tool.status === 'retired';

  // Current active checkout record
  const activeCheckout = checkouts.find(c => !c.returned_at);
  const isOverdue = activeCheckout?.expected_return_date &&
    isPast(new Date(activeCheckout.expected_return_date));

  return (
    <>
      <Header
        title={tool.name}
        subtitle={[tool.serial_number && `S/N: ${tool.serial_number}`, tool.category].filter(Boolean).join(' · ')}
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
            {isAvailable   && <button onClick={() => setShowCheckout(true)}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors">
              <LogOut className="w-3.5 h-3.5" />Check Out
            </button>}
            {isCheckedOut  && <button onClick={() => setShowCheckin(true)}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors">
              <LogIn className="w-3.5 h-3.5" />Check In
            </button>}
            {isInService   && <ReturnFromServiceButton toolId={tool.id} onDone={refresh} />}
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

        {/* Back */}
        <button onClick={() => navigate('/tools')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          All Tools
        </button>

        {/* Header card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center
                ${isAvailable ? 'bg-emerald-100 text-emerald-600'
                  : isCheckedOut ? 'bg-amber-100 text-amber-600'
                  : isInService ? 'bg-blue-100 text-blue-600'
                  : 'bg-slate-100 text-slate-400'}`}>
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">{tool.name}</h2>
                {tool.description && (
                  <p className="text-sm text-slate-500 mt-0.5">{tool.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge status={tool.status} dot>{tool.status?.replace(/_/g, ' ')}</Badge>
              <ConditionBadge condition={tool.condition} />
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
            {[
              { label: 'Serial Number', val: tool.serial_number ?? '—', icon: Hash, mono: true },
              { label: 'Category',      val: tool.category      ?? '—', icon: Tag },
              { label: 'Department',    val: tool.department     ?? '—', icon: Tag },
              { label: 'Location',      val: tool.current_location ?? tool.warehouse_name ?? '—', icon: MapPin },
            ].map(({ label, val, icon: Icon, mono }) => (
              <div key={label}>
                <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                  <Icon className="w-3 h-3" />{label}
                </p>
                <p className={`text-sm text-slate-700 mt-0.5 ${mono ? 'font-mono text-xs' : ''}`}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Active checkout card */}
        {isCheckedOut && activeCheckout && (
          <div className={`rounded-xl border px-5 py-4 space-y-3
            ${isOverdue ? 'border-red-200 bg-red-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-semibold flex items-center gap-2
                ${isOverdue ? 'text-red-700' : 'text-amber-700'}`}>
                <LogOut className="w-4 h-4" />
                Currently Checked Out
                {isOverdue && (
                  <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                    OVERDUE
                  </span>
                )}
              </h3>
              <button onClick={() => setShowCheckin(true)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg
                           bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors">
                <LogIn className="w-3 h-3" />Check In
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Technician',       val: activeCheckout.checked_out_to ?? '—',    icon: User },
                { label: 'Checked Out',      val: activeCheckout.checked_out_at
                    ? formatDistanceToNow(new Date(activeCheckout.checked_out_at), { addSuffix: true })
                    : '—', icon: Clock },
                { label: 'Expected Return',  val: activeCheckout.expected_return_date
                    ? format(new Date(activeCheckout.expected_return_date), 'MMM d, yyyy')
                    : 'No date set', icon: Calendar },
              ].map(({ label, val, icon: Icon }) => (
                <div key={label}>
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Icon className="w-3 h-3" />{label}
                  </p>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5">{val}</p>
                </div>
              ))}
            </div>
            {activeCheckout.notes && (
              <p className="text-xs text-slate-500 pt-1 border-t border-amber-100">
                {activeCheckout.notes}
              </p>
            )}
          </div>
        )}

        {/* In service card */}
        {isInService && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-blue-500 animate-spin" style={{ animationDuration: '4s' }} />
              <div>
                <p className="text-sm font-semibold text-blue-800">Out for Service</p>
                {(serviceLog[0]?.sent_out_at ?? serviceLog[0]?.sent_at) && (
                  <p className="text-xs text-blue-600 mt-0.5">
                    Since {format(new Date(serviceLog[0].sent_out_at ?? serviceLog[0].sent_at), 'MMM d, yyyy')}
                    {serviceLog[0].vendor && ` · ${serviceLog[0].vendor}`}
                  </p>
                )}
              </div>
            </div>
            <ReturnFromServiceButton toolId={tool.id} onDone={refresh} />
          </div>
        )}

        {/* Checkout history */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Checkout History
              <span className="text-xs font-normal text-slate-400">({checkouts.length})</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Technician</th>
                  <th>Checked Out</th>
                  <th>Returned</th>
                  <th>Expected Return</th>
                  <th>Condition</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {checkouts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                      No checkout history yet.
                    </td>
                  </tr>
                ) : (
                  checkouts.map((c, i) => <CheckoutRow key={c.id ?? i} record={c} />)
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Service log */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" />
              Service Log
              <span className="text-xs font-normal text-slate-400">({serviceLog.length})</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sent</th>
                  <th>Returned</th>
                  <th>Vendor</th>
                  <th>Description</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {serviceLog.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                      No service history for this tool.
                    </td>
                  </tr>
                ) : (
                  serviceLog.map((s, i) => <ServiceRow key={s.id ?? i} record={s} />)
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {showCheckout && (
        <CheckoutModal tool={tool} onClose={() => setShowCheckout(false)} onDone={refresh} />
      )}
      {showCheckin && (
        <CheckinModal tool={tool} onClose={() => setShowCheckin(false)} onDone={refresh} />
      )}
    </>
  );
}
