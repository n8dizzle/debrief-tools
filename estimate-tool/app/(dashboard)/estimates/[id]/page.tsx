'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Estimate, Package, getOptionTotal } from '@/types/estimate';
import { getEstimate, saveEstimate, createBlankOption, createOptionFromPackage } from '@/lib/store';
import { equipmentCatalog, addOnsCatalog, installItemsCatalog, warrantiesCatalog, discountsCatalog, packagesCatalog } from '@/lib/catalog';
import OptionBuilder from '@/components/OptionBuilder';
import CustomerInfo from '@/components/CustomerInfo';
import PackageSelector from '@/components/PackageSelector';

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export default function EstimateBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [activeTab, setActiveTab] = useState<'customer' | 'options'>('customer');
  const [showPackages, setShowPackages] = useState(false);

  useEffect(() => {
    const est = getEstimate(params.id as string);
    if (!est) { router.push('/'); return; }
    setEstimate(est);
  }, [params.id, router]);

  function updateEstimate(updates: Partial<Estimate>) {
    if (!estimate) return;
    const updated = { ...estimate, ...updates };
    saveEstimate(updated);
    setEstimate(updated);
  }

  function handleSelectPackage(pkg: Package) {
    if (!estimate) return;
    const newOption = createOptionFromPackage(pkg);
    updateEstimate({ options: [...estimate.options, newOption] });
    setShowPackages(false);
  }

  function handleLoadPackages() {
    if (!estimate) return;
    // Replace the 3 blank options with Good/Better/Best packages
    const goodPkg = packagesCatalog.find(p => p.id === 'pkg-ac-furnace-good');
    const betterPkg = packagesCatalog.find(p => p.id === 'pkg-ac-furnace-better');
    const bestPkg = packagesCatalog.find(p => p.id === 'pkg-ac-furnace-best');
    const newOptions = [
      goodPkg ? createOptionFromPackage(goodPkg) : createBlankOption('Good'),
      betterPkg ? createOptionFromPackage(betterPkg) : createBlankOption('Better'),
      bestPkg ? createOptionFromPackage(bestPkg) : createBlankOption('Best'),
    ];
    updateEstimate({ options: newOptions });
    setShowPackages(false);
  }

  if (!estimate) return null;

  const hasOptions = estimate.options.some(o => o.equipment.length > 0);
  const allBlank = estimate.options.every(o => o.equipment.length === 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-gray-600 transition-colors">&larr; Back</button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{estimate.customerName || 'New Estimate'}</h1>
            <p className="text-sm text-gray-500">{estimate.customerAddress || 'No address yet'}</p>
          </div>
        </div>
        <button
          onClick={() => router.push(`/present/${estimate.id}`)}
          disabled={!hasOptions}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${hasOptions ? 'bg-[var(--christmas-green)] text-white hover:bg-[var(--christmas-green-dark)]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
        >
          Present to Customer
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('customer')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'customer' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >Customer Info</button>
        <button
          onClick={() => setActiveTab('options')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'options' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >Build Options ({estimate.options.length})</button>
      </div>

      {activeTab === 'customer' ? (
        <CustomerInfo estimate={estimate} onChange={(updates) => updateEstimate(updates)} onContinue={() => setActiveTab('options')} />
      ) : (
        <div className="space-y-6">
          {/* Package Quick-Start */}
          {allBlank && !showPackages && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 text-center">
              <h3 className="font-semibold text-gray-900 mb-1">Start with packages?</h3>
              <p className="text-sm text-gray-500 mb-4">Load pre-built Good/Better/Best packages with equipment, materials, warranties, and labor — or build from scratch.</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={handleLoadPackages}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 transition-colors"
                >
                  Load AC + Furnace Packages
                </button>
                <button
                  onClick={() => setShowPackages(true)}
                  className="px-4 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg font-medium text-sm hover:bg-purple-50 transition-colors"
                >
                  Browse All Packages
                </button>
              </div>
            </div>
          )}

          {showPackages && (
            <PackageSelector
              packages={packagesCatalog}
              onSelect={handleSelectPackage}
              onClose={() => setShowPackages(false)}
            />
          )}

          {/* Option Builders */}
          {estimate.options.map((option, idx) => (
            <OptionBuilder
              key={option.id}
              option={option}
              equipmentCatalog={equipmentCatalog}
              addOnsCatalog={addOnsCatalog}
              installItemsCatalog={installItemsCatalog}
              warrantiesCatalog={warrantiesCatalog}
              discountsCatalog={discountsCatalog}
              onUpdate={(updated) => {
                const newOptions = [...estimate.options];
                newOptions[idx] = updated;
                updateEstimate({ options: newOptions });
              }}
              onRemove={estimate.options.length > 1 ? () => {
                updateEstimate({ options: estimate.options.filter((_, i) => i !== idx) });
              } : undefined}
            />
          ))}

          {/* Add buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => updateEstimate({ options: [...estimate.options, createBlankOption(`Option ${estimate.options.length + 1}`)] })}
              className="flex-1 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-[var(--christmas-green)] hover:text-[var(--christmas-green)] transition-colors text-sm font-medium"
            >
              + Add Blank Option
            </button>
            <button
              onClick={() => setShowPackages(true)}
              className="flex-1 py-3 border-2 border-dashed border-purple-300 rounded-xl text-purple-500 hover:border-purple-400 hover:text-purple-600 transition-colors text-sm font-medium"
            >
              + Add from Package
            </button>
          </div>

          {/* Quick Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {estimate.options.map(opt => {
                const total = getOptionTotal(opt);
                return (
                  <div key={opt.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">{opt.label}</div>
                    <div className="text-xl font-bold text-gray-900">{fmt(total)}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {opt.equipment.length} equipment, {opt.addOns.length} add-ons
                      {(opt.installItems?.length || 0) > 0 && `, ${opt.installItems.length} materials`}
                      {(opt.warranties?.length || 0) > 0 && `, ${opt.warranties.length} warranty`}
                      {(opt.discounts?.length || 0) > 0 && `, ${opt.discounts.length} discount`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
