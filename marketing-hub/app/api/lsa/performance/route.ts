import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGoogleAdsClient } from '@/lib/google-ads';
import { hasPermission } from '@/lib/permissions';

/**
 * GET /api/lsa/performance
 * Get LSA performance metrics
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
    // Use explicit date range
    startDate = new Date(startParam + 'T00:00:00');
    endDate = new Date(endParam + 'T23:59:59');
  } else {
    // Use period-based range
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

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  try {
    const client = getGoogleAdsClient();

    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: 'Google Ads API not configured' },
        { status: 500 }
      );
    }

    const performance = await client.getLSAPerformance(startDateStr, endDateStr);

    // Calculate totals
    const totals = performance.reduce(
      (acc, perf) => ({
        impressions: acc.impressions + perf.impressions,
        clicks: acc.clicks + perf.clicks,
        totalLeads: acc.totalLeads + perf.totalLeads,
        chargedLeads: acc.chargedLeads + perf.chargedLeads,
        cost: acc.cost + perf.cost,
        phoneLeads: acc.phoneLeads + perf.phoneLeads,
        messageLeads: acc.messageLeads + perf.messageLeads,
      }),
      {
        impressions: 0,
        clicks: 0,
        totalLeads: 0,
        chargedLeads: 0,
        cost: 0,
        phoneLeads: 0,
        messageLeads: 0,
      }
    );

    // Cost per CHARGED lead (the accurate metric)
    const costPerChargedLead = totals.chargedLeads > 0 ? totals.cost / totals.chargedLeads : 0;
    // Also show cost per all leads for reference
    const avgCostPerLead = totals.totalLeads > 0 ? totals.cost / totals.totalLeads : 0;
    const clickThroughRate = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const conversionRate = totals.clicks > 0 ? (totals.totalLeads / totals.clicks) * 100 : 0;
    const chargeRate = totals.totalLeads > 0 ? (totals.chargedLeads / totals.totalLeads) * 100 : 0;

    // Enhance accounts with cost per charged lead
    const enhancedAccounts = performance.map(acc => ({
      ...acc,
      costPerChargedLead: acc.chargedLeads > 0 ? acc.cost / acc.chargedLeads : 0,
      chargeRate: acc.totalLeads > 0 ? (acc.chargedLeads / acc.totalLeads) * 100 : 0,
    }));

    return NextResponse.json({
      accounts: enhancedAccounts,
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
    });
  } catch (error: any) {
    console.error('Failed to fetch LSA performance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch performance data' },
      { status: 500 }
    );
  }
}
