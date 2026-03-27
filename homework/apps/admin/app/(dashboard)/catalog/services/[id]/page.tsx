'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';

type Tab = 'details' | 'variables' | 'addons' | 'homefit' | 'scope';

interface Variable {
  id: string;
  name: string;
  label: string;
  description: string | null;
  variable_type: string;
  options: any;
  is_required: boolean;
  affects_pricing: boolean;
  display_order: number;
}

interface Addon {
  id: string;
  name: string;
  description: string | null;
  suggested_price: number | null;
  display_order: number;
  is_active: boolean;
}

interface ServiceDetail {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  scope_includes: string[] | null;
  scope_excludes: string[] | null;
  productizability: number;
  pricing_type: string;
  launch_wave: number;
  homefit_rules: Record<string, any> | null;
  estimated_duration_min: number | null;
  estimated_duration_max: number | null;
  is_active: boolean;
  is_featured: boolean;
  category_id: string;
  category: { id: string; name: string; slug: string };
  department: { id: string; name: string; slug: string };
  variables: Variable[];
  addons: Addon[];
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="h-4 w-32 bg-[var(--admin-surface)] rounded animate-pulse" />
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-[var(--admin-surface)] rounded animate-pulse" />
          <div className="flex gap-2 mt-2">
            <div className="h-5 w-16 bg-[var(--admin-surface)] rounded animate-pulse" />
            <div className="h-5 w-16 bg-[var(--admin-surface)] rounded animate-pulse" />
          </div>
        </div>
      </div>
      <div className="h-10 bg-[var(--admin-surface)] rounded animate-pulse" />
      <div className="grid grid-cols-2 gap-6">
        <div className="admin-card h-64 animate-pulse" />
        <div className="admin-card h-64 animate-pulse" />
      </div>
    </div>
  );
}

export default function ServiceDetailPage() {
  const params = useParams();
  const serviceId = params.id as string;

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Form state for Details tab
  const [form, setForm] = useState({
    name: '', slug: '', short_description: '', description: '',
    productizability: 3, pricing_type: 'configurator', launch_wave: 1,
    is_active: true, is_featured: false,
    estimated_duration_min: '', estimated_duration_max: '',
  });

  // Scope state
  const [scopeIncludes, setScopeIncludes] = useState<string[]>([]);
  const [scopeExcludes, setScopeExcludes] = useState<string[]>([]);
  const [newInclude, setNewInclude] = useState('');
  const [newExclude, setNewExclude] = useState('');

  // HomeFit state
  const [homefitRules, setHomefitRules] = useState<Record<string, any>>({});
  const [newRuleKey, setNewRuleKey] = useState('');
  const [newRuleValue, setNewRuleValue] = useState('');

  // Variable/Addon modals
  const [showVarModal, setShowVarModal] = useState(false);
  const [editingVar, setEditingVar] = useState<Variable | null>(null);
  const [varForm, setVarForm] = useState({ name: '', label: '', description: '', variable_type: 'select', is_required: false, affects_pricing: false });

  const [showAddonModal, setShowAddonModal] = useState(false);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);
  const [addonForm, setAddonForm] = useState({ name: '', description: '', suggested_price: '', is_active: true });

  const fetchService = useCallback(async () => {
    try {
      const res = await fetch(`/api/catalog/services/${serviceId}`);
      if (!res.ok) throw new Error('Failed to load service');
      const data = await res.json();
      setService(data);
      setForm({
        name: data.name || '',
        slug: data.slug || '',
        short_description: data.short_description || '',
        description: data.description || '',
        productizability: data.productizability || 3,
        pricing_type: data.pricing_type || 'configurator',
        launch_wave: data.launch_wave || 1,
        is_active: data.is_active ?? true,
        is_featured: data.is_featured ?? false,
        estimated_duration_min: data.estimated_duration_min?.toString() || '',
        estimated_duration_max: data.estimated_duration_max?.toString() || '',
      });
      setScopeIncludes(data.scope_includes || []);
      setScopeExcludes(data.scope_excludes || []);
      setHomefitRules(data.homefit_rules || {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    fetchService();
  }, [fetchService]);

  const handleSaveDetails = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/catalog/services/${serviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          estimated_duration_min: form.estimated_duration_min ? parseInt(form.estimated_duration_min) : null,
          estimated_duration_max: form.estimated_duration_max ? parseInt(form.estimated_duration_max) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      setSaveMessage('Saved successfully');
      setTimeout(() => setSaveMessage(null), 3000);
      await fetchService();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveScope = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/catalog/services/${serviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope_includes: scopeIncludes, scope_excludes: scopeExcludes }),
      });
      if (!res.ok) throw new Error('Failed to save scope');
      setSaveMessage('Scope saved');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHomeFit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/catalog/services/${serviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homefit_rules: homefitRules }),
      });
      if (!res.ok) throw new Error('Failed to save HomeFit rules');
      setSaveMessage('HomeFit rules saved');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Variable CRUD
  const openVarModal = (v?: Variable) => {
    if (v) {
      setEditingVar(v);
      setVarForm({ name: v.name, label: v.label, description: v.description || '', variable_type: v.variable_type, is_required: v.is_required, affects_pricing: v.affects_pricing });
    } else {
      setEditingVar(null);
      setVarForm({ name: '', label: '', description: '', variable_type: 'select', is_required: false, affects_pricing: false });
    }
    setShowVarModal(true);
  };

  const handleSaveVariable = async () => {
    setSaving(true);
    try {
      if (editingVar) {
        const res = await fetch(`/api/catalog/services/${serviceId}/variables`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variable_id: editingVar.id, ...varForm }),
        });
        if (!res.ok) throw new Error('Failed to update variable');
      } else {
        const res = await fetch(`/api/catalog/services/${serviceId}/variables`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(varForm),
        });
        if (!res.ok) throw new Error('Failed to create variable');
      }
      setShowVarModal(false);
      await fetchService();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVariable = async (varId: string) => {
    if (!confirm('Delete this variable?')) return;
    try {
      const res = await fetch(`/api/catalog/services/${serviceId}/variables`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variable_id: varId }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchService();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Addon CRUD
  const openAddonModal = (a?: Addon) => {
    if (a) {
      setEditingAddon(a);
      setAddonForm({ name: a.name, description: a.description || '', suggested_price: a.suggested_price?.toString() || '', is_active: a.is_active });
    } else {
      setEditingAddon(null);
      setAddonForm({ name: '', description: '', suggested_price: '', is_active: true });
    }
    setShowAddonModal(true);
  };

  const handleSaveAddon = async () => {
    setSaving(true);
    try {
      const body = {
        ...addonForm,
        suggested_price: addonForm.suggested_price ? parseInt(addonForm.suggested_price) : null,
      };
      if (editingAddon) {
        const res = await fetch(`/api/catalog/services/${serviceId}/addons`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addon_id: editingAddon.id, ...body }),
        });
        if (!res.ok) throw new Error('Failed to update addon');
      } else {
        const res = await fetch(`/api/catalog/services/${serviceId}/addons`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to create addon');
      }
      setShowAddonModal(false);
      await fetchService();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddon = async (addonId: string) => {
    if (!confirm('Delete this addon?')) return;
    try {
      const res = await fetch(`/api/catalog/services/${serviceId}/addons`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addon_id: addonId }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchService();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'variables', label: `Variables (${service?.variables.length || 0})` },
    { id: 'addons', label: `Addons (${service?.addons.length || 0})` },
    { id: 'homefit', label: 'HomeFit Rules' },
    { id: 'scope', label: 'Scope Definition' },
  ];

  if (loading) return <LoadingSkeleton />;

  if (error || !service) {
    return (
      <div className="p-6">
        <div className="admin-card text-center py-12">
          <p className="text-red-400 text-sm">{error || 'Service not found'}</p>
          <Link href="/catalog/services" className="btn-secondary mt-4 text-sm inline-block">
            Back to Services
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
        <Link href="/catalog/services" className="hover:text-[var(--admin-text)] transition-colors">
          Services
        </Link>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-[var(--admin-text)]">{service.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--admin-text)]">{service.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`badge ${service.is_active ? 'badge-green' : 'badge-gray'}`}>
              {service.is_active ? 'Active' : 'Inactive'}
            </span>
            <span className="badge badge-blue">Wave {service.launch_wave}</span>
            <span className="badge badge-purple">{service.pricing_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
            <span className="text-sm text-[var(--admin-text-muted)]">ID: {serviceId}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveMessage && (
            <span className="text-sm text-green-400">{saveMessage}</span>
          )}
          <button
            onClick={activeTab === 'scope' ? handleSaveScope : activeTab === 'homefit' ? handleSaveHomeFit : handleSaveDetails}
            className="btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--admin-border)]">
        <nav className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-[var(--admin-primary)] border-[var(--admin-primary)]'
                  : 'text-[var(--admin-text-muted)] border-transparent hover:text-[var(--admin-text)] hover:border-[var(--admin-border)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="admin-card space-y-4">
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Service Information</h2>
            <div>
              <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="admin-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Slug</label>
              <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="admin-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Short Description</label>
              <input type="text" value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} className="admin-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Description</label>
              <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="admin-input resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Department</label>
                <input type="text" value={service.department.name} disabled className="admin-input opacity-60" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Category</label>
                <input type="text" value={service.category.name} disabled className="admin-input opacity-60" />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="admin-card space-y-4">
              <h2 className="text-base font-semibold text-[var(--admin-text)]">Classification</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Productizability (1-5)</label>
                  <select value={form.productizability} onChange={(e) => setForm({ ...form, productizability: parseInt(e.target.value) })} className="admin-select w-full">
                    {[1,2,3,4,5].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Wave</label>
                  <select value={form.launch_wave} onChange={(e) => setForm({ ...form, launch_wave: parseInt(e.target.value) })} className="admin-select w-full">
                    {[1,2,3,4].map((v) => <option key={v} value={v}>Wave {v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Pricing Type</label>
                <select value={form.pricing_type} onChange={(e) => setForm({ ...form, pricing_type: e.target.value })} className="admin-select w-full">
                  <option value="instant_price">Instant Price</option>
                  <option value="configurator">Configurator</option>
                  <option value="photo_estimate">Photo Estimate</option>
                  <option value="onsite_estimate">Onsite Estimate</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-[var(--admin-text)]">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--admin-text)]">
                  <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} className="rounded" />
                  Featured
                </label>
              </div>
            </div>
            <div className="admin-card space-y-4">
              <h2 className="text-base font-semibold text-[var(--admin-text)]">Duration</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Min (minutes)</label>
                  <input type="number" value={form.estimated_duration_min} onChange={(e) => setForm({ ...form, estimated_duration_min: e.target.value })} className="admin-input" placeholder="e.g. 30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Max (minutes)</label>
                  <input type="number" value={form.estimated_duration_max} onChange={(e) => setForm({ ...form, estimated_duration_max: e.target.value })} className="admin-input" placeholder="e.g. 60" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Variables Tab */}
      {activeTab === 'variables' && (
        <div className="admin-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Variables Configuration</h2>
            <button className="btn-primary text-sm" onClick={() => openVarModal()}>Add Variable</button>
          </div>
          <p className="text-sm text-[var(--admin-text-muted)] mb-6">
            Variables modify pricing based on property characteristics.
          </p>
          {service.variables.length === 0 ? (
            <p className="text-sm text-[var(--admin-text-muted)] text-center py-8">No variables configured</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Label</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Affects Price</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {service.variables.map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium text-[var(--admin-text)]">{v.name}</td>
                    <td>{v.label}</td>
                    <td><span className="badge badge-blue">{v.variable_type}</span></td>
                    <td><span className={`badge ${v.is_required ? 'badge-green' : 'badge-gray'}`}>{v.is_required ? 'Yes' : 'No'}</span></td>
                    <td><span className={`badge ${v.affects_pricing ? 'badge-green' : 'badge-gray'}`}>{v.affects_pricing ? 'Yes' : 'No'}</span></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openVarModal(v)} className="text-xs text-[var(--admin-primary)] hover:text-[var(--admin-primary-light)]">Edit</button>
                        <button onClick={() => handleDeleteVariable(v.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Addons Tab */}
      {activeTab === 'addons' && (
        <div className="admin-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Addons Configuration</h2>
            <button className="btn-primary text-sm" onClick={() => openAddonModal()}>Add Addon</button>
          </div>
          <p className="text-sm text-[var(--admin-text-muted)] mb-6">
            Optional extras that customers can add to this service.
          </p>
          {service.addons.length === 0 ? (
            <p className="text-sm text-[var(--admin-text-muted)] text-center py-8">No addons configured</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Addon</th>
                  <th>Description</th>
                  <th>Suggested Price</th>
                  <th>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {service.addons.map((a) => (
                  <tr key={a.id}>
                    <td className="font-medium text-[var(--admin-text)]">{a.name}</td>
                    <td className="text-xs max-w-xs truncate">{a.description || '-'}</td>
                    <td>{a.suggested_price ? `$${(a.suggested_price / 100).toFixed(2)}` : '-'}</td>
                    <td><span className={`badge ${a.is_active ? 'badge-green' : 'badge-gray'}`}>{a.is_active ? 'Yes' : 'No'}</span></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openAddonModal(a)} className="text-xs text-[var(--admin-primary)] hover:text-[var(--admin-primary-light)]">Edit</button>
                        <button onClick={() => handleDeleteAddon(a.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* HomeFit Rules Tab */}
      {activeTab === 'homefit' && (
        <div className="admin-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--admin-text)]">HomeFit Rules</h2>
          </div>
          <p className="text-sm text-[var(--admin-text-muted)] mb-6">
            HomeFit rules determine eligibility based on property data. Key-value pairs stored as JSONB.
          </p>
          <div className="space-y-3 mb-6">
            {Object.keys(homefitRules).length === 0 ? (
              <p className="text-sm text-[var(--admin-text-muted)] text-center py-4">No HomeFit rules configured</p>
            ) : (
              Object.entries(homefitRules).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)]">
                  <code className="text-sm text-[var(--admin-primary)] flex-shrink-0">{key}</code>
                  <span className="text-[var(--admin-text-muted)]">=</span>
                  <input
                    type="text"
                    value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    onChange={(e) => {
                      const updated = { ...homefitRules };
                      try {
                        updated[key] = JSON.parse(e.target.value);
                      } catch {
                        updated[key] = e.target.value;
                      }
                      setHomefitRules(updated);
                    }}
                    className="admin-input flex-1"
                  />
                  <button
                    onClick={() => {
                      const updated = { ...homefitRules };
                      delete updated[key];
                      setHomefitRules(updated);
                    }}
                    className="text-xs text-red-400 hover:text-red-300 flex-shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Key (e.g. has_pool)"
              value={newRuleKey}
              onChange={(e) => setNewRuleKey(e.target.value)}
              className="admin-input max-w-xs"
            />
            <input
              type="text"
              placeholder="Value (e.g. true)"
              value={newRuleValue}
              onChange={(e) => setNewRuleValue(e.target.value)}
              className="admin-input max-w-xs"
            />
            <button
              onClick={() => {
                if (!newRuleKey) return;
                let parsedValue: any = newRuleValue;
                try { parsedValue = JSON.parse(newRuleValue); } catch {}
                setHomefitRules({ ...homefitRules, [newRuleKey]: parsedValue });
                setNewRuleKey('');
                setNewRuleValue('');
              }}
              className="btn-secondary text-sm"
            >
              Add Rule
            </button>
          </div>
        </div>
      )}

      {/* Scope Tab */}
      {activeTab === 'scope' && (
        <div className="admin-card">
          <h2 className="text-base font-semibold text-[var(--admin-text)] mb-4">Scope Definition</h2>
          <p className="text-sm text-[var(--admin-text-muted)] mb-6">
            Define what is included and excluded in this service.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Includes */}
            <div>
              <h3 className="text-sm font-medium text-green-400 mb-3">Included</h3>
              <div className="space-y-2 mb-3">
                {scopeIncludes.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const updated = [...scopeIncludes];
                        updated[i] = e.target.value;
                        setScopeIncludes(updated);
                      }}
                      className="admin-input flex-1 text-sm"
                    />
                    <button
                      onClick={() => setScopeIncludes(scopeIncludes.filter((_, idx) => idx !== i))}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Add included item..."
                  value={newInclude}
                  onChange={(e) => setNewInclude(e.target.value)}
                  className="admin-input flex-1 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newInclude.trim()) {
                      setScopeIncludes([...scopeIncludes, newInclude.trim()]);
                      setNewInclude('');
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (newInclude.trim()) {
                      setScopeIncludes([...scopeIncludes, newInclude.trim()]);
                      setNewInclude('');
                    }
                  }}
                  className="btn-secondary text-xs"
                >
                  Add
                </button>
              </div>
            </div>
            {/* Excludes */}
            <div>
              <h3 className="text-sm font-medium text-red-400 mb-3">Excluded</h3>
              <div className="space-y-2 mb-3">
                {scopeExcludes.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const updated = [...scopeExcludes];
                        updated[i] = e.target.value;
                        setScopeExcludes(updated);
                      }}
                      className="admin-input flex-1 text-sm"
                    />
                    <button
                      onClick={() => setScopeExcludes(scopeExcludes.filter((_, idx) => idx !== i))}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Add excluded item..."
                  value={newExclude}
                  onChange={(e) => setNewExclude(e.target.value)}
                  className="admin-input flex-1 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newExclude.trim()) {
                      setScopeExcludes([...scopeExcludes, newExclude.trim()]);
                      setNewExclude('');
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (newExclude.trim()) {
                      setScopeExcludes([...scopeExcludes, newExclude.trim()]);
                      setNewExclude('');
                    }
                  }}
                  className="btn-secondary text-xs"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Variable Modal */}
      {showVarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="admin-card w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-[var(--admin-text)] mb-4">
              {editingVar ? 'Edit Variable' : 'Add Variable'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Name</label>
                <input type="text" value={varForm.name} onChange={(e) => setVarForm({ ...varForm, name: e.target.value })} className="admin-input" placeholder="e.g. lot_size" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Label</label>
                <input type="text" value={varForm.label} onChange={(e) => setVarForm({ ...varForm, label: e.target.value })} className="admin-input" placeholder="e.g. Lot Size" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Type</label>
                <select value={varForm.variable_type} onChange={(e) => setVarForm({ ...varForm, variable_type: e.target.value })} className="admin-select w-full">
                  <option value="select">Select</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="text">Text</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Description</label>
                <input type="text" value={varForm.description} onChange={(e) => setVarForm({ ...varForm, description: e.target.value })} className="admin-input" />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-[var(--admin-text)]">
                  <input type="checkbox" checked={varForm.is_required} onChange={(e) => setVarForm({ ...varForm, is_required: e.target.checked })} />
                  Required
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--admin-text)]">
                  <input type="checkbox" checked={varForm.affects_pricing} onChange={(e) => setVarForm({ ...varForm, affects_pricing: e.target.checked })} />
                  Affects Pricing
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setShowVarModal(false)} className="btn-secondary text-sm" disabled={saving}>Cancel</button>
              <button onClick={handleSaveVariable} className="btn-primary text-sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Addon Modal */}
      {showAddonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="admin-card w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-[var(--admin-text)] mb-4">
              {editingAddon ? 'Edit Addon' : 'Add Addon'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Name</label>
                <input type="text" value={addonForm.name} onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })} className="admin-input" placeholder="e.g. Edging" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Description</label>
                <textarea value={addonForm.description} onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })} rows={2} className="admin-input resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">Suggested Price (cents)</label>
                <input type="number" value={addonForm.suggested_price} onChange={(e) => setAddonForm({ ...addonForm, suggested_price: e.target.value })} className="admin-input" placeholder="e.g. 1500 for $15.00" />
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--admin-text)]">
                <input type="checkbox" checked={addonForm.is_active} onChange={(e) => setAddonForm({ ...addonForm, is_active: e.target.checked })} />
                Active
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setShowAddonModal(false)} className="btn-secondary text-sm" disabled={saving}>Cancel</button>
              <button onClick={handleSaveAddon} className="btn-primary text-sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
