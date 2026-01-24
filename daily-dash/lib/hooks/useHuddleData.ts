import useSWR from 'swr';

// Fetcher function for SWR
const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((res) => {
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  });

// Cache configuration - optimized for instant navigation while maintaining accuracy
const CACHE_OPTIONS = {
  // Auto-refresh every 5 minutes when page is open
  refreshInterval: 5 * 60 * 1000,
  // Dedupe rapid requests (e.g., double-clicks) within 5 seconds
  dedupingInterval: 5 * 1000,
  // ALWAYS revalidate on mount - ensures fresh data on every page visit
  revalidateOnMount: true,
  // Don't revalidate on window focus (manual refresh available)
  revalidateOnFocus: false,
  // Revalidate on reconnect (if network dropped)
  revalidateOnReconnect: true,
  // Show cached data immediately while fetching fresh
  keepPreviousData: true,
};

export interface DepartmentRevenue {
  revenue: number;
  completedRevenue: number;
  nonJobRevenue: number;
  adjRevenue: number;
}

export interface HVACPeriodData extends DepartmentRevenue {
  departments: {
    install: DepartmentRevenue;
    service: DepartmentRevenue;
    maintenance: DepartmentRevenue;
  };
}

export interface TradeTargets {
  daily: number;
  weekly: number;
  monthly: number;
  quarterly: number;
  annual: number;
  departments?: {
    install: number;
    service: number;
    maintenance: number;
  };
}

export interface TradeData {
  hvac: {
    today: HVACPeriodData;
    wtd: HVACPeriodData;
    mtd: HVACPeriodData;
    qtd: HVACPeriodData;
    ytd: HVACPeriodData;
    targets: TradeTargets;
  };
  plumbing: {
    today: DepartmentRevenue;
    wtd: DepartmentRevenue;
    mtd: DepartmentRevenue;
    qtd: DepartmentRevenue;
    ytd: DepartmentRevenue;
    targets: TradeTargets;
  };
}

export interface MonthlyTrendData {
  month: string;
  label: string;
  hvacRevenue: number;
  plumbingRevenue: number;
  totalRevenue: number;
  goal: number;
}

export interface PacingData {
  todayRevenue: number;
  todaySales: number;
  dailyTarget: number;
  todayTarget: number;
  wtdRevenue: number;
  wtdSales: number;
  weeklyTarget: number;
  mtdRevenue: number;
  mtdSales: number;
  monthlyTarget: number;
  qtdRevenue: number;
  qtdSales: number;
  quarterlyTarget: number;
  quarter: number;
  ytdRevenue: number;
  annualTarget: number;
  expectedAnnualPacingPercent: number;
  pacingPercent: number;
  businessDaysRemaining: number;
  businessDaysElapsed: number;
  businessDaysInMonth: number;
  // Department targets (monthly)
  hvacInstallMonthlyTarget: number;
  hvacServiceMonthlyTarget: number;
  hvacMaintenanceMonthlyTarget: number;
  plumbingMonthlyTarget: number;
  // Department targets (annual)
  hvacInstallAnnualTarget: number;
  hvacServiceAnnualTarget: number;
  hvacMaintenanceAnnualTarget: number;
  plumbingAnnualTarget: number;
  // Trade data
  trades: TradeData;
  // Trend data
  monthlyTrend: MonthlyTrendData[];
}

export interface HuddleApiResponse {
  date: string;
  departments: unknown[];
  last_updated: string;
  pacing: PacingData;
  _debug?: {
    version: string;
    trendDataSource: string;
    monthCount: number;
    nonZeroMonths: number;
  };
}

/**
 * Custom hook for fetching and caching huddle dashboard data.
 * Uses SWR for stale-while-revalidate caching strategy.
 *
 * Features:
 * - Data is cached and shared across all pages
 * - Shows cached data instantly on page navigation
 * - Refreshes in background every 5 minutes
 * - Dedupes requests within 2 minute window
 *
 * @param date Optional date string (YYYY-MM-DD) for historical data
 * @returns { data, error, isLoading, isValidating, mutate }
 */
export function useHuddleData(date?: string) {
  const url = date ? `/api/huddle?date=${date}` : '/api/huddle';

  const { data, error, isLoading, isValidating, mutate } = useSWR<HuddleApiResponse>(
    url,
    fetcher,
    CACHE_OPTIONS
  );

  return {
    data,
    pacing: data?.pacing,
    error,
    isLoading, // True only on first load when no cached data
    isValidating, // True when fetching (including background refresh)
    mutate, // Function to manually refresh data
    isStale: isValidating && !isLoading, // Data is cached but being refreshed
  };
}

/**
 * Manually refresh the huddle data cache.
 * Useful after making changes that affect the data.
 */
export { mutate } from 'swr';
