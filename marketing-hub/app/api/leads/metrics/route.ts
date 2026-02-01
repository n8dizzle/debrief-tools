import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

/**
 * GET /api/leads/metrics
 * Fetch aggregated lead metrics for dashboard
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const trade = searchParams.get('trade');

  // Default to last 30 days
  const now = new Date();
  const defaultEnd = now.toISOString().split('T')[0];
  const defaultStart = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];

  const effectiveStartDate = startDate || defaultStart;
  const effectiveEndDate = endDate || defaultEnd;

  try {
    // Fetch all non-duplicate leads in date range
    let query = supabase
      .from('master_leads')
      .select('*')
      .eq('is_duplicate', false)
      .gte('lead_created_at', `${effectiveStartDate}T00:00:00Z`)
      .lte('lead_created_at', `${effectiveEndDate}T23:59:59Z`);

    if (trade) {
      query = query.eq('trade', trade);
    }

    const { data: leads, error } = await query;

    if (error) throw error;

    const leadsData = leads || [];

    // Calculate overall metrics
    const totalLeads = leadsData.length;
    const qualifiedLeads = leadsData.filter(l => l.is_qualified).length;
    const bookedLeads = leadsData.filter(l => l.is_booked).length;
    const completedLeads = leadsData.filter(l => l.is_completed).length;
    const totalRevenue = leadsData.reduce((sum, l) => sum + (l.job_revenue || 0), 0);
    const totalCost = leadsData.reduce((sum, l) => sum + (l.lead_cost || 0), 0);

    // Also fetch LSA daily performance for cost data
    const { data: lsaPerformance } = await supabase
      .from('lsa_daily_performance')
      .select('*')
      .gte('date', effectiveStartDate)
      .lte('date', effectiveEndDate);

    const lsaTotalCost = (lsaPerformance || []).reduce(
      (sum, p) => sum + (p.cost_micros || 0) / 1_000_000,
      0
    );

    // Use LSA cost if no cost on leads yet
    const effectiveTotalCost = totalCost > 0 ? totalCost : lsaTotalCost;

    // Summary metrics
    const summary = {
      totalLeads,
      qualifiedLeads,
      bookedLeads,
      completedLeads,
      totalRevenue,
      totalCost: effectiveTotalCost,
      cpa: totalLeads > 0 ? effectiveTotalCost / totalLeads : 0,
      bookingRate: totalLeads > 0 ? (bookedLeads / totalLeads) * 100 : 0,
      closeRate: bookedLeads > 0 ? (completedLeads / bookedLeads) * 100 : 0,
      roi: effectiveTotalCost > 0 ? ((totalRevenue - effectiveTotalCost) / effectiveTotalCost) * 100 : 0,
    };

    // Funnel stages - more detailed breakdown
    const funnel: FunnelStage[] = [
      {
        name: 'Total Contacts',
        count: totalLeads,
        value: 100,
        rate: 100,
        costPerLead: summary.cpa,
      },
      {
        name: 'Qualified',
        count: qualifiedLeads,
        value: totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0,
        rate: totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0,
        costPerLead: qualifiedLeads > 0 ? effectiveTotalCost / qualifiedLeads : 0,
      },
      {
        name: 'Booked',
        count: bookedLeads,
        value: totalLeads > 0 ? (bookedLeads / totalLeads) * 100 : 0,
        rate: qualifiedLeads > 0 ? (bookedLeads / qualifiedLeads) * 100 : 0,
        costPerLead: bookedLeads > 0 ? effectiveTotalCost / bookedLeads : 0,
      },
      {
        name: 'Ran Jobs',
        count: Math.round(bookedLeads * 0.96), // Estimate - would need actual ran data
        value: totalLeads > 0 ? (bookedLeads * 0.96 / totalLeads) * 100 : 0,
        rate: bookedLeads > 0 ? 96 : 0, // Typical run rate
        costPerLead: bookedLeads > 0 ? effectiveTotalCost / (bookedLeads * 0.96) : 0,
      },
      {
        name: 'Sold Jobs',
        count: completedLeads,
        value: totalLeads > 0 ? (completedLeads / totalLeads) * 100 : 0,
        rate: bookedLeads > 0 ? (completedLeads / bookedLeads) * 100 : 0,
        costPerLead: completedLeads > 0 ? effectiveTotalCost / completedLeads : 0,
      },
    ];

    // Metrics by source
    const sourceMap = new Map<string, SourceMetrics>();
    for (const lead of leadsData) {
      const source = lead.primary_source || 'unknown';
      if (!sourceMap.has(source)) {
        sourceMap.set(source, {
          source,
          sourceDetail: lead.primary_source_detail,
          leads: 0,
          qualified: 0,
          booked: 0,
          completed: 0,
          revenue: 0,
          cost: 0,
          cpa: 0,
          bookingRate: 0,
          closeRate: 0,
          roi: 0,
        });
      }
      const sm = sourceMap.get(source)!;
      sm.leads++;
      if (lead.is_qualified) sm.qualified++;
      if (lead.is_booked) sm.booked++;
      if (lead.is_completed) sm.completed++;
      sm.revenue += lead.job_revenue || 0;
      sm.cost += lead.lead_cost || 0;
    }

    // Calculate derived metrics for each source
    const bySource: SourceMetrics[] = [];
    for (const sm of sourceMap.values()) {
      sm.cpa = sm.leads > 0 ? sm.cost / sm.leads : 0;
      sm.bookingRate = sm.leads > 0 ? (sm.booked / sm.leads) * 100 : 0;
      sm.closeRate = sm.booked > 0 ? (sm.completed / sm.booked) * 100 : 0;
      sm.roi = sm.cost > 0 ? ((sm.revenue - sm.cost) / sm.cost) * 100 : 0;
      bySource.push(sm);
    }

    // Sort by leads descending
    bySource.sort((a, b) => b.leads - a.leads);

    // Metrics by trade
    const tradeMap = new Map<string, SourceMetrics>();
    for (const lead of leadsData) {
      const tradeName = lead.trade || 'Unknown';
      if (!tradeMap.has(tradeName)) {
        tradeMap.set(tradeName, {
          source: tradeName,
          sourceDetail: null,
          leads: 0,
          qualified: 0,
          booked: 0,
          completed: 0,
          revenue: 0,
          cost: 0,
          cpa: 0,
          bookingRate: 0,
          closeRate: 0,
          roi: 0,
        });
      }
      const tm = tradeMap.get(tradeName)!;
      tm.leads++;
      if (lead.is_qualified) tm.qualified++;
      if (lead.is_booked) tm.booked++;
      if (lead.is_completed) tm.completed++;
      tm.revenue += lead.job_revenue || 0;
      tm.cost += lead.lead_cost || 0;
    }

    const byTrade: SourceMetrics[] = [];
    for (const tm of tradeMap.values()) {
      tm.cpa = tm.leads > 0 ? tm.cost / tm.leads : 0;
      tm.bookingRate = tm.leads > 0 ? (tm.booked / tm.leads) * 100 : 0;
      tm.closeRate = tm.booked > 0 ? (tm.completed / tm.booked) * 100 : 0;
      tm.roi = tm.cost > 0 ? ((tm.revenue - tm.cost) / tm.cost) * 100 : 0;
      byTrade.push(tm);
    }

    byTrade.sort((a, b) => b.leads - a.leads);

    // Daily metrics for chart
    const dailyMap = new Map<string, DailyMetric>();
    for (const lead of leadsData) {
      const date = lead.lead_created_at.split('T')[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          leads: 0,
          qualified: 0,
          booked: 0,
          completed: 0,
          revenue: 0,
          cost: 0,
        });
      }
      const dm = dailyMap.get(date)!;
      dm.leads++;
      if (lead.is_qualified) dm.qualified++;
      if (lead.is_booked) dm.booked++;
      if (lead.is_completed) dm.completed++;
      dm.revenue += lead.job_revenue || 0;
      dm.cost += lead.lead_cost || 0;
    }

    // Add LSA cost data to daily metrics
    for (const perf of lsaPerformance || []) {
      const date = perf.date;
      if (dailyMap.has(date)) {
        dailyMap.get(date)!.cost += (perf.cost_micros || 0) / 1_000_000;
      }
    }

    const daily = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Lead type breakdown (for donut chart)
    const leadTypeMap = new Map<string, number>();
    for (const lead of leadsData) {
      const type = lead.lead_type || 'unknown';
      leadTypeMap.set(type, (leadTypeMap.get(type) || 0) + 1);
    }

    const byLeadType = Array.from(leadTypeMap.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalLeads > 0 ? (count / totalLeads) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      dateRange: {
        start: effectiveStartDate,
        end: effectiveEndDate,
      },
      summary,
      funnel,
      bySource,
      byTrade,
      byLeadType,
      daily,
    });
  } catch (error: any) {
    console.error('Failed to fetch lead metrics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
