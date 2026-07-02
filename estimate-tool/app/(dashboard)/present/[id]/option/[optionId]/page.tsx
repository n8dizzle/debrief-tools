'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Estimate, EstimateOption, AddOn, getOptionTotal, getMonthlyPayment,
  getInstallItemsTotal, getWarrantiesTotal, getDiscountsTotal,
} from '@/types/estimate';
import { getEstimate, saveEstimate } from '@/lib/store';
import { financingTerms, addOnsCatalog } from '@/lib/catalog';
import ImagePlaceholder from '@/components/ImagePlaceholder';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function getStageLabel(opt: EstimateOption): string {
  const ac = opt.equipment.find(e => e.type === 'air-conditioner' || e.type === 'heat-pump');
  if (!ac) return '';
  if (ac.features.some(f => f.toLowerCase().includes('inverter'))) return 'Variable-speed';
  if (ac.features.some(f => f.toLowerCase().includes('two-stage'))) return 'Two-stage';
  return 'Single-stage';
}

function getSystemDescription(opt: EstimateOption): string {
  const ac = opt.equipment.find(e => e.type === 'air-conditioner' || e.type === 'heat-pump');
  const furnace = opt.equipment.find(e => e.type === 'furnace');
  let desc = '';
  if (ac?.seer) {
    if (ac.features.some(f => f.toLowerCase().includes('inverter'))) {
      desc += `An inverter-driven system is the pinnacle of home comfort. At ${ac.seer} SEER2, the ${ac.brand} ${ac.model} continuously adjusts its output to match your home\u2019s exact cooling needs \u2014 no more blasting on and off. The result is whisper-quiet operation, remarkably even temperatures in every room, and the lowest energy bills possible.\n\nThe variable-speed technology means your system runs at low capacity most of the time, dehumidifying your home better than any single or two-stage system. In the Texas heat, that means your home feels comfortable at a higher thermostat setting \u2014 saving you even more.`;
    } else if (ac.features.some(f => f.toLowerCase().includes('two-stage'))) {
      desc += `A two-stage system has two speeds \u2014 a low stage for mild days and a high stage for peak heat. At ${ac.seer} SEER2, the ${ac.brand} ${ac.model} runs on low most of the time, which means quieter operation, lower bills, and more even temperatures throughout your home.\n\nFor North Texas homes, the low stage helps reduce the temperature gap between floors, so your upstairs stays more comfortable. This is the most popular choice in the Denton area.`;
    } else {
      desc += `The ${ac.brand} ${ac.model} is a reliable, proven system that gets the job done. At ${ac.seer} SEER2, it meets current federal efficiency standards and provides dependable cooling for your home.\n\nSingle-stage systems are straightforward \u2014 they run at full capacity when cooling is needed and shut off when your home reaches temperature. A solid choice for homeowners who want reliable comfort at the best price.`;
    }
  }
  if (furnace?.afue) {
    desc += `\n\nPaired with the ${furnace.brand} ${furnace.model} furnace at ${furnace.afue}% AFUE, `;
    if (furnace.afue >= 96) desc += 'virtually every dollar you spend on gas goes directly to heating your home. The variable-speed blower circulates air gently and continuously, eliminating hot and cold spots.';
    else if (furnace.afue >= 90) desc += 'you get high-efficiency heating that keeps more of your energy dollars working for you.';
    else desc += 'you get dependable heating at an affordable price point.';
  }
  return desc;
}

function getWhyTitle(opt: EstimateOption): string {
  const ac = opt.equipment.find(e => e.type === 'air-conditioner' || e.type === 'heat-pump');
  if (!ac) return 'the right fit';
  if (ac.features.some(f => f.toLowerCase().includes('inverter'))) return 'variable-speed is the ultimate comfort';
  if (ac.features.some(f => f.toLowerCase().includes('two-stage'))) return 'two-stage is the right fit';
  return 'this system gets the job done';
}

const comparisonRows = [
  { label: 'Noise Level', values: { 'Single-stage': 'Standard', 'Two-stage': 'Quieter', 'Variable-speed': 'Whisper-quiet' } },
  { label: 'Est. Monthly Bill', values: { 'Single-stage': '$$$', 'Two-stage': '$$', 'Variable-speed': '$' } },
  { label: 'Humidity Control', values: { 'Single-stage': 'Basic', 'Two-stage': 'Good', 'Variable-speed': 'Excellent' } },
  { label: 'Warranty', values: { 'Single-stage': '10-yr Parts', 'Two-stage': '10-yr Parts', 'Variable-speed': 'Lifetime Compressor' } },
];
const comparisonCols = ['Single-stage', 'Two-stage', 'Variable-speed'] as const;

const recentReviews = [
  { name: 'Mike R.', location: 'Denton, TX', rating: 5, text: 'Christmas Air replaced our entire system in one day. The crew was professional, clean, and explained everything. Our house has never been this comfortable.', date: 'March 2026' },
  { name: 'Sarah T.', location: 'Corinth, TX', rating: 5, text: 'Scott and his team went above and beyond. They found issues the other company missed and gave us honest pricing. Highly recommend!', date: 'February 2026' },
  { name: 'David & Lisa K.', location: 'Argyle, TX', rating: 5, text: 'We had 3 quotes and Christmas Air was the most thorough. They took the time to explain the differences between systems. Best decision we made.', date: 'January 2026' },
];

const photoTabs = ['Unit', 'Install', 'Coil', 'Tstat', 'Data'];

export default function OptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [option, setOption] = useState<EstimateOption | null>(null);
  const [selectedTerm, setSelectedTerm] = useState(financingTerms[2].id);
  const [activePhotoTab, setActivePhotoTab] = useState(0);
  const [extraAddOns, setExtraAddOns] = useState<AddOn[]>([]);

  useEffect(() => {
    const est = getEstimate(params.id as string);
    if (!est) { router.push('/'); return; }
    const opt = est.options.find(o => o.id === params.optionId);
    if (!opt) { router.push(`/present/${params.id}`); return; }
    setEstimate(est);
    setOption(opt);
    setExtraAddOns([]);
  }, [params.id, params.optionId, router]);

  function toggleExtraAddOn(ao: AddOn) {
    setExtraAddOns(prev => {
      const exists = prev.some(a => a.id === ao.id);
      return exists ? prev.filter(a => a.id !== ao.id) : [...prev, ao];
    });
  }

  function handleAccept() {
    if (!estimate || !option) return;
    // Save with any extra add-ons the customer selected
    const updatedOption = { ...option, addOns: [...option.addOns, ...extraAddOns] };
    const updatedOptions = estimate.options.map(o => o.id === option.id ? updatedOption : o);
    const updated = { ...estimate, options: updatedOptions, selectedOptionId: option.id, status: 'accepted' as const };
    saveEstimate(updated);
    setEstimate(updated);
    setOption(updatedOption);
    setExtraAddOns([]);
  }

  if (!estimate || !option) return null;

  const baseTotal = getOptionTotal(option);
  const extraAddOnTotal = extraAddOns.reduce((sum, ao) => sum + ao.price, 0);
  const total = baseTotal + extraAddOnTotal;
  const activeTerm = financingTerms.find(t => t.id === selectedTerm) || financingTerms[2];
  const monthly = getMonthlyPayment(total, activeTerm);
  const baseMonthly = getMonthlyPayment(baseTotal, activeTerm);
  const installTotal = getInstallItemsTotal(option.installItems || []);
  const warrantyTotal = getWarrantiesTotal(option.warranties || []);
  const discountTotal = getDiscountsTotal(option.discounts || [], total);
  const availableAddOns = addOnsCatalog.filter(ao => !option.addOns.some(e => e.id === ao.id));
  const stageLabel = getStageLabel(option);
  const primaryEquip = option.equipment.find(e => e.type === 'air-conditioner' || e.type === 'heat-pump');

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-warm)' }}>
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b" style={{ background: 'var(--bg-warm)', borderColor: 'var(--border-warm)' }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/present/${estimate.id}`)} className="text-sm hover:opacity-70 transition-opacity" style={{ color: 'var(--text-warm-muted)' }}>&larr;</button>
            <span className="text-sm" style={{ color: 'var(--text-warm-secondary)' }}>
              Presented by <span style={{ color: 'var(--text-warm)' }} className="font-medium">{estimate.advisorName || 'Your Advisor'}</span> &middot; Comfort Advisor
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-warm-alt)', color: 'var(--text-warm-muted)' }}>#{estimate.id.slice(0, 8).toUpperCase()}</span>
            <button className="text-sm font-medium" style={{ color: 'var(--christmas-green)' }}>Share with homeowner</button>
          </div>
        </div>
      </header>

      {/* ── Two-Column Layout ───────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-8">

          {/* ══ LEFT: Scrolling Content ══════════════════════════ */}
          <div className="flex-1 min-w-0 max-w-2xl">

            {/* ── 1. System Details ──────────────────────────────── */}
            <section>
              {/* Hero product image */}
              <div className="rounded-2xl relative overflow-hidden" style={{ background: 'var(--bg-warm-alt)', aspectRatio: '16/9' }}>
                <div className="absolute top-4 left-4 flex gap-2 z-10">
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-full text-white" style={{ background: 'var(--christmas-green)' }}>Recommended for your home</span>
                  {primaryEquip?.seer && (
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-warm)', border: '1px solid var(--border-warm)' }}>{primaryEquip.seer} SEER2</span>
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImagePlaceholder src={primaryEquip?.imageUrl} alt={primaryEquip?.name || 'System'} size={200} className="rounded-xl" />
                </div>
              </div>

              {/* Photo tabs */}
              <div className="flex gap-2 mt-3">
                {photoTabs.map((tab, i) => (
                  <button key={tab} onClick={() => setActivePhotoTab(i)} className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{ background: activePhotoTab === i ? 'var(--christmas-green)' : 'var(--bg-warm-alt)', color: activePhotoTab === i ? '#fff' : 'var(--text-warm-secondary)' }}>
                    {tab}
                  </button>
                ))}
              </div>

              {/* Brand tags */}
              <div className="flex flex-wrap gap-2 mt-4">
                {primaryEquip && (
                  <>
                    <span className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: 'var(--bg-warm-alt)', color: 'var(--text-warm-secondary)' }}>{primaryEquip.brand}</span>
                    <span className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: 'var(--bg-warm-alt)', color: 'var(--text-warm-secondary)' }}>{stageLabel}</span>
                    <span className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: 'var(--bg-mint)', color: 'var(--christmas-green)' }}>Most chosen in Denton</span>
                  </>
                )}
              </div>

              {/* Headline */}
              <h1 className="font-serif text-3xl sm:text-4xl italic leading-tight mt-8" style={{ color: 'var(--text-warm)' }}>
                {option.label} system, sized for your home.
              </h1>
              <p className="mt-3 text-base leading-relaxed" style={{ color: 'var(--text-warm-secondary)' }}>
                Quieter, smarter, more efficient. Installed by <strong>Christmas Air</strong>, serving Denton homeowners.
              </p>
              <div className="flex items-center gap-4 mt-4 text-sm" style={{ color: 'var(--text-warm-secondary)' }}>
                <span className="flex items-center gap-1">
                  <span className="text-amber-500">{'\u2605'.repeat(5)}</span>
                  <span className="font-medium" style={{ color: 'var(--text-warm)' }}>4.9</span>
                  <span>(500+ reviews)</span>
                </span>
                <span>&middot;</span>
                <span>1,200+ installs near you</span>
              </div>

              {/* Why this system */}
              <div className="mt-12">
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--text-warm-muted)' }}>Why this system for your home</div>
                <h2 className="font-serif text-2xl sm:text-3xl italic leading-tight mb-4" style={{ color: 'var(--text-warm)' }}>Why {getWhyTitle(option)}</h2>
                <div className="flex flex-wrap gap-2 mb-6">
                  {['DFW Climate', 'Gas Furnace', 'Central Air', '2-Story Home'].map(tag => (
                    <span key={tag} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: '1px solid var(--border-warm)', color: 'var(--text-warm-secondary)' }}>{tag}</span>
                  ))}
                </div>
                <div className="space-y-4">
                  {getSystemDescription(option).split('\n\n').map((para, i) => (
                    <p key={i} className="text-[15px] leading-relaxed" style={{ color: 'var(--text-warm-secondary)' }}>{para}</p>
                  ))}
                </div>

                {/* Equipment cards */}
                <div className="mt-8 space-y-3">
                  {option.equipment.map((eq, idx) => (
                    <div key={`${eq.id}-${idx}`} className="rounded-xl border p-5 flex gap-4" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-warm)' }}>
                      <ImagePlaceholder src={eq.imageUrl} alt={eq.name} size={72} className="rounded-lg" />
                      <div className="flex-1">
                        <h4 className="font-semibold" style={{ color: 'var(--text-warm)' }}>{eq.name}</h4>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-warm-muted)' }}>{eq.brand} {eq.model}</p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mt-3">
                          {eq.seer && <div className="flex justify-between"><span style={{ color: 'var(--text-warm-muted)' }}>Efficiency</span><span className="font-medium" style={{ color: 'var(--text-warm)' }}>{eq.seer} SEER2</span></div>}
                          {eq.afue && <div className="flex justify-between"><span style={{ color: 'var(--text-warm-muted)' }}>Efficiency</span><span className="font-medium" style={{ color: 'var(--text-warm)' }}>{eq.afue}% AFUE</span></div>}
                          {eq.tons && <div className="flex justify-between"><span style={{ color: 'var(--text-warm-muted)' }}>Capacity</span><span className="font-medium" style={{ color: 'var(--text-warm)' }}>{eq.tons} Ton</span></div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comparison table */}
                <div className="mt-10 rounded-xl border overflow-hidden" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-warm)' }}>
                  <div className="grid grid-cols-4 text-xs font-semibold uppercase tracking-wider">
                    <div className="px-4 py-3" style={{ color: 'var(--text-warm-muted)', borderBottom: '1px solid var(--border-warm)' }} />
                    {comparisonCols.map(col => (
                      <div key={col} className="px-4 py-3 text-center" style={{ background: col === stageLabel ? 'var(--bg-mint)' : 'transparent', color: col === stageLabel ? 'var(--christmas-green)' : 'var(--text-warm-muted)', borderBottom: '1px solid var(--border-warm)' }}>
                        {col}
                        {col === stageLabel && <span className="block text-[9px] mt-0.5 font-normal normal-case tracking-normal">Your system</span>}
                      </div>
                    ))}
                  </div>
                  {comparisonRows.map((row, ri) => (
                    <div key={ri} className="grid grid-cols-4 text-sm" style={{ borderBottom: ri < comparisonRows.length - 1 ? '1px solid var(--border-warm)' : 'none' }}>
                      <div className="px-4 py-3 font-medium" style={{ color: 'var(--text-warm)' }}>{row.label}</div>
                      {comparisonCols.map(col => (
                        <div key={col} className="px-4 py-3 text-center" style={{ background: col === stageLabel ? 'var(--bg-mint)' : 'transparent', color: col === stageLabel ? 'var(--christmas-green)' : 'var(--text-warm-secondary)', fontWeight: col === stageLabel ? 600 : 400 }}>
                          {row.values[col]}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <hr className="my-12" style={{ borderColor: 'var(--border-warm)' }} />

            {/* ── 2. Scope of Install ────────────────────────────── */}
            <section>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--text-warm-muted)' }}>What&apos;s included</div>
              <h2 className="font-serif text-2xl sm:text-3xl italic leading-tight mb-2" style={{ color: 'var(--text-warm)' }}>Your complete install package</h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-warm-secondary)' }}>Everything needed for a professional installation \u2014 no surprises.</p>

              {/* Install items by category */}
              {option.installItems && option.installItems.length > 0 && (
                <div className="rounded-xl border p-5 mb-6" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-warm)' }}>
                  <h4 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-warm)' }}>Install Materials ({option.installItems.length} items &middot; {fmt(installTotal)})</h4>
                  {Array.from(new Set(option.installItems.map(i => i.category))).map(cat => (
                    <div key={cat} className="mb-4 last:mb-0">
                      <h5 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-warm-muted)' }}>{cat.replace(/\b\w/g, c => c.toUpperCase())}</h5>
                      <div className="space-y-1">
                        {option.installItems.filter(i => i.category === cat).map(item => (
                          <div key={item.id} className="flex items-center gap-3 py-1">
                            <span style={{ color: 'var(--christmas-green)' }}>{'\u2713'}</span>
                            <span className="text-sm flex-1" style={{ color: 'var(--text-warm-secondary)' }}>{item.name}</span>
                            {item.quantity > 1 && <span className="text-xs" style={{ color: 'var(--text-warm-muted)' }}>x{item.quantity}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Warranties */}
              {option.warranties && option.warranties.length > 0 && (
                <div className="rounded-xl border p-5 mb-6" style={{ background: 'var(--bg-mint)', borderColor: 'var(--christmas-green)', borderWidth: '1px' }}>
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--christmas-green)' }}>
                    {'\u2605'} Warranty Coverage ({fmt(warrantyTotal)})
                  </h4>
                  <div className="space-y-3">
                    {option.warranties.map(w => (
                      <div key={w.id} className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-xs" style={{ background: 'var(--christmas-green)' }}>{w.term.split(' ')[0]}</div>
                        <div>
                          <div className="font-semibold text-sm" style={{ color: 'var(--text-warm)' }}>{w.name}</div>
                          <div className="text-xs" style={{ color: 'var(--text-warm-secondary)' }}>{w.description}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-warm-muted)' }}>Covers: {w.coverage}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Standard install includes */}
              <div className="rounded-xl border p-5" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-warm)' }}>
                <h4 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-warm)' }}>Every Christmas Air install includes:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {['Licensed, background-checked technicians', 'City permit & inspection', 'Old equipment removal & recycling', 'System commissioning & testing', 'Homeowner walkthrough & training', 'Photo documentation of install', 'Registered manufacturer warranty', 'Next-day follow-up call'].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-warm-secondary)' }}>
                      <span style={{ color: 'var(--christmas-green)' }}>{'\u2713'}</span>{item}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <hr className="my-12" style={{ borderColor: 'var(--border-warm)' }} />

            {/* ── 3. Add-Ons (Interactive) ────────────────────────── */}
            {availableAddOns.length > 0 && (
              <section>
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--text-warm-muted)' }}>Upgrades</div>
                <h2 className="font-serif text-2xl sm:text-3xl italic leading-tight mb-2" style={{ color: 'var(--text-warm)' }}>Upgrades to consider</h2>
                <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--text-warm-secondary)' }}>Tap any add-on to include it in your quote. Your price updates instantly.</p>
                {extraAddOns.length > 0 && (
                  <div className="rounded-lg px-4 py-2.5 mb-4 flex items-center justify-between" style={{ background: 'var(--bg-mint)' }}>
                    <span className="text-sm font-medium" style={{ color: 'var(--christmas-green)' }}>
                      {extraAddOns.length} upgrade{extraAddOns.length !== 1 ? 's' : ''} added
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'var(--christmas-green)' }}>+{fmt(extraAddOnTotal)}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableAddOns.slice(0, 8).map(ao => {
                    const isSelected = extraAddOns.some(a => a.id === ao.id);
                    return (
                      <button
                        key={ao.id}
                        onClick={() => toggleExtraAddOn(ao)}
                        className="rounded-xl border p-4 flex gap-3 transition-all text-left"
                        style={{
                          background: isSelected ? 'var(--bg-mint)' : 'var(--bg-primary)',
                          borderColor: isSelected ? 'var(--christmas-green)' : 'var(--border-warm)',
                          borderWidth: isSelected ? '2px' : '1px',
                        }}
                      >
                        <div className="relative flex-shrink-0">
                          <ImagePlaceholder src={ao.imageUrl} alt={ao.name} size={52} className="rounded-lg" />
                          {isSelected && (
                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ background: 'var(--christmas-green)' }}>{'\u2713'}</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-sm" style={{ color: 'var(--text-warm)' }}>{ao.name}</h4>
                            {ao.popular && !isSelected && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--bg-mint)', color: 'var(--christmas-green)' }}>Popular</span>}
                            {isSelected && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--christmas-green)', color: '#fff' }}>Added</span>}
                          </div>
                          <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-warm-muted)' }}>{ao.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm font-bold" style={{ color: isSelected ? 'var(--christmas-green)' : 'var(--text-warm)' }}>+{fmt(ao.price)}</span>
                            {isSelected && (
                              <span className="text-xs" style={{ color: 'var(--text-warm-muted)' }}>
                                (+{fmt(Math.round(getMonthlyPayment(ao.price, activeTerm)))}/mo)
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <hr className="my-12" style={{ borderColor: 'var(--border-warm)' }} />

            {/* ── 4. Trust / About Us ────────────────────────────── */}
            <section>
              <h2 className="font-serif text-2xl sm:text-3xl italic leading-tight" style={{ color: 'var(--text-warm)' }}>Family-owned, Denton-based, since 2018.</h2>

              {/* Founder quote */}
              <div className="mt-6 rounded-xl border p-6" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-warm)' }}>
                <div className="flex gap-4 items-start">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-lg" style={{ background: 'var(--christmas-green)' }}>ST</div>
                  <div>
                    <p className="text-[15px] leading-relaxed italic" style={{ color: 'var(--text-warm-secondary)' }}>
                      &ldquo;I started Christmas Air because I wanted to build the kind of company I&apos;d want to hire for my own home. No gimmicks, no pressure &mdash; just honest work and fair prices. Every system we install, I treat like it&apos;s going in my mom&apos;s house.&rdquo;
                    </p>
                    <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-warm)' }}>Scott Titensor, Founder</p>
                    <p className="text-xs" style={{ color: 'var(--text-warm-muted)' }}>Christmas Air Conditioning &amp; Plumbing</p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                {[{ value: '7+', label: 'Years in business' }, { value: '1,200+', label: 'Homes served' }, { value: 'A+', label: 'BBB rating' }, { value: '0', label: 'Subcontractors' }].map((stat, i) => (
                  <div key={i} className="rounded-xl border p-4 text-center" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-warm)' }}>
                    <div className="text-2xl font-bold" style={{ color: 'var(--text-warm)' }}>{stat.value}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-warm-muted)' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Video placeholder */}
              <div className="mt-6 rounded-xl border overflow-hidden" style={{ background: 'var(--bg-warm-alt)', borderColor: 'var(--border-warm)', aspectRatio: '16/9' }}>
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--christmas-green)' }}>
                      <span className="text-white text-2xl">{'\u25B6'}</span>
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-warm-secondary)' }}>Meet the team behind your install</p>
                  </div>
                </div>
              </div>

              {/* Reviews */}
              <div className="mt-8 space-y-3">
                {recentReviews.map((review, i) => (
                  <div key={i} className="rounded-xl border p-5" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-warm)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-amber-500 text-sm">{'\u2605'.repeat(review.rating)}</span>
                      <span className="text-xs" style={{ color: 'var(--text-warm-muted)' }}>{review.date}</span>
                    </div>
                    <p className="text-[15px] leading-relaxed mb-2" style={{ color: 'var(--text-warm-secondary)' }}>&ldquo;{review.text}&rdquo;</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-warm)' }}>{review.name}</span>
                      <span className="text-xs" style={{ color: 'var(--text-warm-muted)' }}>{review.location}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── 5. Guarantee ────────────────────────────────────── */}
            <section className="mt-12 mb-8">
              <div className="rounded-2xl p-8" style={{ background: 'var(--christmas-green)' }}>
                <h3 className="font-serif text-xl italic text-white mb-2">Your Christmas Air Guarantee</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  If you&apos;re not 100% satisfied within 12 months, we&apos;ll make it right or remove the system and refund your money. That&apos;s not a gimmick &mdash; it&apos;s how we do business. We stand behind every install because we live here too.
                </p>
              </div>
            </section>
          </div>

          {/* ══ RIGHT: Sticky Option Card ════════════════════════ */}
          <div className="hidden lg:block w-[360px] flex-shrink-0">
            <div className="sticky top-16 space-y-4">

              {/* Price Card */}
              <div className="rounded-2xl border p-6" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-warm)' }}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-1" style={{ color: 'var(--text-warm-muted)' }}>Your Monthly Payment</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black" style={{ color: 'var(--text-warm)' }}>{fmt(Math.round(monthly))}</span>
                  <span className="text-lg" style={{ color: 'var(--text-warm-muted)' }}>/mo</span>
                </div>
                <div className="text-sm" style={{ color: 'var(--text-warm-muted)' }}>
                  {fmt(total)} total
                  {discountTotal > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'var(--bg-mint)', color: 'var(--christmas-green)' }}>Save {fmt(discountTotal)}</span>
                  )}
                </div>
                {extraAddOns.length > 0 && (
                  <div className="mt-2 rounded-lg px-3 py-2" style={{ background: 'var(--bg-mint)' }}>
                    <div className="flex items-center justify-between text-xs font-medium" style={{ color: 'var(--christmas-green)' }}>
                      <span>Base quote</span><span>{fmt(baseTotal)}</span>
                    </div>
                    {extraAddOns.map(ao => (
                      <div key={ao.id} className="flex items-center justify-between text-xs mt-1" style={{ color: 'var(--christmas-green)' }}>
                        <span>+ {ao.name}</span><span>+{fmt(ao.price)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs font-bold mt-1 pt-1" style={{ color: 'var(--christmas-green)', borderTop: '1px solid var(--christmas-green)', borderTopColor: 'rgba(27,77,62,0.2)' }}>
                      <span>New total</span><span>{fmt(total)}</span>
                    </div>
                  </div>
                )}

                {/* Payment term */}
                <div className="mt-5 mb-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--text-warm-muted)' }}>Payment Term</div>
                  <div className="grid grid-cols-3 gap-2">
                    {financingTerms.filter(t => t.id !== 'promo-0').map(term => (
                      <button key={term.id} onClick={() => setSelectedTerm(term.id)}
                        className="py-2.5 rounded-lg text-center transition-all"
                        style={{ background: selectedTerm === term.id ? 'var(--christmas-green)' : 'var(--bg-warm-alt)', color: selectedTerm === term.id ? '#fff' : 'var(--text-warm-secondary)', fontWeight: selectedTerm === term.id ? 600 : 400 }}>
                        <div className="text-sm">{Math.floor(term.months / 12)} yrs</div>
                        <div className="text-xs opacity-80">{term.apr}% APR</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quote includes */}
                <div className="pt-5 mb-5" style={{ borderTop: '1px solid var(--border-warm)' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--text-warm-muted)' }}>Quote Includes</div>
                  <div className="space-y-2">
                    {option.equipment.map((eq, i) => (
                      <div key={`${eq.id}-${i}`} className="flex items-start gap-2 text-sm">
                        <span style={{ color: 'var(--christmas-green)' }}>{'\u2713'}</span>
                        <span style={{ color: 'var(--text-warm-secondary)' }}>{eq.name}, professionally installed</span>
                      </div>
                    ))}
                    {option.warranties?.length > 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <span style={{ color: 'var(--christmas-green)' }}>{'\u2713'}</span>
                        <span style={{ color: 'var(--text-warm-secondary)' }}>{option.warranties.map(w => w.name).join(' + ')}</span>
                      </div>
                    )}
                    {(option.installItems?.length || 0) > 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <span style={{ color: 'var(--christmas-green)' }}>{'\u2713'}</span>
                        <span style={{ color: 'var(--text-warm-secondary)' }}>Permit, inspection, disposal</span>
                      </div>
                    )}
                    {option.addOns.length > 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <span style={{ color: 'var(--christmas-green)' }}>{'\u2713'}</span>
                        <span style={{ color: 'var(--text-warm-secondary)' }}>{option.addOns.length} included add-on{option.addOns.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {extraAddOns.map(ao => (
                      <div key={ao.id} className="flex items-start gap-2 text-sm">
                        <span style={{ color: 'var(--christmas-green)' }}>{'\u2713'}</span>
                        <span className="font-medium" style={{ color: 'var(--christmas-green)' }}>{ao.name} (+{fmt(ao.price)})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                {estimate.status === 'accepted' && estimate.selectedOptionId === option.id ? (
                  <div className="w-full py-3.5 rounded-xl font-semibold text-sm text-center" style={{ background: 'var(--bg-mint)', color: 'var(--christmas-green)' }}>
                    {'\u2713'} Quote Accepted
                  </div>
                ) : (
                  <>
                    <button onClick={handleAccept} className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 shadow-md" style={{ background: 'var(--christmas-green)' }}>
                      Accept quote &amp; schedule install &rarr;
                    </button>
                    <button className="w-full py-3 mt-2 rounded-xl font-medium text-sm transition-colors hover:opacity-80" style={{ border: '1px solid var(--border-warm)', color: 'var(--text-warm-secondary)' }}>
                      Apply for financing
                    </button>
                  </>
                )}

                {/* Guarantee */}
                <div className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--text-warm-muted)' }}>
                  <strong style={{ color: 'var(--text-warm-secondary)' }}>Your Christmas Air guarantee:</strong> If you&apos;re not 100% satisfied within 12 months, we&apos;ll make it right or remove the system and refund your money.
                </div>
              </div>

              {/* Back link */}
              <button onClick={() => router.push(`/present/${estimate.id}`)} className="w-full py-2 text-sm text-center transition-colors hover:opacity-70" style={{ color: 'var(--text-warm-muted)' }}>
                &larr; Compare all options
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
