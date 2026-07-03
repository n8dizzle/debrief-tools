'use client';

import { useState, useEffect } from 'react';

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
const FINANCING_OPTIONS = [
  '18 Month 0% Interest',
  '60 Month 0% Interest',
  '7.9% APR',
  '9.9% APR',
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => { fetchTiers(); }, []);

  async function fetchTiers() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/tiers');
      const data = await res.json();
      // Convert TierConfig back to raw DB shape for editing
      const raw = (data.tiers || []).map((t: any) => ({
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
      }));
      setTiers(raw);
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

  function toggleArrayItem(tierId: string, field: 'guarantees' | 'financing_options' | 'tech_features', item: string) {
    const tier = tiers.find(t => t.id === tierId);
    if (!tier) return;
    const arr = tier[field] as string[];
    const updated = arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
    updateTier(tierId, { [field]: updated });
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading tier configs...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tier Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure warranties, financing, guarantees, and features for each tier</p>
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

                  {/* Financing */}
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Financing Options</label>
                    <div className="flex flex-wrap gap-2">
                      {FINANCING_OPTIONS.map(f => (
                        <button key={f}
                          onClick={() => toggleArrayItem(tier.id, 'financing_options', f)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            tier.financing_options.includes(f)
                              ? 'border-blue-400 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}>
                          {f}
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
