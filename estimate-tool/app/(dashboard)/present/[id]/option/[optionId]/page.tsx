'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Estimate, EstimateOption, getOptionTotal } from '@/types/estimate';
import { getEstimate } from '@/lib/store';
import { financingTerms } from '@/lib/catalog';
import { TierConfig } from '@/lib/tiers';
import { useTierConfigs } from '@/lib/use-tier-configs';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtMo(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function getSystemMarketingCopy(seer: number, stage: string, brand: string): string {
  if (stage === 'Variable') {
    return `An inverter-driven system is the pinnacle of home comfort. At ${seer} SEER2, the ${brand} variable-speed system continuously adjusts its output to match your home's exact cooling needs. The result is whisper-quiet operation, remarkably even temperatures in every room, and the lowest energy bills possible. The variable-speed technology means your system runs at low capacity most of the time, dehumidifying your home better than any single or two-stage system.`;
  }
  if (stage === 'Two-Stage') {
    return `A two-stage system has two speeds for smarter comfort. At ${seer} SEER2, the ${brand} two-stage system runs on low most of the time, which means quieter operation, lower bills, and more even temperatures throughout your home. For North Texas homes, the low stage helps reduce the temperature gap between floors, so your upstairs stays more comfortable.`;
  }
  return `The ${brand} ${seer} SEER2 system is a reliable, proven system that gets the job done. It meets current federal efficiency standards and provides dependable cooling for your home. Single-stage systems are straightforward and a solid choice for homeowners who want reliable comfort at the best price.`;
}

export default function OptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [option, setOption] = useState<EstimateOption | null>(null);
  const [pricingMode, setPricingMode] = useState<'cash' | 'finance'>('cash');
  const [selectedTerm, setSelectedTerm] = useState(financingTerms[1]?.id || '');
  const { tiers } = useTierConfigs();

  useEffect(() => {
    const est = getEstimate(params.id as string);
    if (!est) { router.push('/'); return; }
    setEstimate(est);
    const opt = est.options.find(o => o.id === params.optionId);
    if (!opt) { router.push(`/present/${est.id}`); return; }
    setOption(opt);
  }, [params.id, params.optionId, router]);

  if (!estimate || !option) return null;

  const total = getOptionTotal(option);
  const activeTerm = financingTerms.find(t => t.id === selectedTerm) || financingTerms[1];
  const monthly = activeTerm ? total / activeTerm.months : 0;
  const primaryEquip = option.equipment[0];

  // Get tier config for this option
  const tierConfig: TierConfig | undefined = tiers.find(
    t => t.name.toLowerCase() === option.label.toLowerCase()
  );

  // Parse system info from equipment
  const seer = primaryEquip?.seer || 14;
  const brand = primaryEquip?.brand || 'American Standard';
  const stage = tierConfig?.compressorStage || 'Single-Stage';
  const systemCode = primaryEquip?.stCode || primaryEquip?.model || '';
  const systemDescription = primaryEquip?.description || '';

  // Extract AHRI number and components from ST description
  const ahriMatch = systemDescription.match(/AHRI\s*(?:Certified\s*)?(?:Reference\s*)?#?:?\s*(\d+)/i);
  const ahriNumber = ahriMatch ? ahriMatch[1] : null;
  const componentsMatch = systemDescription.match(/Factory-matched components?:\s*([^.]+)/i);
  const components = componentsMatch ? componentsMatch[1].trim().split(/,\s*/) : [];
  // Clean description: remove the AHRI/components line for display
  const cleanDescription = systemDescription
    .replace(/Factory-matched components?:[^.]+\./i, '')
    .replace(/AHRI\s*Certified\s*Reference\s*#?:?\s*\d+\.?/i, '')
    .replace(/&mdash;/g, '\u2014')
    .trim();

  const marketingCopy = cleanDescription || getSystemMarketingCopy(seer, stage, brand);

  return (
    <div className="min-h-screen bg-white">
      {/* Advisor Toolbar */}
      <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between text-sm print:hidden">
        <button onClick={() => router.push(`/present/${estimate.id}`)} className="text-gray-400 hover:text-white">&larr; Back to Options</button>
        <button onClick={() => router.push(`/estimates/${estimate.id}`)} className="text-gray-400 hover:text-white">Edit Estimate</button>
      </div>

      {/* Hero Section */}
      <div style={{ backgroundColor: tierConfig?.color || '#1a5632' }} className="text-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-6">
            {/* System Image */}
            <div className="w-32 h-32 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-5xl text-white/60">&#10052;</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-white/70 uppercase tracking-wide">{option.label} System</div>
              <h1 className="text-2xl font-bold mt-1">
                {primaryEquip ? primaryEquip.name : `${option.label} Comfort System`}
              </h1>
              <div className="text-white/80 text-sm mt-1">{brand} | {seer} SEER2 | {stage}</div>
              {systemCode && <div className="text-white/50 text-xs mt-1">Code: {systemCode}</div>}
            </div>
            {/* Price */}
            <div className="text-right flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setPricingMode('cash')}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${pricingMode === 'cash' ? 'bg-white text-gray-900' : 'bg-white/20 text-white'}`}
                >Cash</button>
                <button onClick={() => setPricingMode('finance')}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${pricingMode === 'finance' ? 'bg-white text-gray-900' : 'bg-white/20 text-white'}`}
                >Finance</button>
              </div>
              {pricingMode === 'cash' ? (
                <div className="text-3xl font-black">{fmt(total)}</div>
              ) : (
                <>
                  <div className="text-3xl font-black">{fmtMo(monthly)}<span className="text-lg">/mo</span></div>
                  <div className="text-xs text-white/60 mt-0.5">{activeTerm?.name} | {fmt(total)} total</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">

        {/* 1. System Detail */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">About This System</h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">{marketingCopy}</p>

          {/* AHRI Matchup */}
          {(ahriNumber || components.length > 0) && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">AHRI-Certified Matched System</h3>
              {ahriNumber && (
                <div className="text-sm text-blue-700 mb-2">AHRI Reference #: <span className="font-mono font-semibold">{ahriNumber}</span></div>
              )}
              {components.length > 0 && (
                <div className="text-sm text-blue-700">
                  <span className="font-medium">Factory-Matched Components:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {components.map((comp, i) => (
                      <span key={i} className="px-3 py-1 bg-white border border-blue-200 rounded-lg text-xs font-mono">{comp}</span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-blue-600 mt-3">
                This system is AHRI-certified, meaning the outdoor unit, indoor coil, and heating equipment are engineered and tested together for peak efficiency and performance.
              </p>
            </div>
          )}

          {/* Key Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
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

        {/* 2. What's Included */}
        {tierConfig && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">What&apos;s Included</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Warranty */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Warranty Protection</h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: tierConfig.color }}>&#10003;</span>
                    <span className="text-gray-700">{tierConfig.laborWarranty} Labor Warranty</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: tierConfig.color }}>&#10003;</span>
                    <span className="text-gray-700">{tierConfig.partsWarranty} Parts Warranty</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: tierConfig.color }}>&#10003;</span>
                    <span className="text-gray-700">{tierConfig.heatExchangerWarranty} Heat Exchanger Warranty</span>
                  </li>
                </ul>
              </div>

              {/* Guarantees */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Your Peace of Mind</h3>
                <ul className="space-y-2">
                  {tierConfig.guarantees.map((g, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: tierConfig.color }}>&#10003;</span>
                      <span className="text-gray-700">{g}</span>
                    </li>
                  ))}
                  <li className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: tierConfig.color }}>&#10003;</span>
                    <span className="text-gray-700">{tierConfig.comfortGuaranteeYears}-Year Comfort Guarantee</span>
                  </li>
                </ul>
              </div>

              {/* Technology & Comfort */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Technology &amp; Comfort</h3>
                <ul className="space-y-2">
                  {tierConfig.techFeatures.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: tierConfig.color }}>&#10003;</span>
                      <span className="text-gray-700">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Financing */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Financing Options</h3>
                <ul className="space-y-2">
                  {tierConfig.financing.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: tierConfig.color }}>&#10003;</span>
                      <span className="text-gray-700">{f}</span>
                    </li>
                  ))}
                  <li className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: tierConfig.color }}>&#10003;</span>
                    <span className="text-gray-700">All Materials &amp; Labor Included</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* 3. Why Christmas Air */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Why Christmas Air</h2>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-3xl font-black text-[var(--christmas-green)]">10+</div>
                <div className="text-sm text-gray-600 mt-1">Years Serving DFW</div>
              </div>
              <div>
                <div className="text-3xl font-black text-[var(--christmas-green)]">4.9</div>
                <div className="text-sm text-gray-600 mt-1">Google Rating</div>
              </div>
              <div>
                <div className="text-3xl font-black text-[var(--christmas-green)]">1,000+</div>
                <div className="text-sm text-gray-600 mt-1">Systems Installed</div>
              </div>
            </div>
            <div className="mt-6 text-sm text-gray-600 leading-relaxed">
              Christmas Air Conditioning &amp; Plumbing has been the trusted choice for Denton County homeowners. Every installation is performed by our background-checked, drug-screened technicians who treat your home with respect. We use floor savers, clean up after ourselves, and stand behind every job.
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="text-center pb-8">
          <button
            onClick={() => router.push(`/present/${estimate.id}`)}
            className="px-8 py-4 bg-[var(--christmas-green)] text-white rounded-2xl font-bold text-lg hover:bg-[var(--christmas-green-dark)] transition-colors shadow-lg"
          >
            &larr; Compare All Options
          </button>
        </div>

        {/* Footer */}
        <div className="text-center pb-8 text-xs text-gray-400">
          <p className="font-medium text-gray-500">Christmas Air Conditioning &amp; Plumbing</p>
          <p>Denton, TX &middot; (940) 566-1122</p>
          <p className="mt-1">Prices valid for 30 days from date of proposal</p>
        </div>
      </div>
    </div>
  );
}
