'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Estimate, EstimateOption, AddOn, InstallItem, getOptionTotal, FinancingPlan, CachedAddOn, getMonthlyPayment } from '@/types/estimate';
import { getEstimate, saveEstimate } from '@/lib/store';
import { TierConfig } from '@/lib/tiers';
import { useTierConfigs } from '@/lib/use-tier-configs';
import { getSystemImage } from '@/lib/system-images';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}
function fmtMo(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

// Marketing copy by compressor stage
function getSystemStory(seer: number, stage: string, brand: string): { headline: string; body: string; whyItMatters: string } {
  if (stage === 'Variable') {
    return {
      headline: 'The Ultimate in Home Comfort',
      body: `The ${brand} ${seer} SEER2 variable-speed system is the most advanced comfort technology available. Unlike traditional systems that blast on at full power and shut off, this system continuously adjusts its output to match your home's exact needs. It runs at low capacity most of the time, delivering whisper-quiet operation and remarkably even temperatures in every room.`,
      whyItMatters: 'Variable-speed technology dehumidifies your home 2x better than single-stage systems. In the Texas heat, that means your home feels comfortable at a higher thermostat setting, saving you even more on energy bills. Most homeowners report noticing the difference in comfort within the first 24 hours.',
    };
  }
  if (stage === 'Two-Stage') {
    return {
      headline: 'Smarter Comfort, Lower Bills',
      body: `The ${brand} ${seer} SEER2 two-stage system has two speeds: a low stage for mild days and a high stage for peak heat. It runs on low about 80% of the time, which means quieter operation, lower energy bills, and more consistent temperatures throughout your home.`,
      whyItMatters: 'For two-story homes in North Texas, two-stage cooling significantly reduces the temperature gap between your upstairs and downstairs. This is the most popular choice among our customers in the Denton area.',
    };
  }
  return {
    headline: 'Reliable Comfort You Can Count On',
    body: `The ${brand} ${seer} SEER2 system is a proven, dependable system that delivers reliable cooling and heating for your home. It meets current federal efficiency standards and comes backed by ${brand}'s industry-leading warranty.`,
    whyItMatters: 'Single-stage systems are straightforward and cost-effective. They cool your home efficiently and are the most affordable option to get a brand-new, high-quality system installed by our expert team.',
  };
}

// Energy savings estimate
function getEnergySavings(oldSeer: number, newSeer: number): { savingsPercent: number; annualSavings: number } {
  if (oldSeer <= 0 || newSeer <= 0) return { savingsPercent: 0, annualSavings: 0 };
  const savingsPercent = Math.round((1 - oldSeer / newSeer) * 100);
  // Average TX cooling cost ~$1,800/year
  const annualSavings = Math.round(1800 * (savingsPercent / 100));
  return { savingsPercent: Math.max(0, savingsPercent), annualSavings: Math.max(0, annualSavings) };
}

export default function OptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [option, setOption] = useState<EstimateOption | null>(null);
  const [pricingMode, setPricingMode] = useState<'cash' | 'finance'>('cash');
  const [showAddScope, setShowAddScope] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [oldSystemSeer, setOldSystemSeer] = useState(10);
  const [installDate, setInstallDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [financingPlans, setFinancingPlans] = useState<FinancingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [showMoreFinancing, setShowMoreFinancing] = useState(false);
  const [cachedAddons, setCachedAddons] = useState<CachedAddOn[]>([]);
  const [reviews, setReviews] = useState<Array<{ name: string; rating: number; text: string; date: string }>>([]);
  const { tiers } = useTierConfigs();

  useEffect(() => {
    const est = getEstimate(params.id as string);
    if (!est) { router.push('/'); return; }
    setEstimate(est);
    const opt = est.options.find(o => o.id === params.optionId);
    if (!opt) { router.push(`/present/${est.id}`); return; }
    setOption(opt);

    // Fetch financing plans and cached add-ons from DB
    fetch('/api/settings/financing').then(r => r.json()).then(d => {
      const plans = (d.plans || []).filter((p: FinancingPlan) => p.active);
      setFinancingPlans(plans);
    }).catch(() => {});
    fetch('/api/settings/addons').then(r => r.json()).then(d => {
      setCachedAddons(d.addons || []);
    }).catch(() => {});
    // Fetch real install reviews, prioritizing customer's city
    const city = est.customerAddress?.match(/,\s*([^,]+),\s*[A-Z]{2}/)?.[1]?.trim() || '';
    fetch(`/api/reviews?limit=5&install=true${city ? '&city=' + encodeURIComponent(city) : ''}`).then(r => r.json()).then(d => {
      setReviews(d.reviews || []);
    }).catch(() => {});
  }, [params.id, params.optionId, router]);

  function updateOption(updates: Partial<EstimateOption>) {
    if (!estimate || !option) return;
    const updated = { ...option, ...updates };
    setOption(updated);
    const newOptions = estimate.options.map(o => o.id === option.id ? updated : o);
    const est = { ...estimate, options: newOptions };
    saveEstimate(est);
    setEstimate(est);
  }

  function addCustomScopeItem() {
    if (!customItemName.trim()) return;
    const item: InstallItem = {
      id: `custom-${Date.now()}`,
      name: customItemName.trim(),
      category: 'misc',
      unitCost: Number(customItemPrice) || 0,
      quantity: 1,
    };
    updateOption({ installItems: [...(option?.installItems || []), item] });
    setCustomItemName('');
    setCustomItemPrice('');
  }

  function removeCustomItem(id: string) {
    if (!option) return;
    updateOption({ installItems: option.installItems.filter(i => i.id !== id) });
  }

  function addAddOn(addOn: AddOn) {
    if (!option) return;
    if (option.addOns.some(a => a.id === addOn.id)) return;
    updateOption({ addOns: [...option.addOns, addOn] });
  }

  function removeAddOn(id: string) {
    if (!option) return;
    updateOption({ addOns: option.addOns.filter(a => a.id !== id) });
  }

  if (!estimate || !option) return null;

  const total = getOptionTotal(option);
  const primaryEquip = option.equipment[0];

  const tierConfig: TierConfig | undefined = tiers.find(t => t.name.toLowerCase() === option.label.toLowerCase());

  // Financing: use featured plan from tier config, or first available
  const featuredPlanId = tierConfig?.featuredFinancingPlanId;
  const activePlanId = selectedPlanId || featuredPlanId || financingPlans[0]?.id || '';
  const activePlan = financingPlans.find(p => p.id === activePlanId) || financingPlans[0];
  const monthly = activePlan ? getMonthlyPayment(total, { id: activePlan.id, name: activePlan.name, months: activePlan.months, apr: activePlan.apr, minAmount: activePlan.minAmount }) : 0;
  const accentColor = tierConfig?.color || '#1a5632';

  const seer = primaryEquip?.seer || 14;
  const brand = primaryEquip?.brand || tierConfig?.brand || 'American Standard';
  const stage = tierConfig?.compressorStage || 'Single-Stage';
  const systemDescription = primaryEquip?.description || '';

  // AHRI
  const ahriMatch = systemDescription.match(/AHRI\s*(?:Certified\s*)?(?:Reference\s*)?#?:?\s*(\d+)/i);
  const ahriNumber = ahriMatch ? ahriMatch[1] : null;
  const componentsMatch = systemDescription.match(/Factory-matched components?:\s*([^.]+)/i);
  const components = componentsMatch ? componentsMatch[1].trim().split(/,\s*/) : [];

  const story = getSystemStory(seer, stage, brand);
  const savings = getEnergySavings(oldSystemSeer, seer);

  // Clean system name
  const systemName = primaryEquip ? primaryEquip.name.replace(/^\d+\s*-\s*/, '') : `${option.label} Comfort System`;

  // Add-ons from DB (synced from ST pricebook or manually entered)
  const availableAddOns: AddOn[] = cachedAddons.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description || '',
    price: a.price,
    category: a.category,
    popular: a.popular,
  }));

  return (
    <div className="min-h-screen bg-white">
      {/* Advisor Toolbar */}
      <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between text-sm print:hidden">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white">&larr; Back</button>
        <button onClick={() => router.push(`/estimates/${estimate.id}`)} className="text-gray-400 hover:text-white">Edit Estimate</button>
      </div>

      {/* ═══ HERO ═══ */}
      <div style={{ backgroundColor: accentColor }} className="text-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-6">
            <div className="w-36 h-36 rounded-2xl bg-white p-2 flex items-center justify-center flex-shrink-0">
              <img src={getSystemImage(seer, option.label, brand)} alt={systemName} className="w-full h-full object-contain" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white/70 uppercase tracking-wide">{brand}</div>
              <h1 className="text-2xl font-bold mt-1">{option.label} Series</h1>
              <p className="text-white/80 text-sm mt-1">{systemName}</p>
              <div className="flex gap-3 mt-3">
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">{seer} SEER2</span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">{stage}</span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">{tierConfig?.noiseLevel || 'Standard'}</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setPricingMode('cash')} className={`px-3 py-1 rounded-full text-xs font-medium ${pricingMode === 'cash' ? 'bg-white text-gray-900' : 'bg-white/20 text-white'}`}>Cash</button>
                <button onClick={() => setPricingMode('finance')} className={`px-3 py-1 rounded-full text-xs font-medium ${pricingMode === 'finance' ? 'bg-white text-gray-900' : 'bg-white/20 text-white'}`}>Finance</button>
              </div>
              {pricingMode === 'cash' ? (
                <div className="text-3xl font-black">{fmt(total)}</div>
              ) : (
                <>
                  <div className="text-3xl font-black">{fmtMo(monthly)}<span className="text-lg">/mo</span></div>
                  <div className="text-xs text-white/60 mt-0.5">{activePlan?.name}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 flex gap-8">
        {/* ═══ MAIN CONTENT ═══ */}
        <div className="flex-1 min-w-0 space-y-10">

        {/* ═══ 1. SYSTEM STORY ═══ */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{story.headline}</h2>
          <p className="text-gray-700 leading-relaxed">{story.body}</p>
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-green-900 mb-1">Why It Matters For Your Home</h3>
            <p className="text-sm text-green-800 leading-relaxed">{story.whyItMatters}</p>
          </div>
        </section>

        {/* ═══ 2. KEY SPECS ═══ */}
        <section>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <div className="text-2xl font-black text-gray-900">{seer}</div>
              <div className="text-xs text-gray-500 mt-0.5">SEER2 Rating</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <div className="text-lg font-bold text-gray-900">{stage}</div>
              <div className="text-xs text-gray-500 mt-0.5">Compressor</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <div className="text-lg font-bold text-gray-900">{tierConfig?.noiseLevel || 'Standard'}</div>
              <div className="text-xs text-gray-500 mt-0.5">Noise Level</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <div className="text-lg font-bold text-gray-900">{tierConfig?.coolingSavings || 'Up to 10%'}</div>
              <div className="text-xs text-gray-500 mt-0.5">Energy Savings</div>
            </div>
          </div>
        </section>

        {/* ═══ 3. AHRI CERTIFICATION ═══ */}
        {(ahriNumber || components.length > 0) && (
          <section>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">AHRI-Certified Matched System</h3>
              <p className="text-sm text-blue-700 mb-3">Every component in this system is factory-matched and independently certified to work together for peak efficiency and reliability.</p>
              {components.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {components.map((comp, i) => (
                    <span key={i} className="px-3 py-1 bg-white border border-blue-200 rounded-lg text-xs font-mono">{comp}</span>
                  ))}
                </div>
              )}
              {ahriNumber && <div className="text-xs text-blue-500">AHRI Reference #{ahriNumber}</div>}
            </div>
          </section>
        )}

        {/* ═══ 4. ENERGY SAVINGS ═══ */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Your Energy Savings</h2>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm text-gray-600">Your current system is approximately</label>
              <select value={oldSystemSeer} onChange={(e) => setOldSystemSeer(Number(e.target.value))}
                className="px-3 py-1.5 border border-green-300 rounded-lg text-sm bg-white">
                <option value={8}>8 SEER (15+ years old)</option>
                <option value={10}>10 SEER (10-15 years old)</option>
                <option value={12}>12 SEER (7-10 years old)</option>
                <option value={13}>13 SEER (5-7 years old)</option>
                <option value={14}>14 SEER (recent)</option>
              </select>
            </div>
            {savings.savingsPercent > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-3xl font-black text-green-700">{savings.savingsPercent}%</div>
                  <div className="text-sm text-green-600 mt-1">More Efficient</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-green-700">{fmt(savings.annualSavings)}</div>
                  <div className="text-sm text-green-600 mt-1">Estimated Annual Savings</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-green-700">{fmt(savings.annualSavings * 10)}</div>
                  <div className="text-sm text-green-600 mt-1">10-Year Savings</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center">Select your current system to see estimated savings</p>
            )}
            <p className="text-xs text-green-600 mt-4 text-center">Estimated savings based on average North Texas cooling costs. Actual savings vary by home size, insulation, and usage.</p>
          </div>
        </section>

        {/* ═══ 4.5. PROTECT YOUR INVESTMENT ═══ */}
        {tierConfig?.warrantyExtensionPrice != null && tierConfig.warrantyExtensionPrice > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Protect Your Investment</h2>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">10-Year Complete Coverage</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Extends your warranty to cover all labor, parts, and refrigerant for a full 10 years.
                    If anything goes wrong, you pay nothing.
                  </p>
                  <div className="flex gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-xs text-blue-700">
                      <span className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">&#10003;</span>
                      Labor
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-blue-700">
                      <span className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">&#10003;</span>
                      Parts
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-blue-700">
                      <span className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">&#10003;</span>
                      Refrigerant
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Included: {tierConfig.laborWarranty} labor warranty. This extends coverage to 10 years.
                  </p>
                </div>
                <div className="text-right flex-shrink-0 ml-6">
                  <div className="text-2xl font-black text-gray-900">+{fmt(tierConfig.warrantyExtensionPrice)}</div>
                  {option.addOns.some(a => a.name === '10-Year Complete Coverage') ? (
                    <button
                      onClick={() => removeAddOn(option.addOns.find(a => a.name === '10-Year Complete Coverage')!.id)}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium print:hidden">
                      Added &#10003;
                    </button>
                  ) : (
                    <button
                      onClick={() => addAddOn({
                        id: `warranty-ext-${tierConfig?.id || 'default'}`,
                        name: '10-Year Complete Coverage',
                        description: 'Extends warranty to cover labor, parts, and refrigerant for 10 years',
                        price: tierConfig.warrantyExtensionPrice!,
                        category: 'protection',
                      })}
                      className="mt-2 px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 print:hidden">
                      + Add Protection
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ═══ 5. COMMON ADD-ONS ═══ */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Customers Also Added</h2>
          <p className="text-sm text-gray-500 mb-4">Enhance your comfort and protect your investment</p>

          {/* Already added */}
          {option.addOns.length > 0 && (
            <div className="mb-4 space-y-2">
              {option.addOns.map(ao => (
                <div key={ao.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{ao.name}</div>
                    <div className="text-xs text-gray-500">{ao.description}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900 text-sm">{fmt(ao.price)}</span>
                    <button onClick={() => removeAddOn(ao.id)} className="text-gray-400 hover:text-red-500 text-xs print:hidden">&times;</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableAddOns.filter(ao => !option.addOns.some(a => a.id === ao.id)).map(ao => (
              <button key={ao.id} onClick={() => addAddOn(ao)}
                className="text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-green-300 hover:shadow-sm transition-all print:hidden">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">{ao.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{ao.description}</div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <div className="font-semibold text-gray-900 text-sm">{fmt(ao.price)}</div>
                    <div className="text-xs text-green-600 mt-0.5">+ Add</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ═══ 6. CUSTOM SCOPE ═══ */}
        <section className="print:hidden">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Additional Scope</h2>
          <p className="text-sm text-gray-500 mb-4">Add extra items like additional returns, ductwork modifications, or other custom work</p>

          {/* Existing custom items */}
          {(option.installItems || []).length > 0 && (
            <div className="mb-4 space-y-2">
              {option.installItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                    {item.description && <div className="text-xs text-gray-500">{item.description}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">x{item.quantity}</span>
                    <span className="font-semibold text-gray-900 text-sm">{fmt(item.unitCost * item.quantity)}</span>
                    <button onClick={() => removeCustomItem(item.id)} className="text-gray-400 hover:text-red-500 text-xs">&times;</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAddScope ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex gap-2">
                <input type="text" value={customItemName} onChange={(e) => setCustomItemName(e.target.value)}
                  placeholder="e.g., Additional 20x20 Return" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <div className="relative w-28">
                  <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                  <input type="number" value={customItemPrice} onChange={(e) => setCustomItemPrice(e.target.value)}
                    placeholder="0" className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <button onClick={addCustomScopeItem} className="px-4 py-2 bg-[var(--christmas-green)] text-white rounded-lg text-sm font-medium">Add</button>
                <button onClick={() => setShowAddScope(false)} className="px-3 py-2 text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddScope(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-[var(--christmas-green)] hover:text-[var(--christmas-green)] text-sm font-medium">
              + Add Custom Item
            </button>
          )}
        </section>

        {/* ═══ 6.5. FINANCING ═══ */}
        {financingPlans.length > 0 && activePlan && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Financing Options</h2>
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-gray-900">{activePlan.name}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {activePlan.apr === 0 ? 'No interest' : `${activePlan.apr}% APR`} for {activePlan.months} months
                  </div>
                  <div className="text-2xl font-black text-gray-900 mt-2">
                    {fmtMo(monthly)}<span className="text-sm text-gray-500">/mo</span>
                  </div>
                </div>
                {activePlan.applyUrl && (
                  <a href={activePlan.applyUrl} target="_blank" rel="noopener noreferrer"
                    className="px-6 py-3 bg-[var(--christmas-green)] text-white rounded-xl font-bold text-sm hover:bg-[var(--christmas-green-dark)] print:hidden">
                    Apply Now
                  </a>
                )}
              </div>

              {/* More options disclosure */}
              {financingPlans.length > 1 && (
                <div className="mt-4 print:hidden">
                  <button onClick={() => setShowMoreFinancing(!showMoreFinancing)}
                    className="text-sm text-gray-500 hover:text-gray-700">
                    {showMoreFinancing ? 'Hide other options' : `View ${financingPlans.length - 1} more option${financingPlans.length > 2 ? 's' : ''}`}
                  </button>
                  {showMoreFinancing && (
                    <div className="mt-3 space-y-2">
                      {financingPlans.filter(p => p.id !== activePlan.id).map(p => {
                        const planMonthly = getMonthlyPayment(total, { id: p.id, name: p.name, months: p.months, apr: p.apr, minAmount: p.minAmount });
                        return (
                          <button key={p.id}
                            onClick={() => setSelectedPlanId(p.id)}
                            className="w-full flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-green-300 text-left">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{p.name}</div>
                              <div className="text-xs text-gray-500">{p.apr === 0 ? 'No interest' : `${p.apr}% APR`} for {p.months} months</div>
                            </div>
                            <div className="text-sm font-bold text-gray-900">{fmtMo(planMonthly)}/mo</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ═══ 6.75. SCOPE TRANSPARENCY ═══ */}
        {tierConfig && (tierConfig.scopeIncluded.length > 0 || tierConfig.scopeExcluded.length > 0 || tierConfig.scopeAssumptions.length > 0) && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Scope of Work</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {tierConfig.scopeIncluded.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-green-900 mb-3 uppercase tracking-wide">What&apos;s Included</h3>
                  <ul className="space-y-2">
                    {tierConfig.scopeIncluded.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-green-800">
                        <span className="text-green-500 mt-0.5">&#10003;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tierConfig.scopeExcluded.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-red-900 mb-3 uppercase tracking-wide">What&apos;s Not Included</h3>
                  <ul className="space-y-2">
                    {tierConfig.scopeExcluded.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                        <span className="text-red-400 mt-0.5">&#10007;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tierConfig.scopeAssumptions.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Requirements</h3>
                  <ul className="space-y-2">
                    {tierConfig.scopeAssumptions.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-gray-400 mt-0.5">&bull;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ═══ 7. WHAT'S INCLUDED ═══ */}
        {tierConfig && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">What&apos;s Included With Every Install</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Warranty Protection</h3>
                <ul className="space-y-2">
                  {[
                    `${tierConfig.laborWarranty} Labor Warranty`,
                    `${tierConfig.partsWarranty} Parts Warranty`,
                    `${tierConfig.heatExchangerWarranty} Heat Exchanger Warranty`,
                  ].map((w, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: accentColor }}>&#10003;</span>
                      <span className="text-gray-700">{w}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Your Guarantees</h3>
                <ul className="space-y-2">
                  {[...tierConfig.guarantees, `${tierConfig.comfortGuaranteeYears}-Year Comfort Guarantee`].map((g, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: accentColor }}>&#10003;</span>
                      <span className="text-gray-700">{g}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Technology &amp; Comfort</h3>
                <ul className="space-y-2">
                  {tierConfig.techFeatures.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: accentColor }}>&#10003;</span>
                      <span className="text-gray-700">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Professional Installation</h3>
                <ul className="space-y-2">
                  {[
                    'All materials and labor included',
                    'Background-checked, drug-screened installers',
                    'Floor savers and drop cloths throughout',
                    'Complete cleanup when we leave',
                    'City permit and inspection (where required)',
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: accentColor }}>&#10003;</span>
                      <span className="text-gray-700">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* ═══ 8. OUR STORY ═══ */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">The Christmas Air Difference</h2>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 text-center mb-6">
              <div>
                <div className="text-3xl font-black" style={{ color: accentColor }}>10+</div>
                <div className="text-sm text-gray-600 mt-1">Years Serving DFW</div>
              </div>
              <div>
                <div className="text-3xl font-black" style={{ color: accentColor }}>4.9</div>
                <div className="text-sm text-gray-600 mt-1">Google Rating</div>
              </div>
              <div>
                <div className="text-3xl font-black" style={{ color: accentColor }}>1,000+</div>
                <div className="text-sm text-gray-600 mt-1">Systems Installed</div>
              </div>
              <div>
                <div className="text-3xl font-black" style={{ color: accentColor }}>500+</div>
                <div className="text-sm text-gray-600 mt-1">5-Star Reviews</div>
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              Christmas Air Conditioning &amp; Plumbing has been Denton County&apos;s trusted name in home comfort since day one. We&apos;re not a franchise. We&apos;re a locally owned company that treats every home like our own. Our installers are background-checked, drug-screened, and trained to the highest standards. We use floor savers, clean up after ourselves, and we don&apos;t leave until the job is done right.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mt-3">
              We stand behind every installation with our exclusive guarantee package. If something isn&apos;t right, we make it right. No runaround, no excuses. That&apos;s the Christmas Air way.
            </p>
          </div>
        </section>

        {/* ═══ 9. REVIEWS ═══ */}
        {reviews.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">What Our Customers Say</h2>
            <div className="space-y-4">
              {reviews.map((review, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex text-amber-400 text-sm">{'★'.repeat(review.rating)}</div>
                    <span className="text-sm font-medium text-gray-900">{review.name}</span>
                    <span className="text-xs text-gray-400">{review.date}</span>
                    {(review as any).isLocal && (
                      <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium">Your Area</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{review.text}</p>
                  {(review as any).locationName && (
                    <p className="text-xs text-gray-400 mt-2">via Google Reviews &middot; {(review as any).locationName}</p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">Verified reviews from Google Business Profile</p>
          </section>
        )}

        {/* Footer */}
        <div className="text-center py-8 text-xs text-gray-400">
          <p className="font-medium text-gray-500">Christmas Air Conditioning &amp; Plumbing</p>
          <p>Denton, TX &middot; (940) 566-1122</p>
          <p className="mt-1">Prices valid for 30 days from date of proposal</p>
        </div>

        </div>{/* end main content */}

        {/* ═══ STICKY SIDEBAR ═══ */}
        <div className="hidden md:block w-72 lg:w-80 flex-shrink-0">
          <div className="sticky top-4 space-y-4">

            {/* Install Date */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <h3 className="text-sm font-semibold text-amber-900">Earliest Install Date</h3>
              </div>
              <input
                type="date"
                value={installDate}
                onChange={(e) => setInstallDate(e.target.value)}
                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white print:hidden"
              />
              <div className="text-lg font-bold text-amber-900 mt-2 print:mt-0">
                {new Date(installDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <p className="text-xs text-amber-600 mt-1">Schedule your install before the summer rush</p>
            </div>

            {/* Price Summary */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Your Investment</h3>

              {/* System */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{option.label} System</span>
                  <span className="font-medium text-gray-900">{fmt(option.equipment.reduce((s, e) => s + e.retailPrice, 0))}</span>
                </div>

                {/* Add-ons */}
                {option.addOns.map(ao => (
                  <div key={ao.id} className="flex justify-between">
                    <span className="text-gray-600">{ao.name}</span>
                    <span className="font-medium text-gray-900">{fmt(ao.price)}</span>
                  </div>
                ))}

                {/* Custom scope */}
                {(option.installItems || []).map(item => (
                  <div key={item.id} className="flex justify-between">
                    <span className="text-gray-600">{item.name}</span>
                    <span className="font-medium text-gray-900">{fmt(item.unitCost * item.quantity)}</span>
                  </div>
                ))}

                {/* Labor */}
                {option.laborCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Labor</span>
                    <span className="font-medium text-gray-900">{fmt(option.laborCost)}</span>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="border-t border-gray-200 mt-3 pt-3">
                {pricingMode === 'cash' ? (
                  <>
                    <div className="flex justify-between items-baseline">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="text-2xl font-black text-gray-900">{fmt(total)}</span>
                    </div>
                    <div className="text-xs text-gray-400 text-right">Installed Price</div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-baseline">
                      <span className="font-semibold text-gray-900">Monthly</span>
                      <span className="text-2xl font-black text-[var(--christmas-green)]">{fmtMo(monthly)}<span className="text-sm">/mo</span></span>
                    </div>
                    <div className="text-xs text-gray-400 text-right">{activePlan?.name} | {fmt(total)} total</div>
                  </>
                )}
              </div>

              {/* Financing toggle */}
              <div className="flex gap-1 mt-3 bg-gray-100 p-1 rounded-full">
                <button onClick={() => setPricingMode('cash')}
                  className={`flex-1 py-1.5 rounded-full text-xs font-medium ${pricingMode === 'cash' ? 'bg-[var(--christmas-green)] text-white' : 'text-gray-600'}`}>Cash</button>
                <button onClick={() => setPricingMode('finance')}
                  className={`flex-1 py-1.5 rounded-full text-xs font-medium ${pricingMode === 'finance' ? 'bg-[var(--christmas-green)] text-white' : 'text-gray-600'}`}>Finance</button>
              </div>
            </div>

            {/* Tier Perks Summary */}
            {tierConfig && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Included With {option.label}</h3>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-xs text-gray-700">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: accentColor, fontSize: '7px' }}>&#10003;</span>
                    {tierConfig.laborWarranty} Labor Warranty
                  </li>
                  <li className="flex items-center gap-2 text-xs text-gray-700">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: accentColor, fontSize: '7px' }}>&#10003;</span>
                    {tierConfig.partsWarranty} Parts Warranty
                  </li>
                  {tierConfig.guarantees.slice(0, 3).map((g, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-gray-700">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: accentColor, fontSize: '7px' }}>&#10003;</span>
                      {g}
                    </li>
                  ))}
                  <li className="flex items-center gap-2 text-xs text-gray-700">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: accentColor, fontSize: '7px' }}>&#10003;</span>
                    All Materials &amp; Labor
                  </li>
                </ul>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="space-y-2">
              <button onClick={() => router.back()}
                className="w-full py-3 bg-[var(--christmas-green)] text-white rounded-xl font-semibold text-sm hover:bg-[var(--christmas-green-dark)] shadow-md">
                &larr; Back
              </button>
              <button onClick={() => router.push(`/estimates/${estimate.id}`)}
                className="w-full py-2.5 border border-gray-300 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-50 print:hidden">
                Back to Editor
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
