/**
 * Settings — admin configuration hub.
 *
 * Sections:
 *   • Company Profile
 *   • ServiceTitan Integration
 *   • Notifications & Alerts
 *   • Departments
 *   • Scanner / Mobile
 */

import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Building2, Zap, Bell, Tag, Smartphone,
  Save, RefreshCw, Eye, EyeOff, CheckCircle,
  AlertTriangle, Plus, Trash2, ChevronRight,
  Settings as SettingsIcon, Wifi, WifiOff,
} from 'lucide-react';
import { Spinner } from '../components/ui/Spinner.jsx';
import client from '../api/client.js';

// ── Shared primitives ─────────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}
      {children}
    </div>
  );
}

function Input({ value, onChange, type = 'text', placeholder, disabled, className = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400
                  disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
    />
  );
}

function Toggle({ value, onChange, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5
                    ${value ? 'bg-indigo-600' : 'bg-slate-200'}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform
                        ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

function SaveBar({ saving, saved, error, onSave }) {
  return (
    <div className="flex items-center justify-between pt-5 mt-5 border-t border-slate-200">
      <div className="text-sm">
        {error && <span className="text-red-600 flex items-center gap-1.5"><AlertTriangle size={14}/>{error}</span>}
        {saved && !error && <span className="text-emerald-600 flex items-center gap-1.5"><CheckCircle size={14}/>Saved!</span>}
      </div>
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60
                   text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
      >
        {saving ? <><Spinner size="sm" className="text-white/60" /> Saving…</> : <><Save size={14}/>Save changes</>}
      </button>
    </div>
  );
}

function SectionCard({ title, description, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-start gap-3">
        <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
          {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ── Section: Company ──────────────────────────────────────────────────────────
function CompanySection({ data, onChange, onSave, saving, saved, error }) {
  const set = (k, v) => onChange({ ...data, [k]: v });
  return (
    <SectionCard title="Company Profile" description="Your organization's basic info" icon={Building2}>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Company Name">
          <Input value={data.name} onChange={v => set('name', v)} placeholder="Christmas Air" />
        </Field>
        <Field label="Website">
          <Input value={data.website} onChange={v => set('website', v)} placeholder="christmasair.com" />
        </Field>
        <Field label="Address" >
          <Input value={data.address} onChange={v => set('address', v)} placeholder="123 Business Park Dr…" />
        </Field>
        <Field label="Phone">
          <Input value={data.phone} onChange={v => set('phone', v)} placeholder="972-555-0100" />
        </Field>
        <Field label="Ops Email">
          <Input value={data.email} onChange={v => set('email', v)} type="email" placeholder="ops@…" />
        </Field>
        <Field label="Timezone">
          <div className="relative">
            <select
              value={data.timezone}
              onChange={e => set('timezone', e.target.value)}
              className="w-full appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
            >
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
            </select>
            <ChevronRight size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" />
          </div>
        </Field>
      </div>
      <SaveBar saving={saving} saved={saved} error={error} onSave={onSave} />
    </SectionCard>
  );
}

// ── Section: ServiceTitan ─────────────────────────────────────────────────────
function ServiceTitanSection({ data, onChange, onSave, saving, saved, error }) {
  const set = (k, v) => onChange({ ...data, [k]: v });
  const [showKey, setShowKey] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  async function syncNow() {
    setSyncing(true); setSyncMsg('');
    try {
      await client.post('/settings/st-sync-now');
      setSyncMsg('Sync completed successfully!');
      onChange({ ...data, last_sync: new Date().toISOString(), sync_status: 'ok' });
    } catch {
      setSyncMsg('Sync failed — check API key.');
    } finally {
      setSyncing(false);
    }
  }

  const lastSync = data.last_sync ? new Date(data.last_sync) : null;
  const syncAgo  = lastSync
    ? (() => {
        const diff = Math.round((Date.now() - lastSync.getTime()) / 60000);
        if (diff < 1) return 'just now';
        if (diff < 60) return `${diff}m ago`;
        return `${Math.round(diff / 60)}h ago`;
      })()
    : 'never';

  return (
    <SectionCard
      title="ServiceTitan Integration"
      description="API credentials and sync schedule"
      icon={Zap}
    >
      {/* Status banner */}
      <div className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-5 text-sm
                       ${data.sync_status === 'ok'
                         ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                         : 'bg-red-50 border border-red-200 text-red-700'}`}>
        {data.sync_status === 'ok'
          ? <Wifi size={16} className="text-emerald-500 flex-shrink-0" />
          : <WifiOff size={16} className="text-red-500 flex-shrink-0" />}
        <div className="flex-1">
          <span className="font-semibold">{data.sync_status === 'ok' ? 'Connected' : 'Connection error'}</span>
          <span className="text-xs opacity-75 ml-2">Last sync: {syncAgo}</span>
        </div>
        <button
          onClick={syncNow}
          disabled={syncing}
          className="flex items-center gap-1.5 bg-white border border-current/20 rounded-lg px-3 py-1.5
                     text-xs font-semibold hover:bg-white/80 transition-colors disabled:opacity-60"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>
      {syncMsg && (
        <p className={`text-xs mb-4 ${syncMsg.includes('failed') ? 'text-red-600' : 'text-emerald-600'}`}>
          {syncMsg}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="API Key" hint="Stored encrypted. Never shared externally.">
          <div className="relative">
            <Input
              value={data.api_key}
              onChange={v => set('api_key', v)}
              type={showKey ? 'text' : 'password'}
              placeholder="ST-xxxx-xxxx"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </Field>

        <Field label="Tenant ID">
          <Input value={data.tenant_id} onChange={v => set('tenant_id', v)} placeholder="ca-tenant-xxxx" />
        </Field>

        <Field label="Base URL">
          <Input value={data.base_url} onChange={v => set('base_url', v)} placeholder="https://api.servicetitan.io" />
        </Field>

        <Field label="Sync Frequency" hint="How often to pull jobs from ServiceTitan">
          <div className="relative">
            <select
              value={data.sync_frequency}
              onChange={e => set('sync_frequency', Number(e.target.value))}
              className="w-full appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
            >
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every hour</option>
              <option value={120}>Every 2 hours</option>
              <option value={240}>Every 4 hours</option>
            </select>
            <ChevronRight size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" />
          </div>
        </Field>
      </div>

      <div className="mt-5">
        <Toggle
          value={data.sync_enabled}
          onChange={v => set('sync_enabled', v)}
          label="Automatic sync enabled"
          description="Disable to pause background syncing without removing credentials"
        />
      </div>

      <SaveBar saving={saving} saved={saved} error={error} onSave={onSave} />
    </SectionCard>
  );
}

// ── Section: Notifications ────────────────────────────────────────────────────
function NotificationsSection({ data, onChange, onSave, saving, saved, error }) {
  const set = (k, v) => onChange({ ...data, [k]: v });
  return (
    <SectionCard
      title="Notifications & Alerts"
      description="Configure when and how alerts fire"
      icon={Bell}
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 mb-5">
        <Field
          label="Low Stock Threshold"
          hint="Alert when quantity falls to or below this % of the reorder point"
        >
          <div className="relative">
            <Input
              type="number"
              value={data.low_stock_threshold_pct}
              onChange={v => set('low_stock_threshold_pct', Number(v))}
              className="pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
          </div>
        </Field>

        <Field
          label="Overdue Tool Days"
          hint="Alert when a tool has been checked out for at least this many days"
        >
          <div className="relative">
            <Input
              type="number"
              value={data.overdue_tool_days}
              onChange={v => set('overdue_tool_days', Number(v))}
              className="pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">days</span>
          </div>
        </Field>

        <Field label="Email Recipients" hint="Comma-separated list of addresses">
          <Input
            value={data.email_recipients}
            onChange={v => set('email_recipients', v)}
            placeholder="ops@… , mgr@…"
          />
        </Field>
      </div>

      <div className="divide-y divide-slate-100">
        <Toggle value={data.in_app_alerts}        onChange={v => set('in_app_alerts', v)}        label="In-app notification bell"         description="Show the notification panel in the desktop header" />
        <Toggle value={data.email_alerts}         onChange={v => set('email_alerts', v)}         label="Email alerts"                     description="Send alert emails to recipients above" />
        <Toggle value={data.alert_on_po_received} onChange={v => set('alert_on_po_received', v)} label="Alert when PO is received"         description="Notify when a purchase order is marked received" />
        <Toggle value={data.alert_on_restock_ready} onChange={v => set('alert_on_restock_ready', v)} label="Alert when restock batch is ready" description="Notify when a batch moves to pending approval" />
      </div>

      <SaveBar saving={saving} saved={saved} error={error} onSave={onSave} />
    </SectionCard>
  );
}

// ── Section: Departments ──────────────────────────────────────────────────────
const DEPT_PALETTE = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

function DepartmentsSection({ data, onChange, onSave, saving, saved, error }) {
  const [newName, setNewName] = useState('');

  function addDept() {
    if (!newName.trim()) return;
    const dept = {
      id:     `dept-${Date.now()}`,
      name:   newName.trim(),
      slug:   newName.trim().toLowerCase().replace(/\s+/g, '_'),
      color:  DEPT_PALETTE[data.length % DEPT_PALETTE.length],
      active: true,
    };
    onChange([...data, dept]);
    setNewName('');
  }

  function removeDept(id) {
    onChange(data.filter(d => d.id !== id));
  }

  function toggleActive(id) {
    onChange(data.map(d => d.id === id ? { ...d, active: !d.active } : d));
  }

  function setColor(id, color) {
    onChange(data.map(d => d.id === id ? { ...d, color } : d));
  }

  return (
    <SectionCard title="Departments" description="Manage organizational departments" icon={Tag}>
      <div className="flex flex-col gap-2 mb-5">
        {data.map(dept => (
          <div
            key={dept.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors
                        ${dept.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}
          >
            {/* Color dot + picker */}
            <div className="relative flex-shrink-0 group">
              <div className="w-6 h-6 rounded-full cursor-pointer border-2 border-white shadow-sm ring-1 ring-slate-200"
                   style={{ backgroundColor: dept.color }} />
              {/* Mini palette on hover */}
              <div className="absolute left-0 top-8 hidden group-hover:flex flex-wrap gap-1 bg-white shadow-lg rounded-xl p-2 border border-slate-200 z-10 w-36">
                {DEPT_PALETTE.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(dept.id, c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110
                                ${dept.color === c ? 'border-slate-800 scale-110' : 'border-white'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{dept.name}</p>
              <p className="text-xs text-slate-400 font-mono">{dept.slug}</p>
            </div>

            <button
              type="button"
              onClick={() => toggleActive(dept.id)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-colors
                ${dept.active
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                  : 'text-slate-500 bg-slate-100 border-slate-200 hover:bg-slate-200'}`}
            >
              {dept.active ? 'Active' : 'Inactive'}
            </button>

            {dept.id !== 'dept-1' && dept.id !== 'dept-2' && (
              <button
                type="button"
                onClick={() => removeDept(dept.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add new dept */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addDept()}
          placeholder="New department name…"
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
        />
        <button
          type="button"
          onClick={addDept}
          disabled={!newName.trim()}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
                     text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      <SaveBar saving={saving} saved={saved} error={error} onSave={onSave} />
    </SectionCard>
  );
}

// ── Section: Scanner ──────────────────────────────────────────────────────────
const BARCODE_OPTIONS = [
  { id: 'qr_code',  label: 'QR Code' },
  { id: 'code_128', label: 'Code 128' },
  { id: 'code_39',  label: 'Code 39' },
  { id: 'ean_13',   label: 'EAN-13' },
  { id: 'ean_8',    label: 'EAN-8' },
  { id: 'upc_a',    label: 'UPC-A' },
];

function ScannerSection({ data, onChange, onSave, saving, saved, error }) {
  const set = (k, v) => onChange({ ...data, [k]: v });

  function toggleFormat(fmt) {
    const curr = data.barcode_formats ?? [];
    onChange({
      ...data,
      barcode_formats: curr.includes(fmt)
        ? curr.filter(f => f !== fmt)
        : [...curr, fmt],
    });
  }

  return (
    <SectionCard
      title="Scanner / Mobile App"
      description="Preferences for the field tech scanner experience"
      icon={Smartphone}
    >
      <div className="mb-5">
        <Field label="Default Consume Quantity" hint="Starting quantity when logging material usage">
          <div className="w-32">
            <Input
              type="number"
              value={data.default_consume_qty}
              onChange={v => set('default_consume_qty', Number(v))}
            />
          </div>
        </Field>
      </div>

      <div className="divide-y divide-slate-100 mb-5">
        <Toggle value={data.auto_assign_truck}     onChange={v => set('auto_assign_truck', v)}     label="Auto-assign truck from user profile" description="Techs see their assigned truck automatically on the scanner home" />
        <Toggle value={data.require_job_selection} onChange={v => set('require_job_selection', v)} label="Require job selection on consume"    description="Techs must pick a ServiceTitan job before logging material usage" />
        <Toggle value={data.show_warehouse_stock}  onChange={v => set('show_warehouse_stock', v)}  label="Show warehouse stock on confirm"     description="Display warehouse qty alongside truck qty on the confirm screen" />
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Supported Barcode Formats</p>
        <p className="text-xs text-slate-400 mb-3">Select all formats your barcodes use. Enabling fewer formats improves scan speed.</p>
        <div className="flex flex-wrap gap-2">
          {BARCODE_OPTIONS.map(opt => {
            const on = (data.barcode_formats ?? []).includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleFormat(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                  ${on
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <SaveBar saving={saving} saved={saved} error={error} onSave={onSave} />
    </SectionCard>
  );
}

// ── Sidebar nav ───────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'company',       label: 'Company',        icon: Building2  },
  { id: 'servicetitan',  label: 'ServiceTitan',   icon: Zap        },
  { id: 'notifications', label: 'Notifications',  icon: Bell       },
  { id: 'departments',   label: 'Departments',    icon: Tag        },
  { id: 'scanner',       label: 'Scanner / Mobile', icon: Smartphone },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Settings() {
  const { collapsed, onToggleSidebar } = useOutletContext() ?? {};

  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [activeSection, setActiveSection] = useState('company');

  // Per-section save state
  const [sectionState, setSectionState] = useState({});

  const setSec = (section, patch) =>
    setSectionState(prev => ({ ...prev, [section]: { ...prev[section], ...patch } }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get('/settings');
      setSettings(data.settings);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(section) {
    setSec(section, { saving: true, saved: false, error: '' });
    try {
      const { data } = await client.patch('/settings', { section, data: settings[section] });
      setSettings(data.settings);
      setSec(section, { saving: false, saved: true });
      setTimeout(() => setSec(section, { saved: false }), 2500);
    } catch (err) {
      setSec(section, { saving: false, error: err.response?.data?.error ?? 'Save failed' });
    }
  }

  function updateSection(section, value) {
    setSettings(prev => ({ ...prev, [section]: value }));
  }

  const ss = (section) => ({
    saving: sectionState[section]?.saving ?? false,
    saved:  sectionState[section]?.saved  ?? false,
    error:  sectionState[section]?.error  ?? '',
    onSave: () => save(section),
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <SettingsIcon size={20} className="text-slate-400" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">Settings</h1>
            <p className="text-slate-400 text-xs">Configure your inventory management system</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Settings sidebar */}
        <aside className="w-52 flex-shrink-0 border-r border-slate-200 bg-slate-50 py-4 overflow-y-auto">
          <nav className="px-2 space-y-0.5">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left
                            transition-colors ${activeSection === id
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-200'}`}
              >
                <Icon size={15} className="flex-shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Spinner size="lg" className="text-indigo-500" />
            </div>
          ) : !settings ? (
            <div className="text-center py-24 text-slate-400">Failed to load settings.</div>
          ) : (
            <div className="max-w-2xl mx-auto">
              {activeSection === 'company' && (
                <CompanySection
                  data={settings.company}
                  onChange={v => updateSection('company', v)}
                  {...ss('company')}
                />
              )}
              {activeSection === 'servicetitan' && (
                <ServiceTitanSection
                  data={settings.servicetitan}
                  onChange={v => updateSection('servicetitan', v)}
                  {...ss('servicetitan')}
                />
              )}
              {activeSection === 'notifications' && (
                <NotificationsSection
                  data={settings.notifications}
                  onChange={v => updateSection('notifications', v)}
                  {...ss('notifications')}
                />
              )}
              {activeSection === 'departments' && (
                <DepartmentsSection
                  data={settings.departments}
                  onChange={v => updateSection('departments', v)}
                  {...ss('departments')}
                />
              )}
              {activeSection === 'scanner' && (
                <ScannerSection
                  data={settings.scanner}
                  onChange={v => updateSection('scanner', v)}
                  {...ss('scanner')}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
