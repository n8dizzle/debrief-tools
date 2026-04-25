'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { LSADailyChart, LSADailyDataPoint } from '@/components/LSADailyChart';

interface LSALead {
  id: string;
  leadType: string;
  leadTypeFormatted: string;
  categoryId: string;
  categoryFormatted: string;
  trade: 'HVAC' | 'Plumbing' | 'Other';
  serviceName: string;
  contactDetails: {
    phoneNumber?: string;
    consumerPhoneNumber?: string;
  };
  leadStatus: string;
  leadStatusFormatted: string;
  creationDateTime: string;
  creationDate: string;
  creationTime: string;
  locale: string;
  leadCharged: boolean;
  customerId?: string;
  creditDetails?: {
    creditState: string;
    creditStateLastUpdateDateTime?: string;
  };
}

interface LeadSummary {
  totalLeads: number;
  phoneLeads: number;
  messageLeads: number;
  bookingLeads: number;
  chargedLeads: number;
  nonChargedLeads: number;
  newLeads: number;
  bookedLeads: number;
}

interface TradeBreakdown {
  hvac: { total: number; charged: number; nonCharged: number };
  plumbing: { total: number; charged: number; nonCharged: number };
  other: { total: number; charged: number; nonCharged: number };
}

interface LocationBreakdown {
  customerId: string;
  customerName?: string;
  total: number;
  charged: number;
  nonCharged: number;
  hvac: number;
  plumbing: number;
  other: number;
}

interface PerformanceAccount {
  customerId: string;
  customerName: string;
  impressions: number;
  clicks: number;
  totalLeads: number;
  chargedLeads: number;
  cost: number;
  costPerLead: number;
  costPerChargedLead: number;
  chargeRate: number;
  phoneLeads: number;
  messageLeads: number;
  period: string;
}

interface PerformanceTotals {
  impressions: number;
  clicks: number;
  totalLeads: number;
  chargedLeads: number;
  nonChargedLeads: number;
  cost: number;
  phoneLeads: number;
  messageLeads: number;
  avgCostPerLead: number;
  costPerChargedLead: number;
  clickThroughRate: number;
  conversionRate: number;
  chargeRate: number;
}

interface DailyData {
  daily: LSADailyDataPoint[];
  monthly?: { month: string; total: number; hvac: number; plumbing: number; charged: number }[];
  totals: { total: number; hvac: number; plumbing: number; charged: number };
  avgPerDay: { total: number; hvac: number; plumbing: number; charged: number };
}

type TradeFilter = 'all' | 'hvac' | 'plumbing';

interface ComparisonLocationBreakdown {
  customerId: string;
  customerName: string;
  total: number;
  charged: number;
  nonCharged: number;
  booked: number;
  hvac: number;
  plumbing: number;
  other: number;
}

interface ComparisonPeriod {
  locations: ComparisonLocationBreakdown[];
  totals: { total: number; charged: number; booked: number; hvac: number; plumbing: number };
  dateRange: { start: string; end: string };
}

interface ComparisonData {
  current: ComparisonPeriod;
  yoy: ComparisonPeriod;
  mom: ComparisonPeriod;
  spendByPeriod: {
    current: Record<string, number>;
    yoy: Record<string, number>;
    mom: Record<string, number>;
  };
  impressionsByPeriod: {
    current: Record<string, number>;
    yoy: Record<string, number>;
    mom: Record<string, number>;
  };
  impressionShareByPeriod: {
    current: Record<string, { topShare: number; absTopShare: number }>;
    yoy: Record<string, { topShare: number; absTopShare: number }>;
    mom: Record<string, { topShare: number; absTopShare: number }>;
  };
  stMetrics: Record<string, {
    booked: number;
    revenue: number;
    avgTicket: number;
    jobCount: number;
  }>;
}

interface SyncStatus {
  totalLeads: number;
  totalAccounts: number;
  lastSyncedAt: string | null;
  dateRange: {
    earliest: string | null;
    latest: string | null;
  };
}

function YoYBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-sm text-gray-600">—</span>;
  const isPositive = value >= 0;
  const sign = isPositive ? '+' : '';
  return (
    <span
      className="text-sm font-medium tabular-nums"
      style={{ color: isPositive ? '#5d8a66' : '#c97878' }}
    >
      {sign}{value.toFixed(0)}%
    </span>
  );
}

export default function LSAPage() {
  const { data: session } = useSession();

  // Initialize with MTD (same as GBP page)
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });

  const [leads, setLeads] = useState<LSALead[]>([]);
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [tradeBreakdown, setTradeBreakdown] = useState<TradeBreakdown | null>(null);
  const [locationBreakdown, setLocationBreakdown] = useState<LocationBreakdown[]>([]);
  const [performanceAccounts, setPerformanceAccounts] = useState<PerformanceAccount[]>([]);
  const [performance, setPerformance] = useState<PerformanceTotals | null>(null);
  const [dailyData, setDailyData] = useState<DailyData | null>(null);

  const [loading, setLoading] = useState(true);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'locations' | 'leads'>('locations');
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>('all');
  const [dataSource, setDataSource] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  const fetchComparisonData = useCallback(async () => {
    setComparisonLoading(true);
    try {
      const res = await fetch(
        `/api/lsa/leads/compare?start=${dateRange.start}&end=${dateRange.end}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to fetch comparison data');
      const data = await res.json();
      setComparisonData(data);
    } catch (err) {
      console.error('Failed to fetch comparison data:', err);
      setComparisonData(null);
    } finally {
      setComparisonLoading(false);
    }
  }, [dateRange]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [leadsRes, perfRes] = await Promise.all([
        fetch(`/api/lsa/leads?start=${dateRange.start}&end=${dateRange.end}`, { credentials: 'include' }),
        fetch(`/api/lsa/performance?start=${dateRange.start}&end=${dateRange.end}`, { credentials: 'include' }),
      ]);

      if (!leadsRes.ok) {
        const data = await leadsRes.json();
        throw new Error(data.error || 'Failed to fetch leads');
      }

      if (!perfRes.ok) {
        const data = await perfRes.json();
        throw new Error(data.error || 'Failed to fetch performance');
      }

      const leadsData = await leadsRes.json();
      const perfData = await perfRes.json();

      setLeads(leadsData.leads || []);
      setSummary(leadsData.summary || null);
      setTradeBreakdown(leadsData.tradeBreakdown || null);
      setLocationBreakdown(leadsData.locationBreakdown || []);
      setDataSource(leadsData.source || '');
      setPerformance(perfData.totals || null);
      setPerformanceAccounts(perfData.accounts || []);
    } catch (err: any) {
      console.error('Error fetching LSA data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const fetchDailyData = useCallback(async () => {
    setDailyLoading(true);
    try {
      const res = await fetch(`/api/lsa/leads/daily?start=${dateRange.start}&end=${dateRange.end}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch daily data');
      const data = await res.json();
      setDailyData(data);
    } catch (err) {
      console.error('Failed to fetch daily LSA data:', err);
      setDailyData(null);
    } finally {
      setDailyLoading(false);
    }
  }, [dateRange]);

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch('/api/lsa/sync', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data);
      }
    } catch (err) {
      console.error('Error fetching sync status:', err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchDailyData();
    fetchComparisonData();
    fetchSyncStatus();
  }, [fetchData, fetchDailyData, fetchComparisonData]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);

    try {
      const res = await fetch('/api/lsa/sync?days=90', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Sync failed');
      }

      await fetchData();
      await fetchDailyData();
      await fetchComparisonData();
      await fetchSyncStatus();
    } catch (err: any) {
      console.error('Sync error:', err);
      setError(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleDateChange = (range: DateRange) => {
    setDateRange(range);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyDecimal = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  const getLeadTypeIcon = (type: string) => {
    switch (type) {
      case 'PHONE_CALL':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        );
      case 'MESSAGE':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        );
      case 'BOOKING':
        return (
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      NEW: 'bg-blue-500/20 text-blue-400',
      ACTIVE: 'bg-green-500/20 text-green-400',
      BOOKED: 'bg-purple-500/20 text-purple-400',
      DECLINED: 'bg-red-500/20 text-red-400',
      EXPIRED: 'bg-gray-500/20 text-gray-400',
      CONSUMER_DECLINED: 'bg-orange-500/20 text-orange-400',
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400';
  };

  const getTradeBadge = (trade: string) => {
    switch (trade) {
      case 'HVAC':
        return 'bg-[#346643]/30 text-[#6eb887]';
      case 'Plumbing':
        return 'bg-[#B8956B]/30 text-[#B8956B]';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  // Filter leads by trade
  const filteredLeads = leads.filter(lead => {
    if (tradeFilter === 'all') return true;
    if (tradeFilter === 'hvac') return lead.trade === 'HVAC';
    if (tradeFilter === 'plumbing') return lead.trade === 'Plumbing';
    return true;
  });

  // Match location breakdown with performance accounts to get names
  const enrichedLocations = locationBreakdown.map(loc => {
    const perfAccount = performanceAccounts.find(a => a.customerId === loc.customerId);
    return {
      ...loc,
      customerName: perfAccount?.customerName || loc.customerName || `Account ${loc.customerId.slice(-4)}`,
      cost: perfAccount?.cost || 0,
      costPerChargedLead: loc.charged > 0 && perfAccount ? perfAccount.cost / loc.charged : 0,
    };
  });

  if (loading && !dailyData) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#1a2e1a] rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-[#1a2e1a] rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Local Service Ads
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Lead generation and performance tracking
            {dataSource && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                {dataSource === 'cache' ? 'Cached' : 'Live'}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker
            value={dateRange}
            onChange={handleDateChange}
            dataDelay={0}
          />
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            style={{
              backgroundColor: 'var(--christmas-gold)',
              color: 'var(--dark-bg)',
            }}
          >
            {syncing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                Sync
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Key Metrics Cards - Use summary from leads API for accurate counts, performance API for spend/impressions */}
      {(summary || performance) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Total Leads - from leads API (accurate) */}
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--christmas-green)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Total Leads</div>
                <div className="text-xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
                  {formatNumber(summary?.totalLeads || 0)}
                </div>
              </div>
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: '#22c55e' }}>{summary?.chargedLeads || 0} charged</span>
              <span className="mx-1">·</span>
              <span>{summary?.nonChargedLeads || 0} free</span>
            </div>
          </div>

          {/* Total Spend - from performance API */}
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--christmas-green)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Total Spend</div>
                <div className="text-xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
                  {formatCurrency(performance?.cost || 0)}
                </div>
              </div>
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {summary && summary.totalLeads > 0
                ? formatPercent((summary.chargedLeads / summary.totalLeads) * 100)
                : '0.0%'} charge rate
            </div>
          </div>

          {/* Cost Per Charged Lead - calculated from both APIs */}
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--christmas-green)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Cost/Charged Lead</div>
                <div className="text-xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
                  {formatCurrencyDecimal(
                    summary?.chargedLeads && performance?.cost
                      ? performance.cost / summary.chargedLeads
                      : 0
                  )}
                </div>
              </div>
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {formatCurrencyDecimal(
                summary?.totalLeads && performance?.cost
                  ? performance.cost / summary.totalLeads
                  : 0
              )} per all leads
            </div>
          </div>

          {/* Impressions - from performance API */}
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--christmas-green)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Impressions</div>
                <div className="text-xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
                  {formatNumber(performance?.impressions || 0)}
                </div>
              </div>
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {formatPercent(performance?.clickThroughRate || 0)} CTR
            </div>
          </div>
        </div>
      )}

      {/* HVAC vs Plumbing Breakdown */}
      {tradeBreakdown && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* HVAC Card */}
          <div className="bg-[#1a2e1a] rounded-lg p-5 border-l-4 border-[#346643]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#346643]/30 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#6eb887]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-lg font-semibold text-[#E8DFC4]">HVAC</span>
              </div>
              <span className="text-2xl font-bold text-[#E8DFC4]">{tradeBreakdown.hvac.total}</span>
            </div>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-green-400 font-medium">{tradeBreakdown.hvac.charged}</span>
                <span className="text-gray-500 ml-1">charged</span>
              </div>
              <div>
                <span className="text-gray-400 font-medium">{tradeBreakdown.hvac.nonCharged}</span>
                <span className="text-gray-500 ml-1">free (returning)</span>
              </div>
            </div>
            {tradeBreakdown.hvac.total > 0 && (
              <div className="mt-3">
                <div className="h-2 bg-[#0d1f0d] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#346643] rounded-full"
                    style={{ width: `${(tradeBreakdown.hvac.charged / tradeBreakdown.hvac.total) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatPercent((tradeBreakdown.hvac.charged / tradeBreakdown.hvac.total) * 100)} charge rate
                </div>
              </div>
            )}
          </div>

          {/* Plumbing Card */}
          <div className="bg-[#1a2e1a] rounded-lg p-5 border-l-4 border-[#B8956B]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#B8956B]/30 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#B8956B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <span className="text-lg font-semibold text-[#E8DFC4]">Plumbing</span>
              </div>
              <span className="text-2xl font-bold text-[#E8DFC4]">{tradeBreakdown.plumbing.total}</span>
            </div>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-green-400 font-medium">{tradeBreakdown.plumbing.charged}</span>
                <span className="text-gray-500 ml-1">charged</span>
              </div>
              <div>
                <span className="text-gray-400 font-medium">{tradeBreakdown.plumbing.nonCharged}</span>
                <span className="text-gray-500 ml-1">free (returning)</span>
              </div>
            </div>
            {tradeBreakdown.plumbing.total > 0 && (
              <div className="mt-3">
                <div className="h-2 bg-[#0d1f0d] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#B8956B] rounded-full"
                    style={{ width: `${(tradeBreakdown.plumbing.charged / tradeBreakdown.plumbing.total) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatPercent((tradeBreakdown.plumbing.charged / tradeBreakdown.plumbing.total) * 100)} charge rate
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Daily Chart */}
      <LSADailyChart
        data={dailyData?.daily || []}
        monthly={dailyData?.monthly}
        totals={dailyData?.totals || { total: 0, hvac: 0, plumbing: 0, charged: 0 }}
        avgPerDay={dailyData?.avgPerDay || { total: 0, hvac: 0, plumbing: 0, charged: 0 }}
        isLoading={dailyLoading}
        title="Daily Leads"
      />

      {/* Tabs */}
      <div className="border-b border-[#2a3e2a]">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('locations')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'locations'
                ? 'border-[#346643] text-[#E8DFC4]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            By Location ({enrichedLocations.length})
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'leads'
                ? 'border-[#346643] text-[#E8DFC4]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            All Leads ({leads.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'locations' && (
        <div>
          {comparisonData && (
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              YoY: vs {comparisonData.yoy.dateRange.start} to {comparisonData.yoy.dateRange.end}
              {' · MoM: vs '}
              {comparisonData.mom.dateRange.start} to {comparisonData.mom.dateRange.end}
            </p>
          )}
          <div className="bg-[#1a2e1a] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              {comparisonLoading && !comparisonData ? (
                <div className="p-8 text-center">
                  <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-10 bg-[#0d1f0d] rounded"></div>
                    ))}
                  </div>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2a3e2a]">
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-400">Location</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-400">Leads</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-400">YoY</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-400">MoM</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-400">
                        <span className="text-[#6eb887]">H</span> / <span className="text-[#B8956B]">P</span>
                      </th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-400">Impr</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-400" title="Top impression rate on Search">Top %</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-400" title="Absolute top impression rate on Search">Abs Top %</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-400">Spend</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-400 border-l border-[#2a3e2a]">ST Jobs</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-400">Revenue</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-400">Avg Ticket</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-400">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!comparisonData || comparisonData.current.locations.length === 0) ? (
                      <tr>
                        <td colSpan={13} className="py-8 text-center text-gray-500">
                          No location data found for this period
                        </td>
                      </tr>
                    ) : (
                      <>
                        {comparisonData.current.locations.map((loc) => {
                          const yoyLoc = comparisonData.yoy.locations.find(y => y.customerId === loc.customerId);
                          const momLoc = comparisonData.mom.locations.find(m => m.customerId === loc.customerId);

                          const totalYoY = yoyLoc && yoyLoc.total > 0
                            ? ((loc.total - yoyLoc.total) / yoyLoc.total) * 100 : null;
                          const totalMoM = momLoc && momLoc.total > 0
                            ? ((loc.total - momLoc.total) / momLoc.total) * 100 : null;

                          const currentSpend = comparisonData.spendByPeriod.current[loc.customerId] || 0;
                          const stLoc = comparisonData.stMetrics?.[loc.customerId];
                          const roas = currentSpend > 0 && stLoc?.revenue ? stLoc.revenue / currentSpend : 0;

                          return (
                            <tr key={loc.customerId} className="border-b border-[#2a3e2a] hover:bg-[#0d1f0d] transition-colors">
                              <td className="py-3 px-3">
                                <div className="text-[#E8DFC4] font-medium">{loc.customerName}</div>
                              </td>
                              <td className="py-3 px-3 text-right text-[#E8DFC4] font-medium">
                                {loc.total}
                                {yoyLoc && yoyLoc.total > 0 ? (
                                  <div className="text-xs text-gray-500">was {yoyLoc.total}</div>
                                ) : null}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <YoYBadge value={totalYoY} />
                              </td>
                              <td className="py-3 px-3 text-right">
                                <YoYBadge value={totalMoM} />
                              </td>
                              <td className="py-3 px-3 text-right">
                                <span className="text-[#6eb887]">{loc.hvac}</span>
                                <span className="text-gray-600 mx-0.5">/</span>
                                <span className="text-[#B8956B]">{loc.plumbing}</span>
                              </td>
                              <td className="py-3 px-3 text-right text-gray-300">
                                {(() => {
                                  const impr = comparisonData.impressionsByPeriod?.current[loc.customerId] || 0;
                                  return impr > 0 ? formatNumber(impr) : '—';
                                })()}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-300">
                                {(() => {
                                  const share = comparisonData.impressionShareByPeriod?.current[loc.customerId];
                                  return share && share.topShare > 0 ? `${(share.topShare * 100).toFixed(1)}%` : '—';
                                })()}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-300">
                                {(() => {
                                  const share = comparisonData.impressionShareByPeriod?.current[loc.customerId];
                                  return share && share.absTopShare > 0 ? `${(share.absTopShare * 100).toFixed(1)}%` : '—';
                                })()}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-300">
                                {currentSpend > 0 ? formatCurrency(currentSpend) : '—'}
                              </td>
                              <td className="py-3 px-3 text-right text-purple-400 border-l border-[#2a3e2a]">
                                {stLoc && stLoc.jobCount > 0 ? stLoc.jobCount : '—'}
                              </td>
                              <td className="py-3 px-3 text-right text-green-400">
                                {stLoc && stLoc.revenue > 0 ? formatCurrency(stLoc.revenue) : '—'}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-300">
                                {stLoc && stLoc.avgTicket > 0 ? formatCurrencyDecimal(stLoc.avgTicket) : '—'}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-300">
                                {roas > 0 ? `${roas.toFixed(1)}x` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Totals row */}
                        {(() => {
                          const ct = comparisonData.current.totals;
                          const yt = comparisonData.yoy.totals;
                          const mt = comparisonData.mom.totals;
                          const totalYoY = yt.total > 0 ? ((ct.total - yt.total) / yt.total) * 100 : null;
                          const totalMoM = mt.total > 0 ? ((ct.total - mt.total) / mt.total) * 100 : null;

                          const totalCurrentSpend = Object.values(comparisonData.spendByPeriod.current).reduce((s, v) => s + v, 0);
                          const st = comparisonData.stMetrics?._total;
                          const roas = totalCurrentSpend > 0 && st?.revenue ? st.revenue / totalCurrentSpend : 0;

                          return (
                            <tr className="bg-[#0d1f0d] font-semibold">
                              <td className="py-3 px-3 text-[#E8DFC4]">TOTAL</td>
                              <td className="py-3 px-3 text-right text-[#E8DFC4]">
                                {ct.total}
                                {yt.total > 0 && <div className="text-xs text-gray-500 font-normal">was {yt.total}</div>}
                              </td>
                              <td className="py-3 px-3 text-right"><YoYBadge value={totalYoY} /></td>
                              <td className="py-3 px-3 text-right"><YoYBadge value={totalMoM} /></td>
                              <td className="py-3 px-3 text-right">
                                <span className="text-[#6eb887]">{ct.hvac}</span>
                                <span className="text-gray-600 mx-0.5">/</span>
                                <span className="text-[#B8956B]">{ct.plumbing}</span>
                              </td>
                              <td className="py-3 px-3 text-right text-gray-300">
                                {(() => {
                                  const totalImpr = Object.values(comparisonData.impressionsByPeriod?.current || {}).reduce((s, v) => s + v, 0);
                                  return totalImpr > 0 ? formatNumber(totalImpr) : '—';
                                })()}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-300">
                                {(() => {
                                  const shares = comparisonData.impressionShareByPeriod?.current || {};
                                  const impr = comparisonData.impressionsByPeriod?.current || {};
                                  let weightedSum = 0, totalImpr = 0;
                                  for (const cid of Object.keys(shares)) {
                                    const w = impr[cid] || 0;
                                    weightedSum += (shares[cid]?.topShare || 0) * w;
                                    totalImpr += w;
                                  }
                                  const avg = totalImpr > 0 ? weightedSum / totalImpr : 0;
                                  return avg > 0 ? `${(avg * 100).toFixed(1)}%` : '—';
                                })()}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-300">
                                {(() => {
                                  const shares = comparisonData.impressionShareByPeriod?.current || {};
                                  const impr = comparisonData.impressionsByPeriod?.current || {};
                                  let weightedSum = 0, totalImpr = 0;
                                  for (const cid of Object.keys(shares)) {
                                    const w = impr[cid] || 0;
                                    weightedSum += (shares[cid]?.absTopShare || 0) * w;
                                    totalImpr += w;
                                  }
                                  const avg = totalImpr > 0 ? weightedSum / totalImpr : 0;
                                  return avg > 0 ? `${(avg * 100).toFixed(1)}%` : '—';
                                })()}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-300">
                                {totalCurrentSpend > 0 ? formatCurrency(totalCurrentSpend) : '—'}
                              </td>
                              <td className="py-3 px-3 text-right text-purple-400 border-l border-[#2a3e2a]">
                                {st ? st.jobCount : '—'}
                              </td>
                              <td className="py-3 px-3 text-right text-green-400 font-medium">
                                {st && st.revenue > 0 ? formatCurrency(st.revenue) : '—'}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-300">
                                {st && st.avgTicket > 0 ? formatCurrencyDecimal(st.avgTicket) : '—'}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-300">
                                {roas > 0 ? `${roas.toFixed(1)}x` : '—'}
                              </td>
                            </tr>
                          );
                        })()}
                      </>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <>
          {/* Trade Filter */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-gray-400">Filter:</span>
            <div className="flex bg-[#1a2e1a] rounded-lg p-1">
              {(['all', 'hvac', 'plumbing'] as TradeFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setTradeFilter(f)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    tradeFilter === f
                      ? f === 'hvac'
                        ? 'bg-[#346643] text-white'
                        : f === 'plumbing'
                        ? 'bg-[#B8956B] text-white'
                        : 'bg-gray-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'hvac' ? 'HVAC' : 'Plumbing'}
                </button>
              ))}
            </div>
            <span className="text-sm text-gray-500 ml-2">
              {filteredLeads.length} leads
            </span>
          </div>

          <div className="bg-[#1a2e1a] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a3e2a]">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Trade</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Charged</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        No leads found for this period
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead) => (
                      <tr key={lead.id} className="border-b border-[#2a3e2a] hover:bg-[#0d1f0d] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getLeadTypeIcon(lead.leadType)}
                            <span className="text-[#E8DFC4]">{lead.leadTypeFormatted}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-[#E8DFC4]">{lead.creationDate}</div>
                          <div className="text-xs text-gray-500">{lead.creationTime}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTradeBadge(lead.trade)}`}>
                            {lead.trade}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(lead.leadStatus)}`}>
                            {lead.leadStatusFormatted}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {lead.leadCharged ? (
                            <span className="text-green-400 flex items-center gap-1">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Yes
                            </span>
                          ) : (
                            <span className="text-gray-500 flex items-center gap-1">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              No
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
