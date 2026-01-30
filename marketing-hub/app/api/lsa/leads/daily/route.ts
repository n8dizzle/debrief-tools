import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/lsa/leads/daily
 * Get daily aggregated LSA lead data for charting
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
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end dates required' }, { status: 400 });
  }

  try {
    // Get leads from Supabase cache
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T23:59:59');

    const { data: leads, error } = await supabase
      .from('lsa_leads')
      .select('lead_created_at, trade, lead_charged, customer_id')
      .gte('lead_created_at', startDate.toISOString())
      .lte('lead_created_at', endDate.toISOString())
      .order('lead_created_at', { ascending: true });

    if (error) {
      throw error;
    }

    // Get account names
    const { data: accounts } = await supabase
      .from('lsa_accounts')
      .select('customer_id, customer_name');

    const accountMap = new Map(accounts?.map(a => [a.customer_id, a.customer_name]) || []);

    // Aggregate by day
    const dailyMap = new Map<string, {
      date: string;
      total: number;
      hvac: number;
      plumbing: number;
      other: number;
      charged: number;
      nonCharged: number;
      byLocation: Map<string, { name: string; total: number; hvac: number; plumbing: number; charged: number }>;
    }>();

    for (const lead of leads || []) {
      const date = new Date(lead.lead_created_at).toISOString().split('T')[0];

      const existing = dailyMap.get(date) || {
        date,
        total: 0,
        hvac: 0,
        plumbing: 0,
        other: 0,
        charged: 0,
        nonCharged: 0,
        byLocation: new Map(),
      };

      existing.total++;
      if (lead.trade === 'HVAC') existing.hvac++;
      else if (lead.trade === 'Plumbing') existing.plumbing++;
      else existing.other++;

      if (lead.lead_charged) existing.charged++;
      else existing.nonCharged++;

      // Location breakdown
      const cid = lead.customer_id || 'unknown';
      const locName = accountMap.get(cid) || `Account ${cid.slice(-4)}`;
      const loc = existing.byLocation.get(cid) || { name: locName, total: 0, hvac: 0, plumbing: 0, charged: 0 };
      loc.total++;
      if (lead.trade === 'HVAC') loc.hvac++;
      else if (lead.trade === 'Plumbing') loc.plumbing++;
      if (lead.lead_charged) loc.charged++;
      existing.byLocation.set(cid, loc);

      dailyMap.set(date, existing);
    }

    // Fill in missing dates with zeros
    const daily: any[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayData = dailyMap.get(dateStr);

      if (dayData) {
        daily.push({
          date: dayData.date,
          total: dayData.total,
          hvac: dayData.hvac,
          plumbing: dayData.plumbing,
          other: dayData.other,
          charged: dayData.charged,
          nonCharged: dayData.nonCharged,
          byLocation: Array.from(dayData.byLocation.values())
            .sort((a, b) => b.total - a.total),
        });
      } else {
        daily.push({
          date: dateStr,
          total: 0,
          hvac: 0,
          plumbing: 0,
          other: 0,
          charged: 0,
          nonCharged: 0,
          byLocation: [],
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate totals
    const totals = daily.reduce(
      (acc, day) => ({
        total: acc.total + day.total,
        hvac: acc.hvac + day.hvac,
        plumbing: acc.plumbing + day.plumbing,
        charged: acc.charged + day.charged,
      }),
      { total: 0, hvac: 0, plumbing: 0, charged: 0 }
    );

    const daysCount = daily.length;
    const avgPerDay = {
      total: daysCount > 0 ? totals.total / daysCount : 0,
      hvac: daysCount > 0 ? totals.hvac / daysCount : 0,
      plumbing: daysCount > 0 ? totals.plumbing / daysCount : 0,
      charged: daysCount > 0 ? totals.charged / daysCount : 0,
    };

    return NextResponse.json({
      daily,
      totals,
      avgPerDay,
      dateRange: { start, end },
      daysCount,
    });
  } catch (error: any) {
    console.error('Failed to fetch daily LSA data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch daily data' },
      { status: 500 }
    );
  }
}
