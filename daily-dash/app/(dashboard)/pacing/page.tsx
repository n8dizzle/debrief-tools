'use client';

import { useEffect, useState } from 'react';
import PacingSection from '@/features/pacing/components/PacingSection';
import { useHuddleData } from '@/lib/hooks/useHuddleData';

interface DepartmentRevenue {
  revenue: number;
  completedRevenue: number;
  nonJobRevenue: number;
  adjRevenue: number;
}

interface HVACPeriodData extends DepartmentRevenue {
  departments: {
    install: DepartmentRevenue;
    service: DepartmentRevenue;
    maintenance: DepartmentRevenue;
  };
}

interface TradeData {
  hvac: {
    today: HVACPeriodData;
    wtd: HVACPeriodData;
    mtd: HVACPeriodData;
    qtd: HVACPeriodData;
    ytd: HVACPeriodData;
  };
  plumbing: {
    today: DepartmentRevenue;
    wtd: DepartmentRevenue;
    mtd: DepartmentRevenue;
    qtd: DepartmentRevenue;
    ytd: DepartmentRevenue;
  };
}

// PacingApiResponse is now handled by useHuddleData hook

interface PacingData {
  today: { current: number; target: number };
  week: { current: number; target: number };
  month: { current: number; target: number };
  year: { current: number; target: number };
}

// Business days in each month for 2026
const BUSINESS_DAYS_BY_MONTH = [22, 19, 22, 22, 21, 22, 23, 21, 21, 23, 19, 23];

function getBusinessDaysInMonth(month: number): number {
  return BUSINESS_DAYS_BY_MONTH[month] || 22;
}

function getBusinessDaysElapsedInMonth(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  let elapsed = 0;
  for (let day = 1; day < today; day++) {
    const d = new Date(year, month, day);
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) elapsed += 1;
    else if (dow === 6) elapsed += 0.5;
  }
  return elapsed;
}

export default function PacingPage() {
  // Use SWR for cached data fetching - instant load on subsequent navigations
  const { pacing: p, isLoading, isValidating } = useHuddleData();

  // Derived state - computed from API response
  const [companyPacing, setCompanyPacing] = useState<PacingData>({
    today: { current: 0, target: 0 },
    week: { current: 0, target: 0 },
    month: { current: 0, target: 0 },
    year: { current: 0, target: 0 },
  });
  const [hvacInstallPacing, setHvacInstallPacing] = useState<PacingData>({
    today: { current: 0, target: 0 },
    week: { current: 0, target: 0 },
    month: { current: 0, target: 0 },
    year: { current: 0, target: 0 },
  });
  const [hvacServicePacing, setHvacServicePacing] = useState<PacingData>({
    today: { current: 0, target: 0 },
    week: { current: 0, target: 0 },
    month: { current: 0, target: 0 },
    year: { current: 0, target: 0 },
  });
  const [hvacMaintenancePacing, setHvacMaintenancePacing] = useState<PacingData>({
    today: { current: 0, target: 0 },
    week: { current: 0, target: 0 },
    month: { current: 0, target: 0 },
    year: { current: 0, target: 0 },
  });
  const [plumbingPacing, setPlumbingPacing] = useState<PacingData>({
    today: { current: 0, target: 0 },
    week: { current: 0, target: 0 },
    month: { current: 0, target: 0 },
    year: { current: 0, target: 0 },
  });

  // Update derived state when API data changes
  useEffect(() => {
    if (!p) return;

    // Get current month info for target calculations
    const now = new Date();
    const month = now.getMonth();
    const businessDaysInMonth = getBusinessDaysInMonth(month);
    const dayOfWeek = now.getDay();

    // Daily target factor (0 Sunday, 0.5 Saturday, 1 weekday)
    const dailyFactor = dayOfWeek === 0 ? 0 : dayOfWeek === 6 ? 0.5 : 1;

    // Weekly target = 5.5 business days worth
    const weeklyFactor = 5.5;

    // Calculate department monthly targets (from API or derive from monthly proportions)
    const hvacInstallMonthly = p.hvacInstallMonthlyTarget || Math.round(p.monthlyTarget * 0.665);
    const hvacServiceMonthly = p.hvacServiceMonthlyTarget || Math.round(p.monthlyTarget * 0.145);
    const hvacMaintenanceMonthly = p.hvacMaintenanceMonthlyTarget || Math.round(p.monthlyTarget * 0.036);
    const plumbingMonthly = p.plumbingMonthlyTarget || Math.round(p.monthlyTarget * 0.152);

    // Calculate daily targets from monthly
    const hvacInstallDaily = hvacInstallMonthly / businessDaysInMonth;
    const hvacServiceDaily = hvacServiceMonthly / businessDaysInMonth;
    const hvacMaintenanceDaily = hvacMaintenanceMonthly / businessDaysInMonth;
    const plumbingDaily = plumbingMonthly / businessDaysInMonth;

    // Annual targets - use actual values from API (sum of 12 monthly targets)
    const hvacInstallAnnual = p.hvacInstallAnnualTarget || hvacInstallMonthly * 12;
    const hvacServiceAnnual = p.hvacServiceAnnualTarget || hvacServiceMonthly * 12;
    const hvacMaintenanceAnnual = p.hvacMaintenanceAnnualTarget || hvacMaintenanceMonthly * 12;
    const plumbingAnnual = p.plumbingAnnualTarget || plumbingMonthly * 12;

    // Company Pacing
    setCompanyPacing({
      today: {
        current: p.todayRevenue,
        target: Math.round(p.dailyTarget * dailyFactor)
      },
      week: {
        current: p.wtdRevenue,
        target: p.weeklyTarget
      },
      month: {
        current: p.mtdRevenue,
        target: p.monthlyTarget
      },
      year: {
        current: p.ytdRevenue,
        target: p.annualTarget
      },
    });

    // HVAC Install Pacing
    const hvacInstall = p.trades?.hvac;
    setHvacInstallPacing({
      today: {
        current: hvacInstall?.today?.departments?.install?.revenue || 0,
        target: Math.round(hvacInstallDaily * dailyFactor),
      },
      week: {
        current: hvacInstall?.wtd?.departments?.install?.revenue || 0,
        target: Math.round(hvacInstallDaily * weeklyFactor),
      },
      month: {
        current: hvacInstall?.mtd?.departments?.install?.revenue || 0,
        target: hvacInstallMonthly,
      },
      year: {
        current: hvacInstall?.ytd?.departments?.install?.revenue || 0,
        target: hvacInstallAnnual,
      },
    });

    // HVAC Service Pacing
    setHvacServicePacing({
      today: {
        current: hvacInstall?.today?.departments?.service?.revenue || 0,
        target: Math.round(hvacServiceDaily * dailyFactor),
      },
      week: {
        current: hvacInstall?.wtd?.departments?.service?.revenue || 0,
        target: Math.round(hvacServiceDaily * weeklyFactor),
      },
      month: {
        current: hvacInstall?.mtd?.departments?.service?.revenue || 0,
        target: hvacServiceMonthly,
      },
      year: {
        current: hvacInstall?.ytd?.departments?.service?.revenue || 0,
        target: hvacServiceAnnual,
      },
    });

    // HVAC Maintenance Pacing
    setHvacMaintenancePacing({
      today: {
        current: hvacInstall?.today?.departments?.maintenance?.revenue || 0,
        target: Math.round(hvacMaintenanceDaily * dailyFactor),
      },
      week: {
        current: hvacInstall?.wtd?.departments?.maintenance?.revenue || 0,
        target: Math.round(hvacMaintenanceDaily * weeklyFactor),
      },
      month: {
        current: hvacInstall?.mtd?.departments?.maintenance?.revenue || 0,
        target: hvacMaintenanceMonthly,
      },
      year: {
        current: hvacInstall?.ytd?.departments?.maintenance?.revenue || 0,
        target: hvacMaintenanceAnnual,
      },
    });

    // Plumbing Pacing
    const plumbing = p.trades?.plumbing;
    setPlumbingPacing({
      today: {
        current: plumbing?.today?.revenue || 0,
        target: Math.round(plumbingDaily * dailyFactor),
      },
      week: {
        current: plumbing?.wtd?.revenue || 0,
        target: Math.round(plumbingDaily * weeklyFactor),
      },
      month: {
        current: plumbing?.mtd?.revenue || 0,
        target: plumbingMonthly,
      },
      year: {
        current: plumbing?.ytd?.revenue || 0,
        target: plumbingAnnual,
      },
    });
  }, [p]);

  // Show loading only on first load (no cached data)
  if (isLoading && !p) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--christmas-cream)' }}>
            Goal Pacing
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--christmas-cream)' }}>
            Goal Pacing
          </h1>
          {/* Show subtle indicator when refreshing in background */}
          {isValidating && !isLoading && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs" style={{ backgroundColor: 'var(--bg-card)' }}>
              <svg className="w-3 h-3 animate-spin" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span style={{ color: 'var(--text-muted)' }}>Refreshing</span>
            </div>
          )}
        </div>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Company and department revenue tracking against targets
        </p>
      </div>

      {/* Company-Wide Pacing */}
      <div className="mb-8">
        <PacingSection data={companyPacing} title="Company Revenue Pacing" />
      </div>

      {/* Department Breakdowns */}
      <div className="space-y-6">
        <PacingSection data={hvacInstallPacing} title="HVAC Install" />
        <PacingSection data={hvacServicePacing} title="HVAC Service" />
        <PacingSection data={hvacMaintenancePacing} title="HVAC Maintenance" />
        <PacingSection data={plumbingPacing} title="Plumbing" />
      </div>
    </div>
  );
}
