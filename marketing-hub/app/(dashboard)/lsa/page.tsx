'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface LSALead {
  id: string;
  leadType: string;
  leadTypeFormatted: string;
  categoryId: string;
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
  newLeads: number;
  bookedLeads: number;
}

interface PerformanceTotals {
  impressions: number;
  clicks: number;
  totalLeads: number;
  chargedLeads: number;
  cost: number;
  phoneLeads: number;
  messageLeads: number;
  avgCostPerLead: number;
  clickThroughRate: number;
  conversionRate: number;
}

type Period = '7d' | '30d' | '90d';

export default function LSAPage() {
  const { data: session } = useSession();
  const [period, setPeriod] = useState<Period>('30d');
  const [leads, setLeads] = useState<LSALead[]>([]);
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [performance, setPerformance] = useState<PerformanceTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'leads'>('overview');

  useEffect(() => {
    fetchData();
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
      setPerformance(perfData.totals || null);
    } catch (err: any) {
      console.error('Error fetching LSA data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
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
          <p className="text-sm text-gray-400 mt-1">Lead generation and performance tracking</p>
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

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Performance Overview Cards */}
      {performance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#1a2e1a] rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Leads</div>
            <div className="text-2xl font-bold text-[#E8DFC4]">{formatNumber(performance.totalLeads)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {summary?.phoneLeads || 0} calls · {summary?.messageLeads || 0} messages
            </div>
          </div>
          <div className="bg-[#1a2e1a] rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Spend</div>
            <div className="text-2xl font-bold text-[#E8DFC4]">{formatCurrency(performance.cost)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {formatCurrency(performance.avgCostPerLead)} per lead
            </div>
          </div>
          <div className="bg-[#1a2e1a] rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Impressions</div>
            <div className="text-2xl font-bold text-[#E8DFC4]">{formatNumber(performance.impressions)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {formatPercent(performance.clickThroughRate)} CTR
            </div>
          </div>
          <div className="bg-[#1a2e1a] rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Conversion Rate</div>
            <div className="text-2xl font-bold text-[#E8DFC4]">{formatPercent(performance.conversionRate)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {formatNumber(performance.clicks)} clicks
            </div>
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
            onClick={() => setActiveTab('leads')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'leads'
                ? 'border-[#346643] text-[#E8DFC4]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Recent Leads ({leads.length})
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
            <h3 className="text-lg font-semibold text-[#E8DFC4] mb-4">Lead Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-300">New Leads</span>
                </div>
                <span className="text-[#E8DFC4] font-medium">{summary.newLeads}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className="text-gray-300">Booked</span>
                </div>
                <span className="text-[#E8DFC4] font-medium">{summary.bookedLeads}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-300">Charged Leads</span>
                </div>
                <span className="text-[#E8DFC4] font-medium">{summary.chargedLeads}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                  <span className="text-gray-300">Total</span>
                </div>
                <span className="text-[#E8DFC4] font-medium">{summary.totalLeads}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="bg-[#1a2e1a] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a3e2a]">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Category</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Charged</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No leads found for this period
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
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
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(lead.leadStatus)}`}>
                          {lead.leadStatusFormatted}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400">{lead.categoryId || '-'}</td>
                      <td className="py-3 px-4">
                        {lead.leadCharged ? (
                          <span className="text-green-400">Yes</span>
                        ) : (
                          <span className="text-gray-500">No</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
