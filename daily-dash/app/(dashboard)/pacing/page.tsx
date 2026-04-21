'use client';

import { useEffect, useState } from 'react';
import PacingSection from '@/features/pacing/components/PacingSection';
import { useHuddleData } from '@/lib/hooks/useHuddleData';

// Business hours: Mon-Sat 8am-6pm
const BUSINESS_START = 8;
const BUSINESS_END = 18;
const BUSINESS_HOURS = BUSINESS_END - BUSINESS_START;

function getDailyPacing(): number {
  const now = new Date();
  const dow = now.getDay();
  if (dow === 0) return 0;
  const hour = now.getHours() + now.getMinutes() / 60;
  if (hour < BUSINESS_START) return 0;
  if (hour >= BUSINESS_END) return 100;
  return Math.round(((hour - BUSINESS_START) / BUSINESS_HOURS) * 100);
}

function getWeeklyPacing(): number {
  const now = new Date();
  const dow = now.getDay();
  if (dow === 0) return 0;
  const hour = now.getHours() + now.getMinutes() / 60;
  let dayProgress = 0;
  if (hour >= BUSINESS_END) dayProgress = dow === 6 ? 0.5 : 1;
  else if (hour >= BUSINESS_START) dayProgress = ((hour - BUSINESS_START) / BUSINESS_HOURS) * (dow === 6 ? 0.5 : 1);
  const daysCompleted = dow === 6 ? 5 : dow - 1;
  return Math.round(((daysCompleted + dayProgress) / 5.5) * 100);
}

function getQuarterlyPacing(): number {
  const now = new Date();
  const qStart = Math.floor(now.getMonth() / 3) * 3;
  const quarterStart = new Date(now.getFullYear(), qStart, 1);
  const quarterEnd = new Date(now.getFullYear(), qStart + 3, 0);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let elapsed = 0, total = 0;
  const current = new Date(quarterStart);
  while (current <= quarterEnd) {
    const d = current.getDay();
    const weight = d >= 1 && d <= 5 ? 1 : d === 6 ? 0.5 : 0;
    total += weight;
    if (current < todayStart) elapsed += weight;
    current.setDate(current.getDate() + 1);
  }
  return total > 0 ? Math.round((elapsed / total) * 100) : 0;
}

interface PeriodData {
  revenue: number;
  sales: number;
  target: number;
  pacing?: number;
}

interface SectionData {
  today: PeriodData;
  week: PeriodData;
  month: PeriodData;
  quarter: PeriodData;
}

export default function PacingPage() {
  const { pacing: p, isLoading, isValidating } = useHuddleData();

  const [companyData, setCompanyData] = useState<SectionData | null>(null);
  const [hvacInstallData, setHvacInstallData] = useState<SectionData | null>(null);
  const [hvacServiceData, setHvacServiceData] = useState<SectionData | null>(null);
  const [hvacMaintenanceData, setHvacMaintenanceData] = useState<SectionData | null>(null);
  const [plumbingData, setPlumbingData] = useState<SectionData | null>(null);

  useEffect(() => {
    if (!p) return;

    const now = new Date();
    const month = now.getMonth();
    const BUSINESS_DAYS_BY_MONTH = [22, 19, 22, 22, 21, 22, 23, 21, 21, 23, 19, 23];
    const bizDaysInMonth = BUSINESS_DAYS_BY_MONTH[month] || 22;
    const dow = now.getDay();
    const dailyFactor = dow === 0 ? 0 : dow === 6 ? 0.5 : 1;

    const dailyPacing = getDailyPacing();
    const weeklyPacing = getWeeklyPacing();
    const monthlyPacing = bizDaysInMonth > 0
      ? Math.round(((p.businessDaysElapsed || 0) / bizDaysInMonth) * 100)
      : 0;
    const quarterlyPacing = getQuarterlyPacing();

    // Department monthly targets
    const hvacInstallMonthly = p.hvacInstallMonthlyTarget || Math.round(p.monthlyTarget * 0.665);
    const hvacServiceMonthly = p.hvacServiceMonthlyTarget || Math.round(p.monthlyTarget * 0.145);
    const hvacMaintenanceMonthly = p.hvacMaintenanceMonthlyTarget || Math.round(p.monthlyTarget * 0.036);
    const plumbingMonthly = p.plumbingMonthlyTarget || Math.round(p.monthlyTarget * 0.152);

    // Daily targets
    const hvacInstallDaily = hvacInstallMonthly / bizDaysInMonth;
    const hvacServiceDaily = hvacServiceMonthly / bizDaysInMonth;
    const hvacMaintenanceDaily = hvacMaintenanceMonthly / bizDaysInMonth;
    const plumbingDaily = plumbingMonthly / bizDaysInMonth;

    // Annual targets
    const hvacInstallAnnual = p.hvacInstallAnnualTarget || hvacInstallMonthly * 12;
    const hvacServiceAnnual = p.hvacServiceAnnualTarget || hvacServiceMonthly * 12;
    const hvacMaintenanceAnnual = p.hvacMaintenanceAnnualTarget || hvacMaintenanceMonthly * 12;
    const plumbingAnnual = p.plumbingAnnualTarget || plumbingMonthly * 12;

    // Quarterly targets
    const qMonths = [Math.floor(month / 3) * 3, Math.floor(month / 3) * 3 + 1, Math.floor(month / 3) * 3 + 2];

    const hvac = p.trades?.hvac;
    const plumb = p.trades?.plumbing;

    // Helper to get sales for a period
    const getSales = (trade: any, period: string) => trade?.[period]?.sales || 0;

    setCompanyData({
      today: { revenue: p.todayRevenue, sales: p.todaySales || 0, target: Math.round(p.dailyTarget * dailyFactor), pacing: dailyPacing },
      week: { revenue: p.wtdRevenue, sales: p.wtdSales || 0, target: p.weeklyTarget, pacing: weeklyPacing },
      month: { revenue: p.mtdRevenue, sales: p.mtdSales || 0, target: p.monthlyTarget, pacing: monthlyPacing },
      quarter: { revenue: p.qtdRevenue, sales: p.qtdSales || 0, target: p.quarterlyTarget, pacing: quarterlyPacing },
    });

    setHvacInstallData({
      today: { revenue: hvac?.today?.departments?.install?.revenue || 0, sales: hvac?.today?.departments?.install?.sales || 0, target: Math.round(hvacInstallDaily * dailyFactor), pacing: dailyPacing },
      week: { revenue: hvac?.wtd?.departments?.install?.revenue || 0, sales: hvac?.wtd?.departments?.install?.sales || 0, target: Math.round(hvacInstallDaily * 5.5), pacing: weeklyPacing },
      month: { revenue: hvac?.mtd?.departments?.install?.revenue || 0, sales: hvac?.mtd?.departments?.install?.sales || 0, target: hvacInstallMonthly, pacing: monthlyPacing },
      quarter: { revenue: hvac?.qtd?.departments?.install?.revenue || 0, sales: hvac?.qtd?.departments?.install?.sales || 0, target: hvacInstallAnnual / 4, pacing: quarterlyPacing },
    });

    setHvacServiceData({
      today: { revenue: hvac?.today?.departments?.service?.revenue || 0, sales: hvac?.today?.departments?.service?.sales || 0, target: Math.round(hvacServiceDaily * dailyFactor), pacing: dailyPacing },
      week: { revenue: hvac?.wtd?.departments?.service?.revenue || 0, sales: hvac?.wtd?.departments?.service?.sales || 0, target: Math.round(hvacServiceDaily * 5.5), pacing: weeklyPacing },
      month: { revenue: hvac?.mtd?.departments?.service?.revenue || 0, sales: hvac?.mtd?.departments?.service?.sales || 0, target: hvacServiceMonthly, pacing: monthlyPacing },
      quarter: { revenue: hvac?.qtd?.departments?.service?.revenue || 0, sales: hvac?.qtd?.departments?.service?.sales || 0, target: hvacServiceAnnual / 4, pacing: quarterlyPacing },
    });

    setHvacMaintenanceData({
      today: { revenue: hvac?.today?.departments?.maintenance?.revenue || 0, sales: hvac?.today?.departments?.maintenance?.sales || 0, target: Math.round(hvacMaintenanceDaily * dailyFactor), pacing: dailyPacing },
      week: { revenue: hvac?.wtd?.departments?.maintenance?.revenue || 0, sales: hvac?.wtd?.departments?.maintenance?.sales || 0, target: Math.round(hvacMaintenanceDaily * 5.5), pacing: weeklyPacing },
      month: { revenue: hvac?.mtd?.departments?.maintenance?.revenue || 0, sales: hvac?.mtd?.departments?.maintenance?.sales || 0, target: hvacMaintenanceMonthly, pacing: monthlyPacing },
      quarter: { revenue: hvac?.qtd?.departments?.maintenance?.revenue || 0, sales: hvac?.qtd?.departments?.maintenance?.sales || 0, target: hvacMaintenanceAnnual / 4, pacing: quarterlyPacing },
    });

    setPlumbingData({
      today: { revenue: plumb?.today?.revenue || 0, sales: getSales(plumb, 'today'), target: Math.round(plumbingDaily * dailyFactor), pacing: dailyPacing },
      week: { revenue: plumb?.wtd?.revenue || 0, sales: getSales(plumb, 'wtd'), target: Math.round(plumbingDaily * 5.5), pacing: weeklyPacing },
      month: { revenue: plumb?.mtd?.revenue || 0, sales: getSales(plumb, 'mtd'), target: plumbingMonthly, pacing: monthlyPacing },
      quarter: { revenue: plumb?.qtd?.revenue || 0, sales: getSales(plumb, 'qtd'), target: plumbingAnnual / 4, pacing: quarterlyPacing },
    });
  }, [p]);

  if (isLoading && !p) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--christmas-cream)' }}>Goal Pacing</h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--christmas-cream)' }}>Goal Pacing</h1>
          {p?.businessDaysRemaining !== undefined && (
            <span className="text-sm font-bold px-3 py-1 rounded-lg" style={{ backgroundColor: 'rgba(52, 102, 67, 0.15)', color: 'var(--christmas-green)', border: '1px solid rgba(52, 102, 67, 0.3)' }}>
              {p.businessDaysRemaining} days left
            </span>
          )}
          {isValidating && !isLoading && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs" style={{ backgroundColor: 'var(--bg-card)' }}>
              <svg className="w-3 h-3 animate-spin" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span style={{ color: 'var(--text-muted)' }}>Refreshing</span>
            </div>
          )}
        </div>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Company and department revenue tracking against targets</p>
      </div>

      <div className="space-y-6">
        {companyData && <PacingSection data={companyData} title="Company Revenue Pacing" />}
        {hvacInstallData && <PacingSection data={hvacInstallData} title="HVAC Install" />}
        {hvacServiceData && <PacingSection data={hvacServiceData} title="HVAC Service" />}
        {hvacMaintenanceData && <PacingSection data={hvacMaintenanceData} title="HVAC Maintenance" />}
        {plumbingData && <PacingSection data={plumbingData} title="Plumbing" />}
      </div>
    </div>
  );
}
