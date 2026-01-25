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
  const period = searchParams.get('period') || '30d';

  // Calculate date range
  const endDate = new Date();
  let startDate = new Date();

  switch (period) {
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

    const avgCostPerLead = totals.totalLeads > 0 ? totals.cost / totals.totalLeads : 0;
    const clickThroughRate = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const conversionRate = totals.clicks > 0 ? (totals.totalLeads / totals.clicks) * 100 : 0;

    return NextResponse.json({
      accounts: performance,
      totals: {
        ...totals,
        avgCostPerLead,
        clickThroughRate,
        conversionRate,
      },
      period,
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
