'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import { LeadsFunnel } from '@/components/leads/LeadsFunnel';
import { LeadsPerformanceChart } from '@/components/leads/LeadsPerformanceChart';
import { LeadsSourceTable } from '@/components/leads/LeadsSourceTable';
import { LeadTypeDonut } from '@/components/leads/LeadTypeDonut';

interface FunnelStage {
  name: string;
  count: number;
  value: number;
  rate: number;
  costPerLead: number;
}

interface SourceMetrics {
  source: string;
  sourceDetail: string | null;
  leads: number;
  qualified: number;
  booked: number;
  completed: number;
  revenue: number;
  cost: number;
  cpa: number;
  bookingRate: number;
  closeRate: number;
  roi: number;
}

interface DailyMetric {
  date: string;
  leads: number;
  qualified: number;
  booked: number;
  completed: number;
  revenue: number;
  cost: number;
}

interface LeadTypeData {
  type: string;
  count: number;
  percentage: number;
}

interface LeadMetrics {
  dateRange: { start: string; end: string };
  summary: {
    totalLeads: number;
    qualifiedLeads: number;
    bookedLeads: number;
    completedLeads: number;
    totalRevenue: number;
    totalCost: number;
    cpa: number;
    bookingRate: number;
    closeRate: number;
    roi: number;
  };
  funnel: FunnelStage[];
  bySource: SourceMetrics[];
  byTrade: SourceMetrics[];
  byLeadType: LeadTypeData[];
  daily: DailyMetric[];
}

type TabType = 'overview' | 'by-source' | 'by-trade';

export default function LeadsPage() {
  const { data: session } = useSession();

  // Initialize with MTD
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });

  const [metrics, setMetrics] = useState<LeadMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [showSyncMenu, setShowSyncMenu] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/leads/metrics?startDate=${dateRange.start}&endDate=${dateRange.end}`,
        { credentials: 'include' }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch metrics');
      }

      const data = await res.json();
      setMetrics(data);
    } catch (err: any) {
      console.error('Error fetching lead metrics:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const handleSync = async (type: 'lsa' | 'st-calls') => {
    setSyncing(true);
    setSyncMessage(null);

    try {
      // LSA can handle 90 days, ST calls limited to 30 days max
      const endpoint = type === 'lsa' ? '/api/lsa/sync?days=90' : '/api/leads/sync/st-calls?days=30';
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Sync failed');
      }

      const data = await res.json();
      setSyncMessage(`Synced ${data.summary?.leadsSynced || data.summary?.callsSynced || 0} ${type === 'lsa' ? 'leads' : 'calls'}`);

      // Refresh metrics after sync
      await fetchMetrics();
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
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  };

  const formatPercent = (num: number) => `${num.toFixed(1)}%`;

  if (loading && !metrics) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#1a2e1a] rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-[#1a2e1a] rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-80 bg-[#1a2e1a] rounded-lg"></div>
            <div className="h-80 bg-[#1a2e1a] rounded-lg"></div>
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
            Lead Attribution Dashboard
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Unified lead tracking across all marketing channels
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker
            value={dateRange}
            onChange={handleDateChange}
            dataDelay={0}
          />
          <div className="relative">
            <button
              onClick={() => setShowSyncMenu(!showSyncMenu)}
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
                  <svg className={`w-3 h-3 ml-1 transition-transform ${showSyncMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
            {/* Dropdown menu for sync options */}
            {showSyncMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg z-20" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => { handleSync('lsa'); setShowSyncMenu(false); }}
                  disabled={syncing}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-[#0d1f0d] transition-colors rounded-t-lg"
                  style={{ color: 'var(--christmas-cream)' }}
                >
                  Sync LSA Leads
                </button>
                <button
                  onClick={() => { handleSync('st-calls'); setShowSyncMenu(false); }}
                  disabled={syncing}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-[#0d1f0d] transition-colors rounded-b-lg"
                  style={{ color: 'var(--christmas-cream)' }}
                >
                  Sync ST Calls
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {syncMessage && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg">
          {syncMessage}
        </div>
      )}

      {/* Top Metric Cards - ST Style */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Marketing Revenue */}
          <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Marketing Revenue
              </div>
              <svg className="w-4 h-4" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>TOTAL REVENUE</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {formatCurrency(metrics.summary.totalRevenue)}
            </div>
          </div>

          {/* Marketing Cost */}
          <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Marketing Cost
              </div>
              <svg className="w-4 h-4" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>TOTAL COST</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {formatCurrency(metrics.summary.totalCost)}
            </div>
          </div>

          {/* ROI */}
          <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                ROI
              </div>
              <svg className="w-4 h-4" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-2xl font-bold mt-3" style={{ color: metrics.summary.roi > 0 ? '#22c55e' : metrics.summary.roi < 0 ? '#ef4444' : 'var(--christmas-cream)' }}>
              {metrics.summary.roi !== 0 ? `${formatPercent(metrics.summary.roi)}` : '-'}
            </div>
          </div>

          {/* CPA */}
          <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Cost Per Acquisition
              </div>
              <svg className="w-4 h-4" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-2xl font-bold mt-3" style={{ color: 'var(--christmas-cream)' }}>
              {formatCurrencyDecimal(metrics.summary.cpa)}
            </div>
          </div>
        </div>
      )}

      {/* Second Row - Marketing Performance Cards (ST Style 2x3 grid) */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Leads */}
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: '2px', textDecorationStyle: 'dotted' }}>
              LEADS
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {formatNumber(metrics.summary.totalLeads)}
            </div>
          </div>

          {/* Cost Per Lead */}
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: '2px', textDecorationStyle: 'dotted' }}>
              COST PER LEAD
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {formatCurrencyDecimal(metrics.summary.cpa)}
            </div>
          </div>

          {/* Booked Jobs */}
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: '2px', textDecorationStyle: 'dotted' }}>
              BOOKED JOBS
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {formatNumber(metrics.summary.bookedLeads)}
            </div>
          </div>

          {/* Ran Jobs (estimate) */}
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: '2px', textDecorationStyle: 'dotted' }}>
              RAN JOBS
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {formatNumber(Math.round(metrics.summary.bookedLeads * 0.96))}
            </div>
          </div>

          {/* Cost Per Ran Job */}
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: '2px', textDecorationStyle: 'dotted' }}>
              COST PER RAN JOB
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {metrics.summary.bookedLeads > 0
                ? formatCurrencyDecimal(metrics.summary.totalCost / (metrics.summary.bookedLeads * 0.96))
                : '-'}
            </div>
          </div>

          {/* Sold Jobs */}
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: '2px', textDecorationStyle: 'dotted' }}>
              SOLD JOBS
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {formatNumber(metrics.summary.completedLeads)}
            </div>
          </div>
        </div>
      )}

      {/* Funnel and Lead Type Section */}
      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LeadsFunnel
            stages={metrics.funnel}
            totalRevenue={metrics.summary.totalRevenue}
            totalSpend={metrics.summary.totalCost}
          />
          <LeadTypeDonut
            data={metrics.byLeadType}
            totalLeads={metrics.summary.totalLeads}
          />
        </div>
      )}

      {/* Performance Chart */}
      {metrics && (
        <LeadsPerformanceChart data={metrics.daily} isLoading={loading} />
      )}

      {/* Tabs for Tables */}
      <div className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex gap-4">
          {(['overview', 'by-source', 'by-trade'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-[#346643] text-[#E8DFC4]'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'by-source' ? 'By Source' : 'By Trade'}
            </button>
          ))}
        </div>
      </div>

      {/* Table Content */}
      {metrics && activeTab === 'by-source' && (
        <LeadsSourceTable data={metrics.bySource} type="source" isLoading={loading} />
      )}

      {metrics && activeTab === 'by-trade' && (
        <LeadsSourceTable data={metrics.byTrade} type="trade" isLoading={loading} />
      )}

      {metrics && activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LeadsSourceTable data={metrics.bySource.slice(0, 5)} type="source" isLoading={loading} />
          <LeadsSourceTable data={metrics.byTrade} type="trade" isLoading={loading} />
        </div>
      )}

      {/* Empty State */}
      {metrics && metrics.summary.totalLeads === 0 && (
        <div className="rounded-xl p-12 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--christmas-cream)' }}>
            No leads found
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Sync your lead sources to start tracking attribution and ROI.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => handleSync('lsa')}
              disabled={syncing}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: 'var(--christmas-green)',
                color: 'var(--christmas-cream)',
              }}
            >
              Sync LSA Leads
            </button>
            <button
              onClick={() => handleSync('st-calls')}
              disabled={syncing}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: 'var(--christmas-gold)',
                color: 'var(--dark-bg)',
              }}
            >
              Sync ST Calls
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
