import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { formatLocalDate } from '@/lib/mm-utils';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const today = formatLocalDate(new Date());

  // Active memberships count
  const { count: activeMemberships } = await supabase
    .from('mm_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Active');

  // Overdue visits: memberships with next_visit_due_date < today
  const { count: overdueVisits } = await supabase
    .from('mm_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Active')
    .lt('next_visit_due_date', today)
    .not('next_visit_due_date', 'is', null);

  // Expiring within 30 days
  const thirtyDaysOut = new Date();
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
  const thirtyDaysStr = formatLocalDate(thirtyDaysOut);

  const { count: expiring30 } = await supabase
    .from('mm_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Active')
    .lte('end_date', thirtyDaysStr)
    .gte('end_date', today);

  // Visit fulfillment rate
  const { data: aggregates } = await supabase
    .from('mm_memberships')
    .select('total_visits_completed, total_visits_expected')
    .eq('status', 'Active');

  let totalCompleted = 0;
  let totalExpected = 0;
  for (const m of aggregates || []) {
    totalCompleted += m.total_visits_completed || 0;
    totalExpected += m.total_visits_expected || 0;
  }
  const fulfillmentRate = totalExpected > 0
    ? Math.round((totalCompleted / totalExpected) * 100)
    : 0;

  // Last sync
  const { data: lastSync } = await supabase
    .from('mm_sync_log')
    .select('completed_at')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  // Memberships by type
  const { data: byType } = await supabase
    .from('mm_memberships')
    .select('membership_type_name')
    .eq('status', 'Active');

  const typeCounts: Record<string, number> = {};
  for (const m of byType || []) {
    const name = m.membership_type_name || 'Unknown';
    typeCounts[name] = (typeCounts[name] || 0) + 1;
  }

  // Expiring breakdown (30/60/90 day buckets)
  const sixtyDaysOut = new Date();
  sixtyDaysOut.setDate(sixtyDaysOut.getDate() + 60);
  const ninetyDaysOut = new Date();
  ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 90);

  const { count: expiring60 } = await supabase
    .from('mm_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Active')
    .lte('end_date', formatLocalDate(sixtyDaysOut))
    .gt('end_date', thirtyDaysStr);

  const { count: expiring90 } = await supabase
    .from('mm_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Active')
    .lte('end_date', formatLocalDate(ninetyDaysOut))
    .gt('end_date', formatLocalDate(sixtyDaysOut));

  // Top overdue memberships for preview
  const { data: topOverdue } = await supabase
    .from('mm_memberships')
    .select('id, customer_name, customer_address, membership_type_name, next_visit_due_date')
    .eq('status', 'Active')
    .lt('next_visit_due_date', today)
    .not('next_visit_due_date', 'is', null)
    .order('next_visit_due_date', { ascending: true })
    .limit(5);

  return NextResponse.json({
    stats: {
      active_memberships: activeMemberships || 0,
      overdue_visits: overdueVisits || 0,
      expiring_30_days: expiring30 || 0,
      fulfillment_rate: fulfillmentRate,
      last_sync: lastSync?.completed_at || null,
    },
    by_type: typeCounts,
    expiring_breakdown: {
      '30_days': expiring30 || 0,
      '60_days': expiring60 || 0,
      '90_days': expiring90 || 0,
    },
    top_overdue: topOverdue || [],
  });
}
