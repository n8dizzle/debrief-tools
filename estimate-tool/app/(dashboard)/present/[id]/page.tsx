'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Estimate, EstimateOption, FinancingPlan, getOptionTotal, getMonthlyPayment } from '@/types/estimate';
import { getEstimate, saveEstimate } from '@/lib/store';
import { TIERS, getTierBullets, TierConfig, findTierConfig } from '@/lib/tiers';
import { getSystemImage } from '@/lib/system-images';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}
function fmtMo(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function getTierConfig(label: string): TierConfig {
  return findTierConfig(label);
}

export default function PresentPage() {
  const params = useParams();
  const router = useRouter();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pricingMode, setPricingMode] = useState<'cash' | 'finance'>('cash');
  const [financingPlans, setFinancingPlans] = useState<FinancingPlan[]>([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const est = getEstimate(params.id as string);
    if (!est) { router.push('/'); return; }
    setEstimate(est);
    setSelectedId(est.selectedOptionId || null);
    fetch('/api/settings/financing').then(r => r.json()).then(d => {
      const plans = (d.plans || []).filter((p: FinancingPlan) => p.active);
      setFinancingPlans(plans);
      if (plans.length > 0) setSelectedTerm(plans[0].id);
    }).catch(() => {});
  }, [params.id, router]);

  function handleSelect(optionId: string) {
    router.push(`/present/${estimate!.id}/option/${optionId}`);
  }

  async function handleAccept() {
    if (!estimate || !selectedId) return;
    const updated = { ...estimate, selectedOptionId: selectedId, status: 'accepted' as const };
    saveEstimate(updated);
    setEstimate(updated);
    if (updated.stJobId) await pushToServiceTitan(updated);
  }

  async function pushToServiceTitan(est: Estimate) {
    if (!est.stJobId || !est.selectedOptionId) return;
    setPushing(true);
    setPushResult(null);
    try {
      const selectedOption = est.options.find(o => o.id === est.selectedOptionId);
      if (!selectedOption) throw new Error('Selected option not found');
      const items = selectedOption.equipment
        .filter(eq => eq.stSkuId)
        .map(eq => ({
          skuId: eq.stSkuId!,
          type: 'Equipment' as const,
          description: eq.name,
          quantity: 1,
          unitPrice: eq.retailPrice,
        }));
      if (items.length === 0) {
        setPushResult({ success: false, message: 'No pricebook items to push.' });
        return;
      }
      const res = await fetch('/api/servicetitan/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: est.stJobId,
          name: `${selectedOption.label} - ${est.customerName}`,
          summary: `${selectedOption.label}: ${selectedOption.equipment.map(e => e.name).join(', ')}`,
          items,
          sold: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to push estimate');
      const finalUpdate = { ...est, stEstimateId: data.estimateId };
      saveEstimate(finalUpdate);
      setEstimate(finalUpdate);
      setPushResult({ success: true, message: `Estimate created in ServiceTitan` });
    } catch (err) {
      setPushResult({ success: false, message: err instanceof Error ? err.message : 'Failed to push to ServiceTitan' });
    } finally {
      setPushing(false);
    }
  }

  if (!estimate) return null;

  const activePlan = financingPlans.find(p => p.id === selectedTerm) || financingPlans[0];
  const activeTerm = activePlan ? { id: activePlan.id, name: activePlan.name, months: activePlan.months, apr: activePlan.apr, minAmount: activePlan.minAmount } : null;
  const optCount = estimate.options.filter(o => o.equipment.length > 0).length;

  return (
    <div className="min-h-screen bg-white">
      {/* Advisor Toolbar */}
      <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between text-sm print:hidden">
        <button onClick={() => router.push(`/estimates/${estimate.id}`)} className="text-gray-400 hover:text-white">&larr; Back to Editor</button>
        <span className="text-gray-400">Status: <span className="text-white font-medium">{estimate.status}</span></span>
      </div>

      {/* Header */}
      <div className="bg-[var(--christmas-green)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-base sm:text-xl">CA</span>
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold">Your Comfort Options</h1>
              <p className="text-white/80 text-xs sm:text-sm">{estimate.customerName || 'Valued Customer'} &middot; {estimate.customerAddress}</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-white/60 text-xs">Prepared by</div>
            <div className="font-medium">{estimate.advisorName || 'Christmas Air'}</div>
          </div>
        </div>
      </div>

      {/* Cash / Finance Toggle */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1">
            <button onClick={() => setPricingMode('cash')}
              className={`px-5 py-2 rounded-full text-sm font-semibold ${pricingMode === 'cash' ? 'bg-[var(--christmas-green)] text-white shadow-sm' : 'text-gray-600'}`}>
              Cash Price
            </button>
            <button onClick={() => setPricingMode('finance')}
              className={`px-5 py-2 rounded-full text-sm font-semibold ${pricingMode === 'finance' ? 'bg-[var(--christmas-green)] text-white shadow-sm' : 'text-gray-600'}`}>
              Monthly Payment
            </button>
          </div>
          {pricingMode === 'finance' && (
            <div className="flex gap-2">
              {financingPlans.map(plan => (
                <button key={plan.id} onClick={() => setSelectedTerm(plan.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${selectedTerm === plan.id ? 'border-[var(--christmas-green)] bg-green-50 text-[var(--christmas-green)]' : 'border-gray-200 text-gray-500'}`}>
                  {plan.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Option Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className={`grid gap-4 sm:gap-5 items-end ${
          optCount === 1 ? 'grid-cols-1 max-w-md mx-auto' :
          optCount === 2 ? 'grid-cols-2 max-w-3xl mx-auto' :
          optCount === 3 ? 'grid-cols-3' :
          optCount === 4 ? 'grid-cols-2 md:grid-cols-4' :
          'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
        }`}>
          {estimate.options.filter(o => o.equipment.length > 0).map((opt, idx) => {
            const total = getOptionTotal(opt);
            const monthly = activeTerm ? getMonthlyPayment(total, activeTerm) : total / 60;
            const tierConfig = getTierConfig(opt.label);
            const bullets = getTierBullets(tierConfig);
            const isSelected = selectedId === opt.id;
            const primaryEquip = opt.equipment[0];
            const seer = primaryEquip?.seer || 0;

            // Clean system name - just the description, no codes
            const systemName = primaryEquip
              ? primaryEquip.name.replace(/^\d+\s*-\s*/, '')
              : `${opt.label} Comfort System`;

            return (
              <div
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                className={`relative rounded-2xl border-2 transition-all cursor-pointer ${
                  isSelected
                    ? `${tierConfig.borderColor} ring-2 shadow-xl scale-[1.02]`
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-lg'
                }`}
                style={isSelected ? { borderColor: tierConfig.color, boxShadow: `0 0 0 2px ${tierConfig.color}30` } : undefined}
              >
                {/* Tier Label */}
                <div className={`rounded-t-xl px-4 py-3 text-center ${tierConfig.bgColor}`}
                  style={{ borderBottom: `3px solid ${tierConfig.color}` }}>
                  <span className={`text-lg font-bold ${tierConfig.textColor}`}>{opt.label}</span>
                </div>

                {/* Fixed-height top section: photo + brand + name */}
                <div className="h-44 sm:h-52 flex flex-col items-center justify-center px-3 sm:px-4">
                  <img
                    src={getSystemImage(seer, opt.label, primaryEquip?.brand)}
                    alt={systemName}
                    className="w-20 h-20 sm:w-28 sm:h-28 object-contain"
                  />
                  <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: tierConfig.color }}>
                    {primaryEquip?.brand || tierConfig.brand || 'American Standard'}
                  </div>
                  <h3 className="font-bold text-gray-900 text-xs sm:text-sm leading-tight mt-0.5">{opt.label} Series</h3>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 line-clamp-1">{systemName}</p>
                </div>

                {/* Price — always aligned across cards */}
                <div className="mx-2 sm:mx-3 py-3 sm:py-4 bg-gray-50 rounded-xl text-center">
                  {pricingMode === 'cash' ? (
                    <>
                      <div className="text-xl sm:text-3xl font-black text-gray-900">{fmt(total)}</div>
                      <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Installed Price</div>
                    </>
                  ) : (
                    <>
                      <div className="text-xl sm:text-3xl font-black text-[var(--christmas-green)]">{fmtMo(monthly)}<span className="text-sm sm:text-lg font-semibold">/mo</span></div>
                      <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">{activeTerm?.name}</div>
                    </>
                  )}
                </div>

                {/* Bullet Points */}
                <div className="px-3 sm:px-4 pt-3 sm:pt-4">
                  <ul className="space-y-1.5 sm:space-y-2">
                    {bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-700">
                        <span className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-white mt-0.5 text-[8px] sm:text-xs"
                          style={{ backgroundColor: tierConfig.color }}>&#10003;</span>
                        <span className="leading-tight">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Badges */}
                <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
                  <div className="flex flex-wrap gap-1">
                    <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-50 text-blue-700 rounded-md text-[10px] sm:text-xs font-medium">{tierConfig.laborWarranty} Labor</span>
                    <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-green-50 text-green-700 rounded-md text-[10px] sm:text-xs font-medium">{tierConfig.noiseLevel}</span>
                    <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-amber-50 text-amber-700 rounded-md text-[10px] sm:text-xs font-medium">{tierConfig.coolingSavings}</span>
                  </div>
                </div>

                {/* Select Button */}
                <div className="p-3 sm:p-4 pt-2">
                  <button
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                      isSelected ? 'text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    style={isSelected ? { backgroundColor: tierConfig.color } : undefined}
                  >
                    {isSelected ? '\u2713 Selected' : 'Learn More'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Accept / ST Push */}
        {selectedId && (
          <div className="text-center mt-8 space-y-4">
            {estimate.status === 'accepted' ? (
              <>
                <div className="inline-flex items-center gap-2 px-8 py-4 bg-green-50 text-green-700 rounded-2xl font-semibold text-lg">
                  <span>&#10003;</span> Option Accepted
                </div>
                {pushing && <div className="text-sm text-blue-600">Syncing to ServiceTitan...</div>}
                {pushResult && <div className={`text-sm ${pushResult.success ? 'text-green-600' : 'text-red-600'}`}>{pushResult.message}</div>}
                {estimate.stJobId && !estimate.stEstimateId && !pushing && (
                  <button onClick={() => pushToServiceTitan(estimate)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700">
                    Push to ServiceTitan
                  </button>
                )}
              </>
            ) : (
              <button onClick={handleAccept}
                className="px-10 py-4 bg-[var(--christmas-green)] text-white rounded-2xl font-bold text-lg hover:bg-[var(--christmas-green-dark)] shadow-lg hover:shadow-xl">
                Accept &amp; Proceed
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 pb-8 text-xs text-gray-400">
          <p className="font-medium text-gray-500">Christmas Air Conditioning &amp; Plumbing</p>
          <p>Denton, TX &middot; (940) 566-1122</p>
          <p className="mt-1">Prices valid for 30 days from date of proposal</p>
        </div>
      </div>
    </div>
  );
}
