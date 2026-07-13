'use client';

import { useState } from 'react';
import {
  EstimateOption, Equipment, AddOn, InstallItem, Warranty, Discount,
  getOptionTotal, getInstallItemsTotal, getWarrantiesTotal, getDiscountsTotal,
} from '@/types/estimate';
import ImagePlaceholder from './ImagePlaceholder';

interface OptionBuilderProps {
  option: EstimateOption;
  equipmentCatalog: Equipment[];
  addOnsCatalog: AddOn[];
  installItemsCatalog: InstallItem[];
  warrantiesCatalog: Warranty[];
  discountsCatalog: Discount[];
  onUpdate: (option: EstimateOption) => void;
  onRemove?: () => void;
}

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

const tierStyle: Record<string, string> = {
  Good: 'border-l-gray-400',
  Better: 'border-l-blue-500',
  Best: 'border-l-[var(--christmas-gold)]',
};

type Section = 'equipment' | 'addons' | 'install' | 'warranty' | 'discount' | null;

export default function OptionBuilder({
  option, equipmentCatalog, addOnsCatalog, installItemsCatalog, warrantiesCatalog, discountsCatalog, onUpdate, onRemove,
}: OptionBuilderProps) {
  const [openSection, setOpenSection] = useState<Section>(null);
  const [equipFilter, setEquipFilter] = useState<string>('all');

  const total = getOptionTotal(option);
  const borderClass = tierStyle[option.label] || 'border-l-gray-300';

  function toggle(section: Section) {
    setOpenSection(prev => prev === section ? null : section);
  }

  // Equipment
  function addEquipment(eq: Equipment) {
    onUpdate({ ...option, equipment: [...option.equipment, eq] });
    setOpenSection(null);
  }
  function removeEquipment(idx: number) {
    onUpdate({ ...option, equipment: option.equipment.filter((_, i) => i !== idx) });
  }

  // Add-Ons
  function toggleAddOn(addOn: AddOn) {
    const exists = option.addOns.find(a => a.id === addOn.id);
    if (exists) {
      onUpdate({ ...option, addOns: option.addOns.filter(a => a.id !== addOn.id) });
    } else {
      onUpdate({ ...option, addOns: [...option.addOns, addOn] });
    }
  }

  // Install Items
  function toggleInstallItem(item: InstallItem) {
    const exists = option.installItems.find(i => i.id === item.id);
    if (exists) {
      onUpdate({ ...option, installItems: option.installItems.filter(i => i.id !== item.id) });
    } else {
      onUpdate({ ...option, installItems: [...option.installItems, { ...item }] });
    }
  }
  function updateInstallItemQty(id: string, quantity: number) {
    onUpdate({
      ...option,
      installItems: option.installItems.map(i => i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i),
    });
  }

  // Warranties
  function toggleWarranty(w: Warranty) {
    const exists = option.warranties.find(ow => ow.id === w.id);
    if (exists) {
      onUpdate({ ...option, warranties: option.warranties.filter(ow => ow.id !== w.id) });
    } else {
      onUpdate({ ...option, warranties: [...option.warranties, w] });
    }
  }

  // Discounts
  function toggleDiscount(d: Discount) {
    const exists = option.discounts.find(od => od.id === d.id);
    if (exists) {
      onUpdate({ ...option, discounts: option.discounts.filter(od => od.id !== d.id) });
    } else {
      onUpdate({ ...option, discounts: [...option.discounts, d] });
    }
  }

  const equipmentTypes = ['all', ...Array.from(new Set(equipmentCatalog.map(e => e.type)))];
  const filteredEquipment = equipFilter === 'all' ? equipmentCatalog : equipmentCatalog.filter(e => e.type === equipFilter);
  const addOnCategories = Array.from(new Set(addOnsCatalog.map(a => a.category)));
  const installCategories = Array.from(new Set(installItemsCatalog.map(i => i.category)));

  const installTotal = getInstallItemsTotal(option.installItems || []);
  const warrantyTotal = getWarrantiesTotal(option.warranties || []);
  const eqTotal = option.equipment.reduce((s, e) => s + e.retailPrice, 0);
  const aoTotal = option.addOns.reduce((s, a) => s + a.price, 0);
  const subtotal = eqTotal + aoTotal + installTotal + warrantyTotal + option.laborCost;
  const discountTotal = getDiscountsTotal(option.discounts || [], subtotal);

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borderClass} overflow-hidden`}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={option.label}
            onChange={(e) => onUpdate({ ...option, label: e.target.value })}
            className="text-lg font-bold text-gray-900 bg-transparent border-none focus:ring-0 p-0 w-40"
          />
          <span className="text-lg font-bold text-[var(--christmas-green)]">{fmt(total)}</span>
        </div>
        <div className="flex items-center gap-3">
          {option.packageId && (
            <span className="badge bg-purple-50 text-purple-600 text-xs">From Package</span>
          )}
          {onRemove && (
            <button onClick={onRemove} className="text-gray-400 hover:text-red-500 text-sm transition-colors">Remove</button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* ── EQUIPMENT ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Equipment
              {option.equipment.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">({fmt(eqTotal)})</span>
              )}
            </h4>
            <button onClick={() => toggle('equipment')} className="text-sm text-[var(--christmas-green)] hover:text-[var(--christmas-green-dark)] font-medium">
              {openSection === 'equipment' ? 'Close' : '+ Add Equipment'}
            </button>
          </div>
          {option.equipment.length > 0 ? (
            <div className="space-y-2 mb-3">
              {option.equipment.map((eq, idx) => (
                <div key={`${eq.id}-${idx}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <ImagePlaceholder src={eq.imageUrl} alt={eq.name} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{eq.name}</div>
                    <div className="text-xs text-gray-500">{eq.brand} {eq.model} {eq.seer ? `| ${eq.seer} SEER` : ''} {eq.afue ? `| ${eq.afue}% AFUE` : ''}</div>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm">{fmt(eq.retailPrice)}</span>
                  <button onClick={() => removeEquipment(idx)} className="text-gray-400 hover:text-red-500 text-xs">&times;</button>
                </div>
              ))}
            </div>
          ) : !openSection && <p className="text-sm text-gray-400 mb-3">No equipment selected</p>}

          {openSection === 'equipment' && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex gap-2 mb-3 flex-wrap">
                {equipmentTypes.map(t => (
                  <button key={t} onClick={() => setEquipFilter(t)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${equipFilter === t ? 'bg-[var(--christmas-green)] text-white' : 'bg-white text-gray-600 border border-gray-300'}`}>
                    {t === 'all' ? 'All' : t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {filteredEquipment.map(eq => (
                  <button key={eq.id} onClick={() => addEquipment(eq)}
                    className="text-left p-3 bg-white rounded-lg border border-gray-200 hover:border-[var(--christmas-green)] hover:shadow-sm transition-all flex gap-3">
                    <ImagePlaceholder src={eq.imageUrl} alt={eq.name} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-gray-900 text-sm">{eq.name}</div>
                        <span className={`badge text-xs ml-1 flex-shrink-0 ${eq.tier === 'good' ? 'bg-gray-100 text-gray-600' : eq.tier === 'better' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'}`}>{eq.tier}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{eq.brand} {eq.model}</div>
                      <div className="text-sm font-semibold text-gray-900 mt-1">{fmt(eq.retailPrice)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── ADD-ONS ──────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Add-Ons & Upgrades
              {option.addOns.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400">({option.addOns.length} &middot; {fmt(aoTotal)})</span>}
            </h4>
            <button onClick={() => toggle('addons')} className="text-sm text-[var(--christmas-green)] hover:text-[var(--christmas-green-dark)] font-medium">
              {openSection === 'addons' ? 'Close' : '+ Add-Ons'}
            </button>
          </div>
          {option.addOns.length > 0 && openSection !== 'addons' && (
            <div className="flex flex-wrap gap-2 mb-3">
              {option.addOns.map(ao => (
                <span key={ao.id} className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                  {ao.imageUrl && <ImagePlaceholder src={ao.imageUrl} alt={ao.name} size={16} className="rounded-full" />}
                  {ao.name} &middot; {fmt(ao.price)}
                  <button onClick={() => toggleAddOn(ao)} className="ml-1 text-green-400 hover:text-red-500">&times;</button>
                </span>
              ))}
            </div>
          )}
          {openSection === 'addons' && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              {addOnCategories.map(cat => (
                <div key={cat} className="mb-4 last:mb-0">
                  <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {addOnsCatalog.filter(a => a.category === cat).map(ao => {
                      const selected = option.addOns.some(a => a.id === ao.id);
                      return (
                        <button key={ao.id} onClick={() => toggleAddOn(ao)}
                          className={`text-left p-3 rounded-lg border transition-all flex gap-3 ${selected ? 'bg-green-50 border-green-300 ring-1 ring-green-300' : 'bg-white border-gray-200 hover:border-[var(--christmas-green)]'}`}>
                          <ImagePlaceholder src={ao.imageUrl} alt={ao.name} size={40} />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <div className="font-medium text-gray-900 text-sm">{ao.name}</div>
                              {ao.popular && <span className="badge bg-amber-50 text-amber-600 text-xs ml-1 flex-shrink-0">Popular</span>}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2">{ao.description}</div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm font-semibold text-gray-900">{fmt(ao.price)}</span>
                              {selected && <span className="text-xs text-green-600 font-medium">Added</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── INSTALL ITEMS ────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Install Materials
              {(option.installItems?.length || 0) > 0 && <span className="ml-2 text-xs font-normal text-gray-400">({option.installItems.length} items &middot; {fmt(installTotal)})</span>}
            </h4>
            <button onClick={() => toggle('install')} className="text-sm text-[var(--christmas-green)] hover:text-[var(--christmas-green-dark)] font-medium">
              {openSection === 'install' ? 'Close' : '+ Materials'}
            </button>
          </div>
          {(option.installItems?.length || 0) > 0 && openSection !== 'install' && (
            <div className="space-y-1 mb-3">
              {option.installItems.map(item => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded text-sm">
                  <span className="text-gray-700">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">x{item.quantity}</span>
                    <span className="font-medium text-gray-900">{fmt(item.unitCost * item.quantity)}</span>
                    <button onClick={() => toggleInstallItem(item)} className="text-gray-400 hover:text-red-500 text-xs">&times;</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {openSection === 'install' && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              {installCategories.map(cat => (
                <div key={cat} className="mb-4 last:mb-0">
                  <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{cat.replace(/\b\w/g, c => c.toUpperCase())}</h5>
                  <div className="space-y-1">
                    {installItemsCatalog.filter(i => i.category === cat).map(item => {
                      const selected = option.installItems?.some(i => i.id === item.id);
                      const current = option.installItems?.find(i => i.id === item.id);
                      return (
                        <div key={item.id} className={`flex items-center justify-between p-2 rounded-lg border transition-all ${selected ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                          <button onClick={() => toggleInstallItem(item)} className="flex-1 text-left">
                            <span className="text-sm text-gray-900">{item.name}</span>
                          </button>
                          <div className="flex items-center gap-2">
                            {selected && (
                              <div className="flex items-center border border-gray-300 rounded">
                                <button onClick={() => updateInstallItemQty(item.id, (current?.quantity || 1) - 1)} className="px-2 py-0.5 text-gray-500 hover:bg-gray-100 text-xs">-</button>
                                <span className="px-2 text-xs font-medium">{current?.quantity || 1}</span>
                                <button onClick={() => updateInstallItemQty(item.id, (current?.quantity || 1) + 1)} className="px-2 py-0.5 text-gray-500 hover:bg-gray-100 text-xs">+</button>
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-900 w-16 text-right">{fmt(item.unitCost)}</span>
                            {selected && <span className="text-xs text-green-600">&#10003;</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── WARRANTIES ───────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Warranty
              {(option.warranties?.length || 0) > 0 && <span className="ml-2 text-xs font-normal text-gray-400">({fmt(warrantyTotal)})</span>}
            </h4>
            <button onClick={() => toggle('warranty')} className="text-sm text-[var(--christmas-green)] hover:text-[var(--christmas-green-dark)] font-medium">
              {openSection === 'warranty' ? 'Close' : '+ Warranty'}
            </button>
          </div>
          {(option.warranties?.length || 0) > 0 && openSection !== 'warranty' && (
            <div className="flex flex-wrap gap-2 mb-3">
              {option.warranties.map(w => (
                <span key={w.id} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                  {w.name} &middot; {w.term} &middot; {fmt(w.price)}
                  <button onClick={() => toggleWarranty(w)} className="ml-1 text-blue-400 hover:text-red-500">&times;</button>
                </span>
              ))}
            </div>
          )}
          {openSection === 'warranty' && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {warrantiesCatalog.map(w => {
                  const selected = option.warranties?.some(ow => ow.id === w.id);
                  return (
                    <button key={w.id} onClick={() => toggleWarranty(w)}
                      className={`text-left p-4 rounded-lg border transition-all ${selected ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-gray-200 hover:border-[var(--christmas-green)]'}`}>
                      <div className="font-medium text-gray-900 text-sm">{w.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{w.description}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="badge bg-gray-100 text-gray-600 text-xs">{w.term}</span>
                        <span className="text-sm font-semibold text-gray-900">{fmt(w.price)}</span>
                      </div>
                      {selected && <div className="text-xs text-blue-600 font-medium mt-1">Added</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── DISCOUNTS ────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Discounts
              {(option.discounts?.length || 0) > 0 && <span className="ml-2 text-xs font-normal text-red-400">(-{fmt(discountTotal)})</span>}
            </h4>
            <button onClick={() => toggle('discount')} className="text-sm text-[var(--christmas-green)] hover:text-[var(--christmas-green-dark)] font-medium">
              {openSection === 'discount' ? 'Close' : '+ Discount'}
            </button>
          </div>
          {(option.discounts?.length || 0) > 0 && openSection !== 'discount' && (
            <div className="flex flex-wrap gap-2 mb-3">
              {option.discounts.map(d => (
                <span key={d.id} className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium">
                  {d.name} &middot; {d.type === 'flat' ? `-${fmt(d.amount)}` : `-${d.amount}%`}
                  <button onClick={() => toggleDiscount(d)} className="ml-1 text-red-400 hover:text-red-600">&times;</button>
                </span>
              ))}
            </div>
          )}
          {openSection === 'discount' && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {discountsCatalog.map(d => {
                  const selected = option.discounts?.some(od => od.id === d.id);
                  return (
                    <button key={d.id} onClick={() => toggleDiscount(d)}
                      className={`text-left p-3 rounded-lg border transition-all ${selected ? 'bg-red-50 border-red-300 ring-1 ring-red-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                      <div className="font-medium text-gray-900 text-sm">{d.name}</div>
                      <div className="text-sm font-semibold text-red-600 mt-1">
                        {d.type === 'flat' ? `-${fmt(d.amount)}` : `-${d.amount}%`}
                      </div>
                      {selected && <div className="text-xs text-red-600 font-medium mt-1">Applied</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── LABOR ────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Labor</label>
          <div className="relative w-48">
            <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              value={option.laborCost || ''}
              onChange={(e) => onUpdate({ ...option, laborCost: Number(e.target.value) || 0 })}
              placeholder="0"
              className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent"
            />
          </div>
        </div>

        {/* ── PRICE BREAKDOWN ──────────────────────────────────── */}
        <div className="border-t border-gray-100 pt-4">
          <div className="space-y-1 text-sm">
            {eqTotal > 0 && <div className="flex justify-between"><span className="text-gray-500">Equipment</span><span className="text-gray-900">{fmt(eqTotal)}</span></div>}
            {aoTotal > 0 && <div className="flex justify-between"><span className="text-gray-500">Add-Ons</span><span className="text-gray-900">{fmt(aoTotal)}</span></div>}
            {installTotal > 0 && <div className="flex justify-between"><span className="text-gray-500">Install Materials</span><span className="text-gray-900">{fmt(installTotal)}</span></div>}
            {warrantyTotal > 0 && <div className="flex justify-between"><span className="text-gray-500">Warranty</span><span className="text-gray-900">{fmt(warrantyTotal)}</span></div>}
            {option.laborCost > 0 && <div className="flex justify-between"><span className="text-gray-500">Labor</span><span className="text-gray-900">{fmt(option.laborCost)}</span></div>}
            {discountTotal > 0 && <div className="flex justify-between text-red-600"><span>Discounts</span><span>-{fmt(discountTotal)}</span></div>}
            <div className="flex justify-between pt-2 border-t border-gray-200 font-bold text-base">
              <span className="text-gray-900">Total</span>
              <span className="text-[var(--christmas-green)]">{fmt(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
