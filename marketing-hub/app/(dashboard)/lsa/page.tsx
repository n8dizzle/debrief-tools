'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

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

type Period = '7d' | '30d' | '90d';
type TradeFilter = 'all' | 'hvac' | 'plumbing';

interface SyncStatus {
  totalLeads: number;
  totalAccounts: number;
  lastSyncedAt: string | null;
  dateRange: {
    earliest: string | null;
    latest: string | null;
  };
}

export default function LSAPage() {
  const { data: session } = useSession();
  const [period, setPeriod] = useState<Period>('30d');
  const [leads, setLeads] = useState<LSALead[]>([]);
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [tradeBreakdown, setTradeBreakdown] = useState<TradeBreakdown | null>(null);
  const [locationBreakdown, setLocationBreakdown] = useState<LocationBreakdown[]>([]);
  const [performanceAccounts, setPerformanceAccounts] = useState<PerformanceAccount[]>([]);
  const [performance, setPerformance] = useState<PerformanceTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'locations' | 'leads'>('overview');
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>('all');
  const [dataSource, setDataSource] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    fetchData();
    fetchSyncStatus();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch leads and performance in parallel
      const [leadsRes, perfRes] = await Promise.all([
        fetch(`/api/lsa/leads?period=${period}`, { credentials: 'include' }),
        fetch(`/api/lsa/performance?period=${period}`, { credentials: 'include' }),
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
  };

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

      const result = await res.json();
      console.log('Sync result:', result);

      // Refresh data after sync
      await fetchData();
      await fetchSyncStatus();
    } catch (err: any) {
      console.error('Sync error:', err);
      setError(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
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
      customerName: perfAccount?.customerName || `Account ${loc.customerId.slice(-4)}`,
      cost: perfAccount?.cost || 0,
      costPerChargedLead: loc.charged > 0 && perfAccount ? perfAccount.cost / loc.charged : 0,
    };
  });

  if (loading) {
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E8DFC4]">Local Service Ads</h1>
          <p className="text-sm text-gray-400 mt-1">
            Lead generation and performance tracking
            {dataSource && (
              <span className="ml-2 text-xs">
                (data from {dataSource === 'cache' ? 'Supabase' : 'Google Ads API'})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <div className="flex bg-[#1a2e1a] rounded-lg p-1">
            {(['7d', '30d', '90d'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  period === p
                    ? 'bg-[#346643] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-[#B8956B] hover:bg-[#a07f5a] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {syncing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                Sync from Google
              </>
            )}
          </button>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-[#346643] hover:bg-[#3d7a4d] text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div className="bg-[#1a2e1a] rounded-lg p-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-gray-400">
            <span>
              <span className="text-[#E8DFC4] font-medium">{syncStatus.totalLeads}</span> leads synced
            </span>
            <span>·</span>
            <span>
              <span className="text-[#E8DFC4] font-medium">{syncStatus.totalAccounts}</span> accounts
            </span>
            {syncStatus.dateRange.earliest && (
              <>
                <span>·</span>
                <span>
                  Data: {new Date(syncStatus.dateRange.earliest).toLocaleDateString()} - {new Date(syncStatus.dateRange.latest || '').toLocaleDateString()}
                </span>
              </>
            )}
          </div>
          {syncStatus.lastSyncedAt && (
            <div className="text-gray-500 text-xs">
              Last synced: {new Date(syncStatus.lastSyncedAt).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Key Metrics Cards */}
      {performance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Leads */}
          <div className="bg-[#1a2e1a] rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Leads</div>
            <div className="text-2xl font-bold text-[#E8DFC4]">{formatNumber(performance.totalLeads)}</div>
            <div className="text-xs text-gray-500 mt-1 flex gap-2">
              <span className="text-green-400">{performance.chargedLeads} charged</span>
              <span>·</span>
              <span className="text-gray-400">{performance.nonChargedLeads} free</span>
            </div>
          </div>

          {/* Total Spend */}
          <div className="bg-[#1a2e1a] rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Spend</div>
            <div className="text-2xl font-bold text-[#E8DFC4]">{formatCurrency(performance.cost)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {formatPercent(performance.chargeRate)} charge rate
            </div>
          </div>

          {/* Cost Per Charged Lead */}
          <div className="bg-[#1a2e1a] rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Cost/Charged Lead</div>
            <div className="text-2xl font-bold text-[#E8DFC4]">{formatCurrencyDecimal(performance.costPerChargedLead)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {formatCurrencyDecimal(performance.avgCostPerLead)} per all leads
            </div>
          </div>

          {/* Conversion Rate */}
          <div className="bg-[#1a2e1a] rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Impressions</div>
            <div className="text-2xl font-bold text-[#E8DFC4]">{formatNumber(performance.impressions)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {formatPercent(performance.clickThroughRate)} CTR
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

      {/* Tabs */}
      <div className="border-b border-[#2a3e2a]">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-[#346643] text-[#E8DFC4]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Overview
          </button>
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
      {activeTab === 'overview' && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lead Types Breakdown */}
          <div className="bg-[#1a2e1a] rounded-lg p-5">
            <h3 className="text-lg font-semibold text-[#E8DFC4] mb-4">Lead Types</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[#E8DFC4] font-medium">Phone Calls</div>
                    <div className="text-sm text-gray-400">Direct calls from ads</div>
                  </div>
                </div>
                <div className="text-xl font-bold text-[#E8DFC4]">{summary.phoneLeads}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[#E8DFC4] font-medium">Messages</div>
                    <div className="text-sm text-gray-400">Chat inquiries</div>
                  </div>
                </div>
                <div className="text-xl font-bold text-[#E8DFC4]">{summary.messageLeads}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[#E8DFC4] font-medium">Bookings</div>
                    <div className="text-sm text-gray-400">Direct bookings</div>
                  </div>
                </div>
                <div className="text-xl font-bold text-[#E8DFC4]">{summary.bookingLeads}</div>
              </div>
            </div>
          </div>

          {/* Lead Status Breakdown */}
          <div className="bg-[#1a2e1a] rounded-lg p-5">
            <h3 className="text-lg font-semibold text-[#E8DFC4] mb-4">Charge Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <div>
                    <span className="text-gray-300">Charged Leads</span>
                    <div className="text-xs text-gray-500">New customers billed</div>
                  </div>
                </div>
                <span className="text-[#E8DFC4] font-medium">{summary.chargedLeads}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                  <div>
                    <span className="text-gray-300">Non-Charged Leads</span>
                    <div className="text-xs text-gray-500">Returning customers (free)</div>
                  </div>
                </div>
                <span className="text-[#E8DFC4] font-medium">{summary.nonChargedLeads}</span>
              </div>
              <div className="border-t border-[#2a3e2a] pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-gray-300">New Status</span>
                  </div>
                  <span className="text-[#E8DFC4] font-medium">{summary.newLeads}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className="text-gray-300">Booked Status</span>
                </div>
                <span className="text-[#E8DFC4] font-medium">{summary.bookedLeads}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'locations' && (
        <div className="bg-[#1a2e1a] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a3e2a]">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Location</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Total</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Charged</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Free</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Charge Rate</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">HVAC</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Plumbing</th>
                </tr>
              </thead>
              <tbody>
                {enrichedLocations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No location data found for this period
                    </td>
                  </tr>
                ) : (
                  enrichedLocations.map((loc) => (
                    <tr key={loc.customerId} className="border-b border-[#2a3e2a] hover:bg-[#0d1f0d] transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-[#E8DFC4] font-medium">{loc.customerName}</div>
                        <div className="text-xs text-gray-500">ID: {loc.customerId}</div>
                      </td>
                      <td className="py-3 px-4 text-right text-[#E8DFC4] font-medium">{loc.total}</td>
                      <td className="py-3 px-4 text-right text-green-400">{loc.charged}</td>
                      <td className="py-3 px-4 text-right text-gray-400">{loc.nonCharged}</td>
                      <td className="py-3 px-4 text-right text-gray-300">
                        {loc.total > 0 ? formatPercent((loc.charged / loc.total) * 100) : '0%'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-[#6eb887]">{loc.hvac}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-[#B8956B]">{loc.plumbing}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
