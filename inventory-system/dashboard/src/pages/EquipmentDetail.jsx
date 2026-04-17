/**
 * Equipment Detail — full ServiceTitan equipment record (read-only)
 *
 * Displays everything synced from ST:
 *  - Equipment identity: name, model, type, serial, manufacturer
 *  - Install details: date, tech, location
 *  - Warranty card
 *  - Customer & location info
 *  - Service history (ST work orders for this equipment)
 */

import { useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft, Cpu, RotateCcw, AlertCircle, ExternalLink,
  ShieldCheck, ShieldAlert, ShieldOff, Calendar, User,
  MapPin, Hash, Tag, Wrench, Clock, CheckCircle2,
  AlertTriangle, Info, Building, PlusCircle, X, DollarSign,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Header  from '../components/Header.jsx';
import Badge   from '../components/ui/Badge.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { useEquipmentDetail } from '../hooks/useEquipment.js';
import client from '../api/client.js';

// ── Warranty helpers ──────────────────────────────────────────────────────────
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
  active:   { label: 'Active',       Icon: ShieldCheck, card: 'border-emerald-200 bg-emerald-50/40', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  expiring: { label: 'Expiring Soon',Icon: ShieldAlert, card: 'border-amber-200 bg-amber-50/40',    text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700' },
  expired:  { label: 'Expired',      Icon: ShieldOff,   card: 'border-red-200 bg-red-50/40',         text: 'text-red-700',     badge: 'bg-red-100 text-red-600' },
  unknown:  { label: 'No Warranty',  Icon: ShieldOff,   card: 'border-slate-200 bg-slate-50/40',     text: 'text-slate-500',   badge: 'bg-slate-100 text-slate-500' },
};

// ── Warranty card ─────────────────────────────────────────────────────────────
function WarrantyCard({ item }) {
  const expiresAt = item.warranty_expiry ?? item.warranty_end ?? item.warranty_expires_at;
  const startsAt  = item.warranty_start;
  const status    = warrantyStatus(expiresAt);
  const meta      = WARRANTY_META[status];
  const { Icon }  = meta;

  const daysLeft = expiresAt
    ? Math.floor((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className={`rounded-xl border px-5 py-4 space-y-3 ${meta.card}`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-semibold flex items-center gap-2 ${meta.text}`}>
          <Icon className="w-4 h-4" />
          Warranty
        </h3>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${meta.badge}`}>
          {meta.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-400 font-medium">Start Date</p>
          <p className="text-slate-700 mt-0.5">
            {startsAt ? format(new Date(startsAt), 'MMM d, yyyy') : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400 font-medium">Expiration</p>
          <p className={`mt-0.5 font-semibold ${meta.text}`}>
            {expiresAt ? format(new Date(expiresAt), 'MMM d, yyyy') : '—'}
          </p>
        </div>
      </div>

      {daysLeft !== null && status !== 'unknown' && (
        <div className={`text-xs font-medium px-3 py-2 rounded-lg ${meta.badge}`}>
          {status === 'expired'
            ? `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago`
            : status === 'expiring'
            ? `⚠ Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
            : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
          }
        </div>
      )}

      {item.warranty_description && (
        <p className="text-xs text-slate-500 pt-1 border-t border-slate-100">
          {item.warranty_description}
        </p>
      )}
    </div>
  );
}

// ── Service history row ───────────────────────────────────────────────────────
function ServiceRow({ record }) {
  const isComplete = record.status === 'completed' || record.completed_on;

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
      {/* Job # */}
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
          #{record.st_job_id ?? record.job_number ?? record.id?.slice(0, 8)}
        </span>
      </td>

      {/* Summary */}
      <td className="px-4 py-3">
        <p className="text-sm text-slate-700 truncate max-w-[240px]">
          {record.summary ?? record.description ?? record.job_type ?? 'Service call'}
        </p>
        {record.job_type && record.summary && (
          <p className="text-[11px] text-slate-400">{record.job_type}</p>
        )}
      </td>

      {/* Technician */}
      <td className="px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs text-slate-600">
          <User className="w-3 h-3 text-slate-400" />
          {record.tech_name ?? record.technician ?? '—'}
        </span>
      </td>

      {/* Source */}
      <td className="px-4 py-3">
        {record.source === 'manual' ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
            Manual
          </span>
        ) : (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
            ServiceTitan
          </span>
        )}
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
        {(record.completed_on ?? record.scheduled_on ?? record.created_at)
          ? format(new Date(record.completed_on ?? record.scheduled_on ?? record.created_at), 'MMM d, yyyy')
          : '—'}
      </td>

      {/* Notes */}
      <td className="px-4 py-3 text-xs text-slate-400 max-w-[180px] truncate">
        {record.notes ?? record.resolution ?? ''}
      </td>
    </tr>
  );
}

// ── Meta field component ──────────────────────────────────────────────────────
function MetaField({ label, value, icon: Icon, mono = false, highlight = false }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </p>
      <p className={`mt-0.5 ${mono ? 'font-mono text-xs' : 'text-sm'} ${highlight ? 'font-semibold text-indigo-700' : 'text-slate-700'}`}>
        {value || '—'}
      </p>
    </div>
  );
}

// ── Read-only notice ──────────────────────────────────────────────────────────
function ReadOnlyNotice({ stId }) {
  return (
    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-xs text-indigo-600">
      <Info className="w-3.5 h-3.5 shrink-0" />
      <span>
        This record is synced from ServiceTitan and is <strong>read-only</strong>.
        {stId && <span className="ml-1 text-indigo-400">ST Equipment ID: <span className="font-mono">{stId}</span></span>}
      </span>
      {stId && (
        <a
          href={`https://go.servicetitan.com/equipment/${stId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap"
        >
          Open in ST
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

// ── Log maintenance modal ─────────────────────────────────────────────────────
const JOB_TYPES = ['Maintenance', 'Service Call', 'Inspection', 'Warranty Work', 'Installation'];

function LogMaintenanceModal({ equipmentId, onClose, onDone }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    job_type:     'Maintenance',
    summary:      '',
    technician:   '',
    completed_on: today,
    cost:         '',
    notes:        '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.summary.trim()) { setError('Summary is required'); return; }
    setSaving(true);
    setError(null);
    try {
      await client.post(`/equipment/${equipmentId}/service-log`, {
        job_type:     form.job_type,
        summary:      form.summary,
        technician:   form.technician || 'Unknown',
        completed_on: form.completed_on || today,
        cost:         form.cost ? Number(form.cost) : 0,
        notes:        form.notes,
        status:       'completed',
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-500" />
            Log Maintenance Entry
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

          {/* Job type */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Entry Type</label>
            <select
              value={form.job_type}
              onChange={e => set('job_type', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            >
              {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Summary <span className="text-red-400">*</span></label>
            <input type="text" placeholder="Brief description of work performed…"
              value={form.summary}
              onChange={e => set('summary', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>

          {/* Technician + Date (2 col) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Technician</label>
              <input type="text" placeholder="Tech name…"
                value={form.technician}
                onChange={e => set('technician', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Completed On</label>
              <input type="date"
                value={form.completed_on}
                max={today}
                onChange={e => set('completed_on', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>

          {/* Cost */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Cost ($)</label>
            <input type="number" placeholder="0.00" min="0" step="0.01"
              value={form.cost}
              onChange={e => set('cost', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <textarea rows={3} placeholder="Additional notes, parts used, follow-up required…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50 border border-slate-200">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg
                         bg-indigo-600 text-white font-medium hover:bg-indigo-700
                         disabled:opacity-50 transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EquipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { collapsed, onToggleSidebar } = useOutletContext();
  const { item, serviceLog, loading, error, refresh } = useEquipmentDetail(id);
  const [showLog, setShowLog] = useState(false);

  if (loading) {
    return (
      <>
        <Header title="Equipment" subtitle="Loading…" collapsed={collapsed} onToggleSidebar={onToggleSidebar} />
        <main className="flex-1 flex items-center justify-center">
          <Spinner size="lg" className="text-indigo-400" />
        </main>
      </>
    );
  }

  if (error || !item) {
    return (
      <>
        <Header title="Equipment" subtitle="Error" collapsed={collapsed} onToggleSidebar={onToggleSidebar} />
        <main className="flex-1 px-6 py-6">
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error ?? 'Equipment record not found'}
          </div>
        </main>
      </>
    );
  }

  const warrantyExp = item.warranty_expiry ?? item.warranty_end ?? item.warranty_expires_at;
  const wStatus = warrantyStatus(warrantyExp);

  return (
    <>
      <Header
        title={item.name ?? item.equipment_name ?? 'Equipment'}
        subtitle={[item.model, item.equipment_type ?? item.type].filter(Boolean).join(' · ')}
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
            <button onClick={() => setShowLog(true)}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg
                         bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors">
              <PlusCircle className="w-3.5 h-3.5" />
              Log Entry
            </button>
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

        {/* Back */}
        <button onClick={() => navigate('/equipment')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          All Equipment
        </button>

        {/* Read-only notice */}
        <ReadOnlyNotice stId={item.st_equipment_id} />

        {/* Header card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {item.name ?? item.equipment_name}
                </h2>
                {item.model && (
                  <p className="text-sm text-slate-500">{item.manufacturer ? `${item.manufacturer} · ` : ''}{item.model}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge status={item.department ?? 'default'} dot>
                {item.department ?? '—'}
              </Badge>
              {wStatus === 'expiring' && (
                <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  <ShieldAlert className="w-3 h-3" /> Warranty Expiring
                </span>
              )}
              {wStatus === 'expired' && (
                <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                  <ShieldOff className="w-3 h-3" /> Warranty Expired
                </span>
              )}
            </div>
          </div>

          {/* Equipment identity grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
            <MetaField label="Serial Number"   value={item.serial_number}           icon={Hash}     mono />
            <MetaField label="Equipment Type"  value={item.equipment_type ?? item.type} icon={Tag} />
            <MetaField label="Manufacturer"    value={item.manufacturer}            icon={Building} />
            <MetaField label="Model Number"    value={item.model_number ?? item.model} icon={Tag}   mono />
          </div>
        </div>

        {/* Two-col layout: install info + warranty */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Install + location card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              Installation Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <MetaField
                label="Install Date"
                value={(item.installation_date ?? item.install_date) ? format(new Date(item.installation_date ?? item.install_date), 'MMM d, yyyy') : null}
                icon={Calendar}
              />
              <MetaField
                label="Installing Tech"
                value={item.installed_by_name ?? item.tech_name}
                icon={User}
              />
              <MetaField
                label="Location"
                value={item.location_name ?? item.address}
                icon={MapPin}
              />
              <MetaField
                label="Zone / Area"
                value={item.zone ?? item.area}
                icon={MapPin}
              />
            </div>
            {item.notes && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-400 font-medium mb-1">Notes</p>
                <p className="text-sm text-slate-600">{item.notes}</p>
              </div>
            )}
          </div>

          {/* Warranty card */}
          <WarrantyCard item={item} />
        </div>

        {/* Customer card */}
        {(item.customer_name || item.customer_id) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              Customer
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetaField label="Customer Name"  value={item.customer_name}                        icon={User} />
              <MetaField label="Location"       value={item.location_name ?? item.service_address} icon={MapPin} />
              <MetaField label="ST Customer ID" value={item.st_customer_id}                       icon={Hash} mono />
              <MetaField label="ST Location ID" value={item.st_location_id}                       icon={Hash} mono />
            </div>
          </div>
        )}

        {/* Service history */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-slate-400" />
              Service History
              <span className="text-xs font-normal text-slate-400">
                ({serviceLog.length} record{serviceLog.length !== 1 ? 's' : ''})
              </span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job #</th>
                  <th>Summary</th>
                  <th>Technician</th>
                  <th>Source</th>
                  <th>Date</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {serviceLog.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                      No service history synced from ServiceTitan for this equipment.
                    </td>
                  </tr>
                ) : (
                  serviceLog.map((r, i) => <ServiceRow key={r.id ?? i} record={r} />)
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Last synced footer */}
        {item.last_synced_at && (
          <p className="text-xs text-slate-400 text-center pb-2">
            Last synced from ServiceTitan {formatDistanceToNow(new Date(item.last_synced_at), { addSuffix: true })}
          </p>
        )}

      </main>

      {showLog && (
        <LogMaintenanceModal
          equipmentId={id}
          onClose={() => setShowLog(false)}
          onDone={refresh}
        />
      )}
    </>
  );
}
