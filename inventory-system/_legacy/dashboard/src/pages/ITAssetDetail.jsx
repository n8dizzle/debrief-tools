/**
 * IT Asset Detail — full record for one device
 *
 * Sections:
 *  - Header: device type icon, make/model, asset tag, status
 *  - Current assignment card (if active)
 *  - Device specs: serial, IMEI, MDM, carrier, phone #
 *  - Actions: Assign, Unassign, status change (repair, lost, decommission)
 *  - Assignment history table
 */

import { useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft, Tablet, Smartphone, Laptop, Wifi, Monitor, HelpCircle,
  RotateCcw, AlertCircle, UserCheck, UserX, X, User,
  Hash, Shield, Phone, Cpu, CheckCircle2, Clock, Settings,
  AlertTriangle, Calendar,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Header  from '../components/Header.jsx';
import Badge   from '../components/ui/Badge.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { useITAssetDetail } from '../hooks/useITAssets.js';
import client from '../api/client.js';

// ── Device meta ───────────────────────────────────────────────────────────────
const DEVICE_TYPES = {
  ipad:    { label: 'iPad',    Icon: Tablet,     color: 'bg-blue-100 text-blue-600' },
  iphone:  { label: 'iPhone',  Icon: Smartphone, color: 'bg-slate-100 text-slate-600' },
  laptop:  { label: 'Laptop',  Icon: Laptop,     color: 'bg-indigo-100 text-indigo-600' },
  hotspot: { label: 'Hotspot', Icon: Wifi,       color: 'bg-emerald-100 text-emerald-600' },
  desktop: { label: 'Desktop', Icon: Monitor,    color: 'bg-purple-100 text-purple-600' },
  other:   { label: 'Other',   Icon: HelpCircle, color: 'bg-slate-100 text-slate-400' },
};

function deviceMeta(type) {
  return DEVICE_TYPES[(type ?? '').toLowerCase()] ?? DEVICE_TYPES.other;
}

// ── Status change options ─────────────────────────────────────────────────────
const STATUS_ACTIONS = [
  { status: 'active',         label: 'Mark Active',        color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  { status: 'in_storage',     label: 'Move to Storage',    color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { status: 'in_repair',      label: 'Send to Repair',     color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  { status: 'lost',           label: 'Mark as Lost',       color: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' },
  { status: 'stolen',         label: 'Mark as Stolen',     color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
  { status: 'decommissioned', label: 'Decommission',       color: 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100' },
];

// ── Assign modal ──────────────────────────────────────────────────────────────
function AssignModal({ asset, onClose, onDone }) {
  const [form, setForm] = useState({ assigned_to: '', notes: '' });
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  // Load users list for dropdown
  useState(() => {
    client.get('/users', { params: { active: 'true' } })
      .then(({ data }) => setUsers(data.users ?? []))
      .catch(() => {/* silently ignore */});
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.assigned_to.trim()) { setError('Please select or enter a technician'); return; }
    setSaving(true);
    setError(null);
    try {
      await client.post(`/it-assets/${asset.id}/assign`, {
        assigned_to: form.assigned_to,
        notes:       form.notes || undefined,
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Assignment failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-indigo-500" />
            Assign Device — {asset.asset_tag}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Assign To <span className="text-red-400">*</span></label>
            {users.length > 0 ? (
              <select
                value={form.assigned_to}
                onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                <option value="">— Select technician —</option>
                {users.map(u => (
                  <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                ))}
              </select>
            ) : (
              <input type="text" placeholder="Technician name…"
                value={form.assigned_to}
                onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <input type="text" placeholder="Reason, project, truck…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50 border border-slate-200">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg
                         bg-indigo-600 text-white font-medium hover:bg-indigo-700
                         disabled:opacity-50 transition-colors">
              <UserCheck className="w-3.5 h-3.5" />
              {saving ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Status change button strip ────────────────────────────────────────────────
function StatusActions({ asset, onDone }) {
  const [loading, setLoading] = useState(null);

  async function changeStatus(status) {
    if (!confirm(`Mark this device as "${status.replace(/_/g, ' ')}"?`)) return;
    setLoading(status);
    try {
      await client.patch(`/it-assets/${asset.id}`, { status });
      onDone();
    } catch (err) {
      alert(err.response?.data?.error ?? 'Status update failed');
    } finally {
      setLoading(null);
    }
  }

  const available = STATUS_ACTIONS.filter(a => a.status !== asset.status);

  return (
    <div className="flex flex-wrap gap-2">
      {available.map(({ status, label, color }) => (
        <button
          key={status}
          onClick={() => changeStatus(status)}
          disabled={!!loading}
          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors
            disabled:opacity-50 ${color}`}
        >
          {loading === status ? 'Saving…' : label}
        </button>
      ))}
    </div>
  );
}

// ── Unassign button ───────────────────────────────────────────────────────────
function UnassignButton({ assetId, onDone }) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    if (!confirm('Unassign this device from the current user?')) return;
    setLoading(true);
    try {
      await client.post(`/it-assets/${assetId}/unassign`);
      onDone();
    } catch (err) {
      alert(err.response?.data?.error ?? 'Unassign failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handle} disabled={loading}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border
                 bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100
                 font-medium transition-colors disabled:opacity-50">
      <UserX className="w-3 h-3" />
      {loading ? 'Unassigning…' : 'Unassign'}
    </button>
  );
}

// ── Spec row helper ───────────────────────────────────────────────────────────
function SpecRow({ label, value, icon: Icon, mono = false, highlight = false }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-slate-50 last:border-0">
      <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </span>
      <span className={`text-xs text-right max-w-[200px] break-all
        ${mono ? 'font-mono' : ''}
        ${highlight ? 'font-semibold text-indigo-700' : 'text-slate-700'}`}>
        {value}
      </span>
    </div>
  );
}

// ── History row ───────────────────────────────────────────────────────────────
function HistoryRow({ record }) {
  const actionLower = (record.action ?? '').toLowerCase();
  const isAssignAction = actionLower === 'assigned';
  const isLostAction   = actionLower === 'lost';

  const actionColor = isAssignAction
    ? 'text-indigo-600'
    : isLostAction
    ? 'text-red-500'
    : 'text-slate-500';

  const ActionIcon = isAssignAction ? UserCheck : isLostAction ? AlertTriangle : UserX;

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
      <td className="px-4 py-2.5">
        <span className={`flex items-center gap-1.5 text-xs font-medium ${actionColor}`}>
          <ActionIcon className="w-3.5 h-3.5" />
          {record.action ?? 'Unknown'}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs text-slate-600">
          <User className="w-3 h-3 text-slate-400" />
          {record.assigned_to ?? '—'}
        </span>
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
        {record.assigned_at
          ? format(new Date(record.assigned_at), 'MMM d, yyyy h:mm a')
          : '—'}
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
        {record.unassigned_at
          ? format(new Date(record.unassigned_at), 'MMM d, yyyy')
          : isAssignAction && !record.unassigned_at
          ? <span className="text-emerald-500 font-medium">Current</span>
          : '—'}
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[180px] truncate">
        {record.notes || '—'}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ITAssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { collapsed, onToggleSidebar } = useOutletContext();
  const { asset, history, loading, error, refresh } = useITAssetDetail(id);

  const [showAssign, setShowAssign] = useState(false);

  if (loading) {
    return (
      <>
        <Header title="IT Asset" subtitle="Loading…" collapsed={collapsed} onToggleSidebar={onToggleSidebar} />
        <main className="flex-1 flex items-center justify-center">
          <Spinner size="lg" className="text-indigo-400" />
        </main>
      </>
    );
  }

  if (error || !asset) {
    return (
      <>
        <Header title="IT Asset" subtitle="Error" collapsed={collapsed} onToggleSidebar={onToggleSidebar} />
        <main className="flex-1 px-6 py-6">
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error ?? 'Asset not found'}
          </div>
        </main>
      </>
    );
  }

  const meta = deviceMeta(asset.device_type);
  const DevIcon = meta.Icon;
  const isActive     = asset.status === 'active';
  const isLost       = asset.status === 'lost' || asset.status === 'stolen';
  const isInRepair   = asset.status === 'in_repair';
  const isAssigned   = !!asset.assigned_to;
  const isMobile     = ['ipad', 'iphone', 'hotspot'].includes((asset.device_type ?? '').toLowerCase());
  // "Since" date — get from the open history entry if available
  const currentHistEntry = history.find(h => !h.unassigned_at);

  return (
    <>
      <Header
        title={asset.make ? `${asset.make} ${asset.model ?? ''}` : (meta.label)}
        subtitle={[asset.asset_tag, asset.serial_number].filter(Boolean).join(' · ')}
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
            {!isAssigned && (
              <button onClick={() => setShowAssign(true)}
                className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg
                           bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors">
                <UserCheck className="w-3.5 h-3.5" />
                Assign
              </button>
            )}
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

        {/* Back */}
        <button onClick={() => navigate('/it-assets')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          All IT Assets
        </button>

        {/* Lost/stolen alert */}
        {isLost && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-800">
                Device marked as {asset.status}
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Reported {asset.updated_at ? formatDistanceToNow(new Date(asset.updated_at), { addSuffix: true }) : ''}
              </p>
            </div>
          </div>
        )}

        {/* Header card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${meta.color}`}>
                <DevIcon className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {asset.make ? `${asset.make} ${asset.model ?? ''}` : meta.label}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="font-mono text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                    {asset.asset_tag}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge status={asset.status ?? 'default'} dot>
                {(asset.status ?? '—').replace(/_/g, ' ')}
              </Badge>
              {asset.department && (
                <Badge status={asset.department} dot>{asset.department}</Badge>
              )}
              {asset.mdm_enrolled && (
                <span className="flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                  <Shield className="w-3 h-3" /> MDM Enrolled
                </span>
              )}
            </div>
          </div>

          {/* Status actions */}
          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400 font-medium mb-2">Change Status</p>
            <StatusActions asset={asset} onDone={refresh} />
          </div>
        </div>

        {/* Two-col layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Current assignment */}
          <div className={`rounded-xl border px-5 py-4 space-y-3
            ${isAssigned ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-white'}`}>
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-slate-400" />
              Assignment
            </h3>

            {isAssigned ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <User className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {asset.assigned_to ?? 'Unknown user'}
                      </p>
                      {currentHistEntry?.assigned_at && (
                        <p className="text-[11px] text-slate-400">
                          Since {format(new Date(currentHistEntry.assigned_at), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                  <UnassignButton assetId={asset.id} onDone={refresh} />
                </div>
                {asset.assignment_notes && (
                  <p className="text-xs text-slate-500 pt-1 border-t border-indigo-100">
                    {asset.assignment_notes}
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
                <UserX className="w-8 h-8 text-slate-200" />
                <p className="text-sm text-slate-400">Not currently assigned</p>
                {!isLost && (
                  <button onClick={() => setShowAssign(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                               bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors">
                    <UserCheck className="w-3 h-3" />
                    Assign Now
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Device specs */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-slate-400" />
              Device Specs
            </h3>
            <div className="divide-y divide-slate-50">
              <SpecRow label="Asset Tag"     value={asset.asset_tag}     icon={Hash}    mono highlight />
              <SpecRow label="Serial Number" value={asset.serial_number} icon={Hash}    mono />
              <SpecRow label="Make"          value={asset.make}          icon={Cpu} />
              <SpecRow label="Model"         value={asset.model}         icon={Cpu} />
              {isMobile && <>
                <SpecRow label="IMEI"         value={asset.imei}         icon={Hash}    mono />
                <SpecRow label="Phone #"      value={asset.phone_number} icon={Phone} />
                <SpecRow label="Carrier"      value={asset.carrier}      icon={Wifi} />
              </>}
              <SpecRow label="MDM Device ID" value={asset.mdm_device_id} icon={Shield}  mono />
              <SpecRow label="Purchase Date" value={asset.purchase_date ? format(new Date(asset.purchase_date), 'MMM d, yyyy') : null} icon={Calendar} />
              <SpecRow label="Warranty Until" value={asset.warranty_expires_at ? format(new Date(asset.warranty_expires_at), 'MMM d, yyyy') : null} icon={Shield} />
            </div>
            {asset.notes && (
              <div className="pt-2 mt-1 border-t border-slate-100">
                <p className="text-[11px] text-slate-400 font-medium mb-0.5">Notes</p>
                <p className="text-xs text-slate-600">{asset.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* In repair card */}
        {isInRepair && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <Settings className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Currently in Repair</p>
              {asset.updated_at && (
                <p className="text-xs text-amber-600 mt-0.5">
                  Sent {formatDistanceToNow(new Date(asset.updated_at), { addSuffix: true })}
                </p>
              )}
            </div>
            <button
              onClick={async () => {
                try {
                  await client.patch(`/it-assets/${asset.id}`, { status: 'active' });
                  refresh();
                } catch (err) {
                  alert(err.response?.data?.error ?? 'Failed');
                }
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                         bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" />
              Mark Repaired
            </button>
          </div>
        )}

        {/* Assignment history */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Assignment History
              <span className="text-xs font-normal text-slate-400">({history.length})</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>User</th>
                  <th>Assigned On</th>
                  <th>Returned</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                      No assignment history yet.
                    </td>
                  </tr>
                ) : (
                  history.map((r, i) => <HistoryRow key={r.id ?? i} record={r} />)
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {showAssign && (
        <AssignModal
          asset={asset}
          onClose={() => setShowAssign(false)}
          onDone={refresh}
        />
      )}
    </>
  );
}
