'use client';

import { useState, useEffect } from 'react';
import { FinancingPlan, CachedAddOn } from '@/types/estimate';

interface TierRow {
  id: string;
  display_name: string;
  sort_order: number;
  color: string;
  default_brand: string;
  labor_warranty_years: number;
  parts_warranty_years: number;
  heat_exchanger_warranty_years: number;
  comfort_guarantee_years: number;
  compressor_stage: string;
  noise_level: string;
  cooling_savings: string;
  heating_savings: string;
  thermostat: string;
  financing_options: string[];
  guarantees: string[];
  tech_features: string[];
  // New fields
  default_addon_ids: string[];
  featured_financing_plan_id: string | null;
  warranty_extension_price: number | null;
  scope_included: string[];
  scope_excluded: string[];
  scope_assumptions: string[];
}

const STAGE_OPTIONS = ['Single-Stage', 'Two-Stage', 'Variable'];
const NOISE_OPTIONS = ['Standard', 'Quiet', 'Quieter', 'Quietest'];
const THERMOSTAT_OPTIONS = ['Basic Thermostat', 'Programmable Thermostat', 'Wi-Fi Thermostat'];
const GUARANTEE_OPTIONS = [
  '$500 No-Frustration',
  'Property Protection',
  'No-Lemon',
  '1-Year Club',
  '2-Year Satisfaction',
  'Apples to Apples',
];
const FEATURE_OPTIONS = [
  'Basic Thermostat',
  'Programmable Thermostat',
  'Wi-Fi Thermostat',
  'Smartphone Control',
  'Increased Humidity Control',
  'Noise Reduction',
  'Upgraded Filtration',
  'Top-of-the-Line Filtration',
  'UV Germicidal Light',
  'Variable-Speed Blower',
  'Variable-Speed Technology',
];

export default function TierSettingsPage() {
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [financingPlans, setFinancingPlans] = useState<FinancingPlan[]>([]);
  const [addons, setAddons] = useState<CachedAddOn[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [tiersRes, financingRes, addonsRes] = await Promise.all([
        fetch('/api/settings/tiers'),
        fetch('/api/settings/financing'),
        fetch('/api/settings/addons'),
      ]);
      const tiersData = await tiersRes.json();
      const financingData = await financingRes.json();
      const addonsData = await addonsRes.json();

      // Convert TierConfig back to raw DB shape for editing
      const raw = (tiersData.tiers || []).map((t: any) => ({
        id: t.id,
        display_name: t.name,
        sort_order: 0,
        color: t.color,
        default_brand: t.brand,
        labor_warranty_years: parseInt(t.laborWarranty) || 1,
        parts_warranty_years: parseInt(t.partsWarranty) || 10,
        heat_exchanger_warranty_years: parseInt(t.heatExchangerWarranty) || 20,
        comfort_guarantee_years: t.comfortGuaranteeYears,
        compressor_stage: t.compressorStage,
        noise_level: t.noiseLevel,
        cooling_savings: t.coolingSavings,
        heating_savings: t.heatingSavings,
        thermostat: t.thermostat,
        financing_options: t.financing,
        guarantees: t.guarantees,
        tech_features: t.techFeatures,
        default_addon_ids: t.defaultAddonIds || [],
        featured_financing_plan_id: t.featuredFinancingPlanId || null,
        warranty_extension_price: t.warrantyExtensionPrice ?? null,
        scope_included: t.scopeIncluded || [],
        scope_excluded: t.scopeExcluded || [],
        scope_assumptions: t.scopeAssumptions || [],
      }));
      setTiers(raw);
      setFinancingPlans(financingData.plans || []);
      setAddons(addonsData.addons || []);
    } catch {
      setMessage('Failed to load tier configs');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(tier: TierRow) {
    setSaving(tier.id);
    setMessage('');
    try {
      const res = await fetch('/api/settings/tiers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tier),
      });
      if (!res.ok) throw new Error('Save failed');
      setMessage(`${tier.display_name} saved`);
      setEditingTier(null);
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Failed to save');
    } finally {
      setSaving(null);
    }
  }

  function updateTier(id: string, updates: Partial<TierRow>) {
    setTiers(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }

  function toggleArrayItem(tierId: string, field: 'guarantees' | 'financing_options' | 'tech_features' | 'default_addon_ids', item: string) {
    const tier = tiers.find(t => t.id === tierId);
    if (!tier) return;
    const arr = tier[field] as string[];
    const updated = arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
    updateTier(tierId, { [field]: updated });
  }

  function updateScopeItem(tierId: string, field: 'scope_included' | 'scope_excluded' | 'scope_assumptions', index: number, value: string) {
    const tier = tiers.find(t => t.id === tierId);
    if (!tier) return;
    const arr = [...tier[field]];
    arr[index] = value;
    updateTier(tierId, { [field]: arr });
  }

  function addScopeItem(tierId: string, field: 'scope_included' | 'scope_excluded' | 'scope_assumptions') {
    const tier = tiers.find(t => t.id === tierId);
    if (!tier) return;
    updateTier(tierId, { [field]: [...tier[field], ''] });
  }

  function removeScopeItem(tierId: string, field: 'scope_included' | 'scope_excluded' | 'scope_assumptions', index: number) {
    const tier = tiers.find(t => t.id === tierId);
    if (!tier) return;
    const arr = tier[field].filter((_, i) => i !== index);
    updateTier(tierId, { [field]: arr });
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading tier configs...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tier Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure warranties, financing, guarantees, add-ons, and scope for each tier</p>
        </div>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${message.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      <div className="space-y-4">
        {tiers.map(tier => {
          const isEditing = editingTier === tier.id;

          return (
            <div key={tier.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between cursor-pointer" onClick={() => setEditingTier(isEditing ? null : tier.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tier.color }} />
                  <div>
                    <span className="font-semibold text-gray-900">{tier.display_name}</span>
                    <span className="text-sm text-gray-500 ml-2">{tier.default_brand} | {tier.compressor_stage} | {tier.labor_warranty_years}yr Labor</span>
                  </div>
                </div>
                <span className="text-gray-400 text-sm">{isEditing ? 'Collapse' : 'Edit'}</span>
              </div>

              {/* Edit Form */}
              {isEditing && (
                <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Display Name */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Display Name</label>
                      <input type="text" value={tier.display_name}
                        onChange={e => updateTier(tier.id, { display_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>

                    {/* Brand */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Default Brand</label>
                      <input type="text" value={tier.default_brand}
                        onChange={e => updateTier(tier.id, { default_brand: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>

                    {/* Color */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Color</label>
                      <input type="color" value={tier.color}
                        onChange={e => updateTier(tier.id, { color: e.target.value })}
                        className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer" />
                    </div>

                    {/* Warranties */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Labor Warranty (years)</label>
                      <input type="number" value={tier.labor_warranty_years}
                        onChange={e => updateTier(tier.id, { labor_warranty_years: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Parts Warranty (years)</label>
                      <input type="number" value={tier.parts_warranty_years}
                        onChange={e => updateTier(tier.id, { parts_warranty_years: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Comfort Guarantee (years)</label>
                      <input type="number" value={tier.comfort_guarantee_years}
                        onChange={e => updateTier(tier.id, { comfort_guarantee_years: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>

                    {/* Warranty Extension Price */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Warranty Extension Price ($)</label>
                      <input type="number" value={tier.warranty_extension_price ?? ''}
                        onChange={e => updateTier(tier.id, { warranty_extension_price: e.target.value ? Number(e.target.value) : null })}
                        placeholder="e.g. 795"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      <p className="text-xs text-gray-400 mt-1">Cost to extend to 10yr coverage (Protect Your Investment)</p>
                    </div>

                    {/* Compressor Stage */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Compressor Stage</label>
                      <select value={tier.compressor_stage}
                        onChange={e => updateTier(tier.id, { compressor_stage: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    {/* Noise Level */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Noise Level</label>
                      <select value={tier.noise_level}
                        onChange={e => updateTier(tier.id, { noise_level: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        {NOISE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>

                    {/* Thermostat */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Thermostat</label>
                      <select value={tier.thermostat}
                        onChange={e => updateTier(tier.id, { thermostat: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        {THERMOSTAT_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    {/* Savings */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Cooling Savings</label>
                      <input type="text" value={tier.cooling_savings}
                        onChange={e => updateTier(tier.id, { cooling_savings: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Heating Savings</label>
                      <input type="text" value={tier.heating_savings}
                        onChange={e => updateTier(tier.id, { heating_savings: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                  </div>

                  {/* Featured Financing Plan */}
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Featured Financing Plan</label>
                    <select
                      value={tier.featured_financing_plan_id || ''}
                      onChange={e => updateTier(tier.id, { featured_financing_plan_id: e.target.value || null })}
                      className="w-full sm:w-1/2 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="">None selected</option>
                      {financingPlans.filter(p => p.active).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.apr}% APR, {p.months}mo)
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Shown prominently to customer on product detail page</p>
                  </div>

                  {/* Default Add-ons */}
                  {addons.length > 0 && (
                    <div className="mt-4">
                      <label className="block text-xs font-semibold text-gray-600 mb-2">Default Add-ons</label>
                      <p className="text-xs text-gray-400 mb-2">Pre-selected when creating estimates for this tier</p>
                      <div className="flex flex-wrap gap-2">
                        {addons.map(a => (
                          <button key={a.id}
                            onClick={() => toggleArrayItem(tier.id, 'default_addon_ids', a.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              tier.default_addon_ids.includes(a.id)
                                ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}>
                            {a.name} (${a.price})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Guarantees */}
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Guarantees</label>
                    <div className="flex flex-wrap gap-2">
                      {GUARANTEE_OPTIONS.map(g => (
                        <button key={g}
                          onClick={() => toggleArrayItem(tier.id, 'guarantees', g)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            tier.guarantees.includes(g)
                              ? 'border-green-400 bg-green-50 text-green-700'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tech Features */}
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Included Features</label>
                    <div className="flex flex-wrap gap-2">
                      {FEATURE_OPTIONS.map(f => (
                        <button key={f}
                          onClick={() => toggleArrayItem(tier.id, 'tech_features', f)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            tier.tech_features.includes(f)
                              ? 'border-purple-400 bg-purple-50 text-purple-700'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scope: What's Included */}
                  <div className="mt-6 border-t border-gray-100 pt-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Scope Transparency</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-green-700 mb-2">What&apos;s Included</label>
                        {tier.scope_included.map((item, i) => (
                          <div key={i} className="flex gap-2 mb-1">
                            <input type="text" value={item}
                              onChange={e => updateScopeItem(tier.id, 'scope_included', i, e.target.value)}
                              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                            <button onClick={() => removeScopeItem(tier.id, 'scope_included', i)}
                              className="text-gray-400 hover:text-red-500 text-sm px-2">&times;</button>
                          </div>
                        ))}
                        <button onClick={() => addScopeItem(tier.id, 'scope_included')}
                          className="text-xs text-green-600 hover:text-green-700 mt-1">+ Add item</button>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-red-700 mb-2">What&apos;s Not Included</label>
                        {tier.scope_excluded.map((item, i) => (
                          <div key={i} className="flex gap-2 mb-1">
                            <input type="text" value={item}
                              onChange={e => updateScopeItem(tier.id, 'scope_excluded', i, e.target.value)}
                              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                            <button onClick={() => removeScopeItem(tier.id, 'scope_excluded', i)}
                              className="text-gray-400 hover:text-red-500 text-sm px-2">&times;</button>
                          </div>
                        ))}
                        <button onClick={() => addScopeItem(tier.id, 'scope_excluded')}
                          className="text-xs text-red-600 hover:text-red-700 mt-1">+ Add item</button>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Requirements / Assumptions</label>
                        {tier.scope_assumptions.map((item, i) => (
                          <div key={i} className="flex gap-2 mb-1">
                            <input type="text" value={item}
                              onChange={e => updateScopeItem(tier.id, 'scope_assumptions', i, e.target.value)}
                              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                            <button onClick={() => removeScopeItem(tier.id, 'scope_assumptions', i)}
                              className="text-gray-400 hover:text-red-500 text-sm px-2">&times;</button>
                          </div>
                        ))}
                        <button onClick={() => addScopeItem(tier.id, 'scope_assumptions')}
                          className="text-xs text-gray-500 hover:text-gray-700 mt-1">+ Add item</button>
                      </div>
                    </div>
                  </div>

                  {/* Save */}
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => handleSave(tier)}
                      disabled={saving === tier.id}
                      className="px-6 py-2 bg-[var(--christmas-green)] text-white rounded-lg font-medium text-sm hover:bg-[var(--christmas-green-dark)] disabled:opacity-50"
                    >
                      {saving === tier.id ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
