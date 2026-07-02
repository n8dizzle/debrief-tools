'use client';

import { useState } from 'react';
import { equipmentCatalog, addOnsCatalog, installItemsCatalog, warrantiesCatalog, packagesCatalog } from '@/lib/catalog';
import { getInstallItemsTotal, getWarrantiesTotal } from '@/types/estimate';
import ImagePlaceholder from '@/components/ImagePlaceholder';

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

type Tab = 'packages' | 'equipment' | 'addons' | 'materials' | 'warranties';

export default function CatalogPage() {
  const [tab, setTab] = useState<Tab>('packages');
  const [tierFilter, setTierFilter] = useState<string>('all');

  const filteredEquipment = tierFilter === 'all' ? equipmentCatalog : equipmentCatalog.filter(e => e.tier === tierFilter);
  const addOnCategories = Array.from(new Set(addOnsCatalog.map(a => a.category)));
  const installCategories = Array.from(new Set(installItemsCatalog.map(i => i.category)));

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'packages', label: 'Packages', count: packagesCatalog.length },
    { key: 'equipment', label: 'Equipment', count: equipmentCatalog.length },
    { key: 'addons', label: 'Add-Ons', count: addOnsCatalog.length },
    { key: 'materials', label: 'Materials', count: installItemsCatalog.length },
    { key: 'warranties', label: 'Warranties', count: warrantiesCatalog.length },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catalog</h1>
        <p className="text-sm text-gray-500 mt-1">Browse packages, equipment, add-ons, materials, and warranties</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Packages */}
      {tab === 'packages' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packagesCatalog.map(pkg => {
            const eqTotal = pkg.equipment.reduce((s, e) => s + e.retailPrice, 0);
            const aoTotal = pkg.addOns.reduce((s, a) => s + a.price, 0);
            const installTotal = getInstallItemsTotal(pkg.installItems);
            const warrantyTotal = getWarrantiesTotal(pkg.warranties);
            const total = eqTotal + aoTotal + installTotal + warrantyTotal + pkg.laborCost;
            return (
              <div key={pkg.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start gap-3 mb-3">
                  <ImagePlaceholder src={pkg.imageUrl} alt={pkg.name} size={56} />
                  <div>
                    <span className={`badge text-xs ${pkg.tier === 'good' ? 'bg-gray-100 text-gray-600' : pkg.tier === 'better' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'}`}>{pkg.tier}</span>
                    <h3 className="font-semibold text-gray-900 mt-1">{pkg.name}</h3>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">{pkg.description}</p>
                <div className="space-y-1 mb-3">
                  {pkg.equipment.map(eq => (
                    <div key={eq.id} className="text-xs text-gray-600 flex items-center gap-1"><span className="text-[var(--christmas-green)]">&#10003;</span>{eq.name}</div>
                  ))}
                  {pkg.addOns.map(ao => (
                    <div key={ao.id} className="text-xs text-gray-600 flex items-center gap-1"><span className="text-[var(--christmas-green)]">&#10003;</span>{ao.name}</div>
                  ))}
                  <div className="text-xs text-gray-500">{pkg.installItems.length} install items, {pkg.warranties.length} warranty</div>
                </div>
                <div className="text-lg font-bold text-gray-900">{fmt(total)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Equipment */}
      {tab === 'equipment' && (
        <>
          <div className="flex gap-2 mb-4">
            {['all', 'good', 'better', 'best'].map(t => (
              <button key={t} onClick={() => setTierFilter(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${tierFilter === t ? 'bg-[var(--christmas-green)] text-white' : 'bg-white text-gray-600 border border-gray-300'}`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEquipment.map(eq => (
              <div key={eq.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex gap-3 mb-3">
                  <ImagePlaceholder src={eq.imageUrl} alt={eq.name} size={64} />
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-gray-900">{eq.name}</h3>
                    </div>
                    <span className={`badge text-xs ${eq.tier === 'good' ? 'bg-gray-100 text-gray-600' : eq.tier === 'better' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'}`}>{eq.tier}</span>
                    <div className="text-sm text-gray-500">{eq.brand} {eq.model}</div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">{eq.description}</p>
                <div className="flex gap-3 mb-3 text-xs text-gray-500">
                  {eq.seer && <span className="px-2 py-0.5 bg-gray-50 rounded">{eq.seer} SEER</span>}
                  {eq.afue && <span className="px-2 py-0.5 bg-gray-50 rounded">{eq.afue}% AFUE</span>}
                  {eq.tons && <span className="px-2 py-0.5 bg-gray-50 rounded">{eq.tons} Ton</span>}
                </div>
                <ul className="space-y-1 mb-3">
                  {eq.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600"><span className="text-[var(--christmas-green)] mt-0.5">&#10003;</span>{f}</li>
                  ))}
                </ul>
                <div className="text-lg font-bold text-gray-900">{fmt(eq.retailPrice)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add-Ons */}
      {tab === 'addons' && (
        <div className="space-y-6">
          {addOnCategories.map(cat => (
            <div key={cat}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {addOnsCatalog.filter(a => a.category === cat).map(ao => (
                  <div key={ao.id} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex gap-3 mb-2">
                      <ImagePlaceholder src={ao.imageUrl} alt={ao.name} size={48} />
                      <div>
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-gray-900">{ao.name}</h3>
                          {ao.popular && <span className="badge bg-amber-50 text-amber-600 text-xs ml-1">Popular</span>}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{ao.description}</p>
                    <div className="text-lg font-bold text-gray-900">{fmt(ao.price)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Materials */}
      {tab === 'materials' && (
        <div className="space-y-6">
          {installCategories.map(cat => (
            <div key={cat}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{cat.replace(/\b\w/g, c => c.toUpperCase())}</h3>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Item</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Unit Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installItemsCatalog.filter(i => i.category === cat).map(item => (
                      <tr key={item.id} className="border-b border-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">{fmt(item.unitCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Warranties */}
      {tab === 'warranties' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {warrantiesCatalog.map(w => (
            <div key={w.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex gap-3 mb-3">
                <ImagePlaceholder src={w.imageUrl} alt={w.name} size={48} />
                <div>
                  <h3 className="font-semibold text-gray-900">{w.name}</h3>
                  <span className="badge bg-blue-50 text-blue-600 text-xs">{w.term}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-2">{w.description}</p>
              <p className="text-xs text-gray-500 mb-3">Coverage: {w.coverage}</p>
              <div className="text-lg font-bold text-gray-900">{fmt(w.price)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
