import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGoogleAdsClient, getLSAAccountName } from '@/lib/google-ads';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/lsa/performance
 * Get LSA performance metrics — reads from lsa_daily_performance cache,
 * falls back to live Google Ads API if cache is empty.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role, permissions } = session.user as {
    role: 'employee' | 'manager' | 'owner';
    permissions: any;
  };

  if (!hasPermission(role, permissions, 'marketing_hub', 'can_view_analytics')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period');
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  // Calculate date range - support both period and explicit start/end
  let endDate: Date;
  let startDate: Date;

  if (startParam && endParam) {
    startDate = new Date(startParam + 'T00:00:00');
    endDate = new Date(endParam + 'T23:59:59');
  } else {
    endDate = new Date();
    startDate = new Date();
    const p = period || '30d';

    switch (p) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case 'mtd':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        break;
      case 'ytd':
        startDate = new Date(endDate.getFullYear(), 0, 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }
  }

  // Use local date components to avoid UTC timezone shift (CLAUDE.md rule #1)
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const startDateStr = formatLocalDate(startDate);
  const endDateStr = formatLocalDate(endDate);

  try {
    // Try cache first: read from lsa_daily_performance
    const { data: cachedRows, error: cacheError } = await supabase
      .from('lsa_daily_performance')
      .select('*')
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (!cacheError && cachedRows && cachedRows.length > 0) {
      console.log(`[LSA Perf] Cache hit: ${cachedRows.length} rows from lsa_daily_performance`);

      // Aggregate cached daily rows per account
      const accountMap = new Map<string, {
        customerId: string;
        customerName: string;
        impressions: number;
        clicks: number;
        cost: number;
        phoneCalls: number;
        allConversions: number;
      }>();

      for (const row of cachedRows) {
        const existing = accountMap.get(row.customer_id) || {
          customerId: row.customer_id,
          customerName: getLSAAccountName(row.customer_id),
          impressions: 0,
          clicks: 0,
          cost: 0,
          phoneCalls: 0,
          allConversions: 0,
        };

        existing.impressions += row.impressions || 0;
        existing.clicks += row.clicks || 0;
        existing.cost += (row.cost_micros || 0) / 1000000;
        existing.phoneCalls += row.phone_calls || 0;
        existing.allConversions += Number(row.all_conversions || 0);

        accountMap.set(row.customer_id, existing);
      }

      const accounts = Array.from(accountMap.values()).map(acc => ({
        customerId: acc.customerId,
        customerName: acc.customerName,
        impressions: acc.impressions,
        clicks: acc.clicks,
        totalLeads: Math.round(acc.allConversions),
        chargedLeads: 0, // Not available from campaign metrics — derived from leads
        cost: acc.cost,
        costPerLead: acc.allConversions > 0 ? acc.cost / acc.allConversions : 0,
        costPerChargedLead: 0,
        chargeRate: 0,
        phoneLeads: acc.phoneCalls,
        messageLeads: 0,
        period: `${startDateStr} to ${endDateStr}`,
      }));

      // Get charged lead counts from lsa_leads for accurate cost/charged-lead
      const { data: chargedData } = await supabase
        .from('lsa_leads')
        .select('customer_id, lead_charged')
        .gte('lead_created_at', `${startDateStr}T00:00:00`)
        .lte('lead_created_at', `${endDateStr}T23:59:59`);

      if (chargedData) {
        const chargedByAccount = new Map<string, { total: number; charged: number }>();
        for (const lead of chargedData) {
          const existing = chargedByAccount.get(lead.customer_id) || { total: 0, charged: 0 };
          existing.total++;
          if (lead.lead_charged) existing.charged++;
          chargedByAccount.set(lead.customer_id, existing);
        }

        for (const acc of accounts) {
          const counts = chargedByAccount.get(acc.customerId);
          if (counts) {
            acc.totalLeads = counts.total;
            acc.chargedLeads = counts.charged;
            acc.costPerLead = counts.total > 0 ? acc.cost / counts.total : 0;
            acc.costPerChargedLead = counts.charged > 0 ? acc.cost / counts.charged : 0;
            acc.chargeRate = counts.total > 0 ? (counts.charged / counts.total) * 100 : 0;
          }
        }
      }

      return buildPerformanceResponse(accounts, period, startDateStr, endDateStr, 'cache');
    }

    console.log('[LSA Perf] Cache miss, falling back to live Google Ads API');

    // Fall back to live API
    const client = getGoogleAdsClient();

    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: 'Google Ads API not configured' },
        { status: 500 }
      );
    }

    const performance = await client.getLSAPerformance(startDateStr, endDateStr);

    // Enhance accounts with cost per charged lead
    const enhancedAccounts = performance.map(acc => ({
      ...acc,
      costPerChargedLead: acc.chargedLeads > 0 ? acc.cost / acc.chargedLeads : 0,
      chargeRate: acc.totalLeads > 0 ? (acc.chargedLeads / acc.totalLeads) * 100 : 0,
    }));

    return buildPerformanceResponse(enhancedAccounts, period, startDateStr, endDateStr, 'live');
  } catch (error: any) {
    console.error('Failed to fetch LSA performance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch performance data' },
      { status: 500 }
    );
  }
}

function buildPerformanceResponse(
  accounts: Array<{
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
  }>,
  period: string | null,
  startDateStr: string,
  endDateStr: string,
  source: string
) {
  const totals = accounts.reduce(
    (acc, perf) => ({
      impressions: acc.impressions + perf.impressions,
      clicks: acc.clicks + perf.clicks,
      totalLeads: acc.totalLeads + perf.totalLeads,
      chargedLeads: acc.chargedLeads + perf.chargedLeads,
      cost: acc.cost + perf.cost,
      phoneLeads: acc.phoneLeads + perf.phoneLeads,
      messageLeads: acc.messageLeads + perf.messageLeads,
    }),
    { impressions: 0, clicks: 0, totalLeads: 0, chargedLeads: 0, cost: 0, phoneLeads: 0, messageLeads: 0 }
  );

  const costPerChargedLead = totals.chargedLeads > 0 ? totals.cost / totals.chargedLeads : 0;
  const avgCostPerLead = totals.totalLeads > 0 ? totals.cost / totals.totalLeads : 0;
  const clickThroughRate = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const conversionRate = totals.clicks > 0 ? (totals.totalLeads / totals.clicks) * 100 : 0;
  const chargeRate = totals.totalLeads > 0 ? (totals.chargedLeads / totals.totalLeads) * 100 : 0;

  return NextResponse.json({
    accounts,
    totals: {
      ...totals,
      costPerChargedLead,
      avgCostPerLead,
      clickThroughRate,
      conversionRate,
      chargeRate,
      nonChargedLeads: totals.totalLeads - totals.chargedLeads,
    },
    period: period || 'custom',
    dateRange: { start: startDateStr, end: endDateStr },
    source,
  });
}
