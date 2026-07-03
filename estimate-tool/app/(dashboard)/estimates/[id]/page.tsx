'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Estimate, getOptionTotal } from '@/types/estimate';
import { getEstimate, saveEstimate, createBlankOption } from '@/lib/store';
import { useSystems, TierGroup, SystemOption } from '@/lib/use-systems';
import { TIERS, getTierBullets, TierConfig } from '@/lib/tiers';
import CustomerInfo from '@/components/CustomerInfo';
import SystemConfig, { SystemSetup } from '@/components/SystemConfig';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}
function fmtMo(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function mapFuelType(systemType: string): 'Gas' | 'Electric' | 'Dual Fuel' {
  if (systemType === 'heat-pump' || systemType === 'ac-only') return 'Electric';
  if (systemType === 'dual-fuel') return 'Dual Fuel';
  return 'Gas';
}

// Sortable wrapper
function SortableCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} className="flex-shrink-0 w-64">
      {/* Drag handle is inside the card, listeners go on the handle only */}
      {typeof children === 'function' ? (children as any)(listeners) : children}
    </div>
  );
}

// Wrapper that passes drag listeners
function DraggableCard({ id, children }: { id: string; children: (dragListeners: any) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} className="flex-shrink-0 w-64">
      {children(listeners)}
    </div>
  );
}

type Step = 'customer' | 'config' | 'build';

export default function EstimateBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [step, setStep] = useState<Step>('customer');
  const [systemSetup, setSystemSetup] = useState<SystemSetup | null>(null);
  const [tierGroups, setTierGroups] = useState<TierGroup[]>([]);
  const [selectedSystems, setSelectedSystems] = useState<Record<string, SystemOption>>({});
  const [expandedTier, setExpandedTier] = useState<string | null>(null);
  const [pricingMode, setPricingMode] = useState<'cash' | 'finance'>('cash');
  const [hiddenTiers, setHiddenTiers] = useState<Set<string>>(new Set());
  const [tierOrder, setTierOrder] = useState<string[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const { allSystems, loading, error, filterByTonnageAndFuel } = useSystems();

  useEffect(() => {
    const est = getEstimate(params.id as string);
    if (!est) { router.push('/'); return; }
    setEstimate(est);
    if (est.options.some(o => o.equipment.length > 0)) setStep('build');
    else if (est.stJobId || est.customerName) setStep('config');
  }, [params.id, router]);

  function updateEstimate(updates: Partial<Estimate>) {
    if (!estimate) return;
    const updated = { ...estimate, ...updates };
    saveEstimate(updated);
    setEstimate(updated);
  }

  function handleSystemConfig(setup: SystemSetup) {
    setSystemSetup(setup);
    const fuel = mapFuelType(setup.systemType);
    const groups = filterByTonnageAndFuel(setup.tonnage, fuel);
    setTierGroups(groups);
    setTierOrder(groups.map(g => g.tier));
    setHiddenTiers(new Set());

    const defaults: Record<string, SystemOption> = {};
    for (const group of groups) {
      if (group.defaultSystem) defaults[group.tier] = group.defaultSystem;
    }
    setSelectedSystems(defaults);

    const options = groups.map(group => {
      const sys = group.defaultSystem;
      if (!sys) return createBlankOption(group.tier);
      const option = createBlankOption(group.tier);
      option.equipment = [{
        id: `st-svc-${sys.id}`,
        name: sys.displayName.replace(/^\S+\s*-\s*/, ''),
        brand: sys.brand || 'American Standard',
        model: sys.code,
        type: sys.type === 'HP' ? 'heat-pump' : 'air-conditioner',
        description: sys.description,
        features: [],
        seer: sys.seer,
        retailPrice: sys.price,
        tier: group.tier === 'Builder' ? 'good' : group.tier === 'Silver' ? 'better' : 'best',
        stSkuId: sys.id,
        stCode: sys.code,
      }];
      return option;
    });
    updateEstimate({ options });
    setStep('build');
  }

  function handleSelectSystem(tierName: string, system: SystemOption) {
    setSelectedSystems(prev => ({ ...prev, [tierName]: system }));
    if (!estimate) return;
    const newOptions = estimate.options.map(opt => {
      if (opt.label !== tierName) return opt;
      return { ...opt, equipment: [{
        id: `st-svc-${system.id}`,
        name: system.displayName.replace(/^\S+\s*-\s*/, ''),
        brand: system.brand || 'American Standard',
        model: system.code,
        type: system.type === 'HP' ? 'heat-pump' as const : 'air-conditioner' as const,
        description: system.description,
        features: [],
        seer: system.seer,
        retailPrice: system.price,
        tier: tierName === 'Builder' ? 'good' as const : tierName === 'Silver' ? 'better' as const : 'best' as const,
        stSkuId: system.id,
        stCode: system.code,
      }]};
    });
    updateEstimate({ options: newOptions });
    setExpandedTier(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTierOrder(prev => {
      const oldIdx = prev.indexOf(active.id as string);
      const newIdx = prev.indexOf(over.id as string);
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  function addCustomOption() {
    if (!estimate) return;
    const customLabel = `Custom ${tierGroups.length + 1}`;
    const newOption = createBlankOption(customLabel);
    updateEstimate({ options: [...estimate.options, newOption] });
    const newGroup: TierGroup = {
      tier: customLabel as any,
      seer: 0,
      stage: 'Single-Stage',
      systems: allSystems.filter(s => s.tonnage === (systemSetup?.tonnage || 3) && s.fuelType === mapFuelType(systemSetup?.systemType || 'ac-furnace')),
      defaultSystem: null,
    };
    setTierGroups(prev => [...prev, newGroup]);
    setTierOrder(prev => [...prev, customLabel]);
  }

  if (!estimate) return null;
  const hasOptions = estimate.options.some(o => o.equipment.length > 0);

  // Visible groups in drag order
  const visibleGroups = tierOrder
    .filter(t => !hiddenTiers.has(t))
    .map(t => tierGroups.find(g => g.tier === t))
    .filter(Boolean) as TierGroup[];
  const visibleIds = visibleGroups.map(g => g.tier);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-gray-600">&larr;</button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{estimate.customerName || 'New Estimate'}</h1>
            <p className="text-sm text-gray-500">{estimate.stJobNumber ? `Job #${estimate.stJobNumber} — ` : ''}{estimate.customerAddress}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {step === 'build' && (
            <button onClick={() => setStep('config')} className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Change System</button>
          )}
          <button onClick={() => router.push(`/present/${estimate.id}`)} disabled={!hasOptions}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${hasOptions ? 'bg-[var(--christmas-green)] text-white hover:bg-[var(--christmas-green-dark)]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
            Present to Customer
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {(['customer', 'config', 'build'] as Step[]).map(s => (
          <button key={s} onClick={() => setStep(s)}
            className={`px-4 py-2 rounded-md text-sm font-medium ${step === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            {s === 'customer' ? 'Customer' : s === 'config' ? 'System' : 'Build Options'}
          </button>
        ))}
      </div>

      {step === 'customer' && <CustomerInfo estimate={estimate} onChange={updateEstimate} onContinue={() => setStep('config')} />}

      {step === 'config' && (
        <div>
          {loading && <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700 mb-6">Loading pricebook systems...</div>}
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-6">{error}</div>}
          {!loading && <div className="text-xs text-gray-400 mb-4">{allSystems.length} AHRI-matched systems loaded</div>}
          <SystemConfig onConfigure={handleSystemConfig} initial={systemSetup || undefined} />
        </div>
      )}

      {step === 'build' && (
        <div>
          {/* Cash / Finance Toggle */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-full">
              <button onClick={() => setPricingMode('cash')} className={`px-4 py-1.5 rounded-full text-sm font-medium ${pricingMode === 'cash' ? 'bg-[var(--christmas-green)] text-white' : 'text-gray-600'}`}>Cash Price</button>
              <button onClick={() => setPricingMode('finance')} className={`px-4 py-1.5 rounded-full text-sm font-medium ${pricingMode === 'finance' ? 'bg-[var(--christmas-green)] text-white' : 'text-gray-600'}`}>Monthly Payment</button>
            </div>
            {systemSetup && <span className="text-sm text-gray-400">{systemSetup.tonnage} Ton | {systemSetup.systemType.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>}
          </div>

          {/* Hidden tiers */}
          {hiddenTiers.size > 0 && (
            <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
              <span>Hidden:</span>
              {Array.from(hiddenTiers).map(t => (
                <button key={t} onClick={() => setHiddenTiers(prev => { const n = new Set(prev); n.delete(t); return n; })}
                  className="px-2 py-1 bg-gray-100 rounded text-xs font-medium hover:bg-gray-200">+ {t}</button>
              ))}
            </div>
          )}

          {tierGroups.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
              <p className="text-amber-700">No systems found. Try a different tonnage or fuel type.</p>
              <button onClick={() => setStep('config')} className="mt-3 text-sm text-amber-600 underline">Change System Config</button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={visibleIds} strategy={horizontalListSortingStrategy}>
                <div className="flex gap-4 items-stretch overflow-x-auto pb-2">
                  {visibleGroups.map(group => {
                    const selected = selectedSystems[group.tier] || group.defaultSystem;
                    const tierConfig = TIERS.find(t => t.name === group.tier) || TIERS[0];
                    const bullets = getTierBullets(tierConfig);
                    const price = selected?.price || 0;
                    const totalPrice = price * (systemSetup?.systemCount || 1);
                    const monthly = totalPrice > 0 ? totalPrice / 60 : 0;
                    const isExpanded = expandedTier === group.tier;
                    const systemName = selected ? selected.displayName.replace(/^\S+\s*-\s*/, '') : '';

                    return (
                      <DraggableCard key={group.tier} id={group.tier}>
                        {(dragListeners: any) => (
                          <div className={`rounded-2xl border-2 ${tierConfig.borderColor} bg-white flex flex-col h-full relative`}>
                            {/* Drag Handle */}
                            <div {...dragListeners} className="absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-1" title="Drag to reorder">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="4" r="2"/><circle cx="16" cy="4" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="20" r="2"/><circle cx="16" cy="20" r="2"/></svg>
                            </div>
                            {/* Remove X */}
                            <button onClick={() => setHiddenTiers(prev => new Set(prev).add(group.tier))}
                              className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-white/80 border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 flex items-center justify-center text-xs transition-colors">
                              &times;
                            </button>
                            {/* Header */}
                            <div className={`rounded-t-xl px-4 py-3 text-center ${tierConfig.bgColor}`} style={{ borderBottom: `3px solid ${tierConfig.color}` }}>
                              <input
                                type="text"
                                value={group.tier}
                                onChange={(e) => {
                                  const oldName = group.tier;
                                  const newName = e.target.value;
                                  setTierGroups(prev => prev.map(g => g.tier === oldName ? { ...g, tier: newName as any } : g));
                                  setTierOrder(prev => prev.map(t => t === oldName ? newName : t));
                                  if (hiddenTiers.has(oldName)) {
                                    setHiddenTiers(prev => { const n = new Set(prev); n.delete(oldName); n.add(newName); return n; });
                                  }
                                  if (selectedSystems[oldName]) {
                                    setSelectedSystems(prev => { const n = { ...prev }; n[newName] = n[oldName]; delete n[oldName]; return n; });
                                  }
                                  if (estimate) {
                                    const newOptions = estimate.options.map(o => o.label === oldName ? { ...o, label: newName } : o);
                                    updateEstimate({ options: newOptions });
                                  }
                                }}
                                className={`text-lg font-bold bg-transparent border-none text-center w-full focus:ring-0 focus:outline-none p-0 ${tierConfig.textColor}`}
                              />
                              <div className="text-xs text-gray-500">{group.seer} SEER | {group.stage}</div>
                            </div>
                            {/* Photo */}
                            <div className="px-4 pt-4 flex justify-center">
                              <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center"><span className="text-3xl text-gray-300">&#10052;</span></div>
                            </div>
                            {/* Name */}
                            <div className="px-3 pt-2 text-center">
                              <div className="font-bold text-gray-900 text-sm leading-tight">{systemName}</div>
                              {selected && <div className="text-xs text-gray-400 mt-0.5">{selected.code}</div>}
                              <div className="text-xs text-blue-600 mt-0.5">{group.systems.length} matchup{group.systems.length !== 1 ? 's' : ''}</div>
                            </div>
                            {/* Price */}
                            <div className="px-4 pt-3 text-center">
                              {pricingMode === 'cash' ? (
                                <><div className="text-2xl font-black text-gray-900">{fmt(totalPrice)}</div><div className="text-xs text-gray-400">Installed Price</div></>
                              ) : (
                                <><div className="text-2xl font-black text-[var(--christmas-green)]">{fmtMo(monthly)}<span className="text-sm">/mo</span></div><div className="text-xs text-gray-400">{tierConfig.financing[0]}</div></>
                              )}
                            </div>
                            {/* Bullets */}
                            <div className="px-3 pt-3 flex-1">
                              <ul className="space-y-1.5">
                                {bullets.map((b, i) => (
                                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                                    <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white mt-0.5" style={{ backgroundColor: tierConfig.color, fontSize: '8px' }}>&#10003;</span>
                                    <span className="leading-tight">{b}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            {/* Badges */}
                            <div className="px-3 pt-3 pb-2">
                              <div className="flex flex-wrap gap-1">
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{tierConfig.laborWarranty} Labor</span>
                                <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium">{tierConfig.noiseLevel}</span>
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium">{tierConfig.coolingSavings}</span>
                              </div>
                            </div>
                            {/* Swap */}
                            <div className="px-3 py-2 border-t border-gray-100">
                              <button onClick={() => setExpandedTier(isExpanded ? null : group.tier)}
                                className="w-full py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                                {isExpanded ? 'Close' : 'Swap Matchup'} ({group.systems.length})
                              </button>
                            </div>
                            {isExpanded && (
                              <div className="border-t border-gray-200 bg-gray-50 px-3 py-3 rounded-b-xl max-h-56 overflow-y-auto">
                                <div className="space-y-1.5">
                                  {group.systems.map(sys => (
                                    <button key={sys.id} onClick={() => handleSelectSystem(group.tier, sys)}
                                      className={`w-full text-left p-2 rounded-lg border text-xs ${selected?.id === sys.id ? 'border-green-400 bg-green-50 ring-1 ring-green-300' : 'border-gray-100 bg-white hover:border-gray-300'}`}>
                                      <div className="font-medium text-gray-900 leading-tight">{sys.displayName.replace(/^\S+\s*-\s*/, '')}</div>
                                      <div className="flex justify-between mt-1">
                                        <span className="text-gray-400">{sys.code}</span>
                                        <span className="font-semibold text-gray-700">{fmt(sys.price)}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </DraggableCard>
                    );
                  })}

                  {/* Add option */}
                  <div className="flex-shrink-0 w-48 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center min-h-[400px] gap-3">
                    {hiddenTiers.size > 0 && (
                      <div className="space-y-2 mb-2">
                        {Array.from(hiddenTiers).map(t => (
                          <button key={t} onClick={() => setHiddenTiers(prev => { const n = new Set(prev); n.delete(t); return n; })}
                            className="w-full px-3 py-2 bg-gray-50 rounded-lg text-xs font-medium text-gray-600 hover:bg-green-50 hover:text-green-700 border border-gray-200 hover:border-green-300 transition-colors">
                            + {t}
                          </button>
                        ))}
                        <div className="border-t border-gray-200 pt-2 mt-2" />
                      </div>
                    )}
                    <button onClick={addCustomOption} className="text-gray-400 hover:text-[var(--christmas-green)] transition-colors text-center">
                      <div className="text-3xl mb-1">+</div>
                      <div className="text-xs font-medium">Add Option</div>
                    </button>
                  </div>
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Summary Bar */}
          {tierGroups.length > 0 && (
            <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div className="flex gap-4">
                {visibleGroups.map(group => {
                  const selected = selectedSystems[group.tier] || group.defaultSystem;
                  const tierConfig = TIERS.find(t => t.name === group.tier) || TIERS[0];
                  const totalPrice = (selected?.price || 0) * (systemSetup?.systemCount || 1);
                  return (
                    <div key={group.tier} className="text-center">
                      <div className={`text-xs font-semibold ${tierConfig.textColor}`}>{group.tier}</div>
                      <div className="font-bold text-gray-900">{fmt(totalPrice)}</div>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => router.push(`/present/${estimate.id}`)} disabled={!hasOptions}
                className={`px-6 py-3 rounded-xl font-semibold text-sm ${hasOptions ? 'bg-[var(--christmas-green)] text-white hover:bg-[var(--christmas-green-dark)]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                Present to Customer &rarr;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
