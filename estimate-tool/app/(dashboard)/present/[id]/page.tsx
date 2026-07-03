'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Estimate, EstimateOption, getOptionTotal, getMonthlyPayment, getDiscountsTotal } from '@/types/estimate';
import { getEstimate, saveEstimate } from '@/lib/store';
import { financingTerms } from '@/lib/catalog';
import ImagePlaceholder from '@/components/ImagePlaceholder';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}
function fmtMo(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

// Tier accent colors — Builder=gray, Silver=blue, Gold=amber
function getTierAccent(label: string, idx: number, total: number) {
  // Auto-detect by label or position
  const l = label.toLowerCase();
  if (l.includes('gold') || l.includes('best') || l.includes('premium') || idx === total - 1 && total >= 3) {
    return { accent: '#B8956B', bg: 'bg-amber-50', border: 'border-amber-300', badge: 'bg-amber-100 text-amber-800', ring: 'ring-amber-300', labelColor: 'text-amber-800' };
  }
  if (l.includes('silver') || l.includes('better') || l.includes('enhanced') || idx === 1) {
    return { accent: '#2563EB', bg: 'bg-blue-50', border: 'border-blue-300', badge: 'bg-blue-100 text-blue-800', ring: 'ring-blue-300', labelColor: 'text-blue-800' };
  }
  return { accent: '#6B7280', bg: 'bg-gray-50', border: 'border-gray-300', badge: 'bg-gray-100 text-gray-700', ring: 'ring-gray-300', labelColor: 'text-gray-700' };
}

// Build up to 5 bullet points from equipment features, add-ons, etc.
function getBulletPoints(opt: EstimateOption): string[] {
  const bullets: string[] = [];

  // Equipment efficiency
  for (const eq of opt.equipment) {
    if (eq.seer) bullets.push(`${eq.seer} SEER2 Efficiency — ${eq.seer >= 18 ? 'Maximum' : eq.seer >= 16 ? 'Enhanced' : 'Standard'} Energy Savings`);
    if (eq.afue) bullets.push(`${eq.afue}% AFUE Furnace — ${eq.afue >= 96 ? 'Ultra' : eq.afue >= 90 ? 'High' : 'Standard'}-Efficiency Heating`);
  }

  // Key equipment features (pick standout ones)
  for (const eq of opt.equipment) {
    if (eq.features.some(f => f.toLowerCase().includes('inverter'))) { bullets.push('Inverter-Driven — Whisper-Quiet, Variable-Speed Comfort'); break; }
    if (eq.features.some(f => f.toLowerCase().includes('two-stage'))) { bullets.push('Two-Stage Operation — Better Comfort & Lower Bills'); break; }
  }

  // Add-ons summary
  const addOnNames = opt.addOns.map(a => a.name.replace(' System', '').replace(' Plus', ''));
  if (addOnNames.length > 0) {
    bullets.push(`Includes ${addOnNames.slice(0, 3).join(', ')}${addOnNames.length > 3 ? ` + ${addOnNames.length - 3} more` : ''}`);
  }

  // Warranty
  if (opt.warranties?.length) {
    const best = opt.warranties.reduce((a, b) => a.price > b.price ? a : b);
    bullets.push(`${best.name} — ${best.term} Coverage`);
  }

  return bullets.slice(0, 5);
}

// Get the "best value" messaging for higher tiers
function getValueMessage(opt: EstimateOption, idx: number, total: number): string | null {
  if (total < 2) return null;
  if (idx === total - 1) return 'Best Long-Term Value';
  if (idx === total - 2 && total >= 3) return 'Most Popular Choice';
  return null;
}

export default function PresentPage() {
  const params = useParams();
  const router = useRouter();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pricingMode, setPricingMode] = useState<'cash' | 'finance'>('cash');
  const [selectedTerm, setSelectedTerm] = useState(financingTerms[1].id);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const est = getEstimate(params.id as string);
    if (!est) { router.push('/'); return; }
    setEstimate(est);
    setSelectedId(est.selectedOptionId || null);
  }, [params.id, router]);

  function handleSelect(optionId: string) {
    router.push(`/present/${estimate!.id}/option/${optionId}`);
  }

  async function handleAccept() {
    if (!estimate || !selectedId) return;
    const updated = { ...estimate, selectedOptionId: selectedId, status: 'accepted' as const };
    saveEstimate(updated);
    setEstimate(updated);

    // Push to ServiceTitan if linked to a job
    if (updated.stJobId) {
      await pushToServiceTitan(updated);
    }
  }

  async function pushToServiceTitan(est: Estimate) {
    if (!est.stJobId || !est.selectedOptionId) return;
    setPushing(true);
    setPushResult(null);

    try {
      const selectedOption = est.options.find(o => o.id === est.selectedOptionId);
      if (!selectedOption) throw new Error('Selected option not found');

      // Build ST estimate items from the selected option
      const items: Array<{
        skuId: number;
        type: 'Service' | 'Material' | 'Equipment';
        description?: string;
        quantity: number;
        unitPrice: number;
      }> = [];

      // Equipment items
      for (const eq of selectedOption.equipment) {
        if (eq.stSkuId) {
          items.push({
            skuId: eq.stSkuId,
            type: 'Equipment',
            description: `${eq.brand} ${eq.model} ${eq.name}`,
            quantity: 1,
            unitPrice: eq.retailPrice,
          });
        }
      }

      // Add-ons (services)
      for (const ao of selectedOption.addOns) {
        if (ao.stSkuId) {
          items.push({
            skuId: ao.stSkuId,
            type: (ao.stType as 'Service' | 'Material' | 'Equipment') || 'Service',
            description: ao.name,
            quantity: 1,
            unitPrice: ao.price,
          });
        }
      }

      // Install materials
      for (const mat of selectedOption.installItems || []) {
        if (mat.stSkuId) {
          items.push({
            skuId: mat.stSkuId,
            type: 'Material',
            description: mat.name,
            quantity: mat.quantity,
            unitPrice: mat.unitCost,
          });
        }
      }

      // Warranties
      for (const w of selectedOption.warranties || []) {
        if (w.stSkuId) {
          items.push({
            skuId: w.stSkuId,
            type: (w.stType as 'Service' | 'Material' | 'Equipment') || 'Service',
            description: w.name,
            quantity: 1,
            unitPrice: w.price,
          });
        }
      }

      if (items.length === 0) {
        setPushResult({ success: false, message: 'No items with ST pricebook IDs to push. Items must come from the ST pricebook.' });
        return;
      }

      const res = await fetch('/api/servicetitan/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: est.stJobId,
          name: `${selectedOption.label} - ${est.customerName}`,
          summary: `${selectedOption.label} option: ${selectedOption.equipment.map(e => e.name).join(', ')}`,
          items,
          sold: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to push estimate');

      // Save the ST estimate ID back
      const finalUpdate = { ...est, stEstimateId: data.estimateId };
      saveEstimate(finalUpdate);
      setEstimate(finalUpdate);

      setPushResult({ success: true, message: `Estimate #${data.estimateId} created in ServiceTitan` });
    } catch (err) {
      setPushResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to push to ServiceTitan',
      });
    } finally {
      setPushing(false);
    }
  }

  if (!estimate) return null;

  const activeTerm = financingTerms.find(t => t.id === selectedTerm) || financingTerms[1];
  const optCount = estimate.options.length;

  return (
    <div className="min-h-screen bg-white">
      {/* ── Advisor Toolbar (hidden from customer view) ──────────── */}
      <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between text-sm print:hidden">
        <button onClick={() => router.push(`/estimates/${estimate.id}`)} className="text-gray-400 hover:text-white transition-colors">&larr; Back to Editor</button>
        <div className="flex items-center gap-4">
          <span className="text-gray-400">Status: <span className="text-white font-medium">{estimate.status}</span></span>
        </div>
      </div>

      {/* ── Customer Info Header ─────────────────────────────────── */}
      <div className="bg-[var(--christmas-green)] text-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-xl">CA</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Your Comfort Options</h1>
              <p className="text-white/80 text-sm">{estimate.customerName || 'Valued Customer'} &middot; {estimate.customerAddress}</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-white/60 text-xs">Prepared by</div>
            <div className="font-medium">{estimate.advisorName || 'Christmas Air'}</div>
          </div>
        </div>
      </div>

      {/* ── Cash / Finance Toggle ────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1">
            <button
              onClick={() => setPricingMode('cash')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${pricingMode === 'cash' ? 'bg-[var(--christmas-green)] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >Cash Price</button>
            <button
              onClick={() => setPricingMode('finance')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${pricingMode === 'finance' ? 'bg-[var(--christmas-green)] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >Monthly Payment</button>
          </div>

          {pricingMode === 'finance' && (
            <div className="flex gap-2">
              {financingTerms.map(term => (
                <button key={term.id} onClick={() => setSelectedTerm(term.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${selectedTerm === term.id ? 'border-[var(--christmas-green)] bg-green-50 text-[var(--christmas-green)]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {term.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Option Cards (flat, up to 5) ─────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className={`grid gap-5 ${
          optCount === 1 ? 'grid-cols-1 max-w-md mx-auto' :
          optCount === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto' :
          optCount === 3 ? 'grid-cols-1 sm:grid-cols-3' :
          optCount === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
          'grid-cols-1 sm:grid-cols-3 lg:grid-cols-5'
        }`}>
          {estimate.options.map((opt, idx) => {
            const total = getOptionTotal(opt);
            const monthly = getMonthlyPayment(total, activeTerm);
            const tier = getTierAccent(opt.label, idx, optCount);
            const isSelected = selectedId === opt.id;
            const bullets = getBulletPoints(opt);
            const valueMsg = getValueMessage(opt, idx, optCount);
            const primaryEquip = opt.equipment[0]; // Main condenser/unit for the hero photo
            const discountTotal = getDiscountsTotal(opt.discounts || [], total + getDiscountsTotal(opt.discounts || [], 0));

            // System name from equipment
            const systemName = opt.equipment.map(e => e.name).join(' + ');

            return (
              <div
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                className={`relative rounded-2xl border-2 transition-all cursor-pointer flex flex-col ${
                  isSelected
                    ? `${tier.border} ${tier.ring} ring-2 shadow-xl scale-[1.02]`
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-lg'
                }`}
              >
                {/* Value badge */}
                {valueMsg && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="px-3 py-1 text-white text-xs font-semibold rounded-full shadow-sm whitespace-nowrap"
                      style={{ backgroundColor: tier.accent }}>
                      {valueMsg}
                    </span>
                  </div>
                )}

                {/* Tier Label */}
                <div className={`rounded-t-xl px-4 py-3 text-center ${tier.bg}`}
                  style={{ borderBottom: `3px solid ${tier.accent}` }}>
                  <span className={`text-lg font-bold ${tier.labelColor}`}>{opt.label}</span>
                </div>

                {/* Hero Photo — Condenser / System */}
                <div className="px-4 pt-4 flex justify-center">
                  {primaryEquip ? (
                    <ImagePlaceholder
                      src={primaryEquip.imageUrl}
                      alt={primaryEquip.name}
                      size={120}
                      className="rounded-xl"
                    />
                  ) : (
                    <div className="w-[120px] h-[120px] rounded-xl bg-gray-100 flex items-center justify-center text-gray-300 text-4xl">?</div>
                  )}
                </div>

                {/* System Name */}
                <div className="px-4 pt-3 text-center">
                  <h3 className="font-bold text-gray-900 text-sm leading-tight">
                    {systemName || opt.label + ' System'}
                  </h3>
                  {primaryEquip && (
                    <p className="text-xs text-gray-400 mt-0.5">{primaryEquip.brand} {primaryEquip.model}</p>
                  )}
                </div>

                {/* Price — Cash or Monthly */}
                <div className="px-4 pt-4 text-center">
                  {pricingMode === 'cash' ? (
                    <>
                      <div className="text-3xl font-black text-gray-900">{fmt(total)}</div>
                      <div className="text-xs text-gray-400 mt-0.5">Installed Price</div>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl font-black text-[var(--christmas-green)]">{fmtMo(monthly)}<span className="text-lg font-semibold">/mo</span></div>
                      <div className="text-xs text-gray-400 mt-0.5">{activeTerm.name} &middot; {fmt(total)} total</div>
                    </>
                  )}
                </div>

                {/* Rebates / Discounts */}
                {discountTotal > 0 && (
                  <div className="mx-4 mt-3 px-3 py-2 bg-green-50 rounded-lg text-center">
                    <span className="text-sm font-semibold text-green-700">Save {fmt(discountTotal)}</span>
                    <div className="text-xs text-green-600 mt-0.5">
                      {opt.discounts.map(d => d.name).join(' + ')}
                    </div>
                  </div>
                )}

                {/* Up to 5 Bullet Points */}
                <div className="px-4 pt-4 flex-1">
                  <ul className="space-y-2">
                    {bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
                          style={{ backgroundColor: tier.accent }}>
                          &#10003;
                        </span>
                        <span className="leading-tight">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Bottom badges: Warranty, Energy, Discounts */}
                <div className="px-4 pt-4 pb-2">
                  <div className="flex flex-wrap gap-1.5">
                    {/* Energy Efficiency */}
                    {opt.equipment.some(e => e.seer && e.seer >= 16) && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
                        Energy Star
                      </span>
                    )}
                    {/* Warranty */}
                    {opt.warranties?.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                        &#9733; {opt.warranties[0].term}
                      </span>
                    )}
                    {/* Discount applied */}
                    {opt.discounts?.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-md text-xs font-medium">
                        Savings Applied
                      </span>
                    )}
                    {/* Longest warranty highlight */}
                    {opt.warranties?.some(w => w.term.toLowerCase().includes('lifetime')) && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-medium">
                        Lifetime Coverage
                      </span>
                    )}
                  </div>
                </div>

                {/* Select Button */}
                <div className="p-4 pt-2">
                  <button
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                      isSelected
                        ? 'text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    style={isSelected ? { backgroundColor: tier.accent } : undefined}
                  >
                    {isSelected ? '\u2713 Selected' : 'Choose This Option'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Accept / Next Steps ──────────────────────────────── */}
        {selectedId && (
          <div className="text-center mt-8 space-y-4">
            {estimate.status === 'accepted' ? (
              <>
                <div className="inline-flex items-center gap-2 px-8 py-4 bg-green-50 text-green-700 rounded-2xl font-semibold text-lg">
                  <span>&#10003;</span> Option Accepted — We&apos;ll get you scheduled!
                </div>
                {/* ST Push Status */}
                {pushing && (
                  <div className="text-sm text-blue-600">Syncing to ServiceTitan...</div>
                )}
                {pushResult && (
                  <div className={`text-sm ${pushResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {pushResult.message}
                  </div>
                )}
                {estimate.stEstimateId && (
                  <div className="text-xs text-gray-500">ST Estimate ID: {estimate.stEstimateId}</div>
                )}
                {estimate.stJobId && !estimate.stEstimateId && !pushing && (
                  <button
                    onClick={() => pushToServiceTitan(estimate)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"
                  >
                    Push to ServiceTitan
                  </button>
                )}
              </>
            ) : (
              <button onClick={handleAccept}
                className="px-10 py-4 bg-[var(--christmas-green)] text-white rounded-2xl font-bold text-lg hover:bg-[var(--christmas-green-dark)] transition-colors shadow-lg hover:shadow-xl">
                Accept &amp; Proceed
              </button>
            )}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────── */}
        <div className="text-center mt-12 pb-8 text-xs text-gray-400">
          <p className="font-medium text-gray-500">Christmas Air Conditioning &amp; Plumbing</p>
          <p>Denton, TX &middot; TACLA123456C &middot; (940) 566-1122</p>
          <p className="mt-1">Prices valid for 30 days from date of proposal</p>
        </div>
      </div>
    </div>
  );
}
