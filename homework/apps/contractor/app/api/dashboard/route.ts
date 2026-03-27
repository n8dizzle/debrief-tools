import { createServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

const getSupabaseServerClient = createServerClient;

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// GET /api/dashboard - Contractor dashboard stats
export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get contractor record
    const { data: contractor, error: contractorError } = await supabase
      .from('contractors')
      .select('id, rating_overall, review_count, jobs_completed, business_name, stripe_charges_enabled')
      .eq('user_id', user.id)
      .single();

    if (contractorError || !contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const contractorId = contractor.id;

    // Current month start
    const now = new Date();
    const monthStart = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const today = formatLocalDate(now);

    // Pending orders (pending or assigned)
    const { count: pendingCount } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('contractor_id', contractorId)
      .in('status', ['pending', 'assigned']);

    // Active orders (confirmed, scheduled, in_progress)
    const { count: activeCount } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('contractor_id', contractorId)
      .in('status', ['confirmed', 'scheduled', 'in_progress']);

    // Completed this month
    const { data: completedThisMonth } = await supabase
      .from('order_items')
      .select('id, contractor_payout')
      .eq('contractor_id', contractorId)
      .eq('status', 'completed')
      .gte('completed_at', `${monthStart}T00:00:00`)
      .lte('completed_at', `${today}T23:59:59`);

    const completedCount = completedThisMonth?.length || 0;
    const monthEarnings = (completedThisMonth || []).reduce(
      (sum, item) => sum + (item.contractor_payout || 0),
      0
    );

    // Total lifetime earnings
    const { data: allCompleted } = await supabase
      .from('order_items')
      .select('contractor_payout')
      .eq('contractor_id', contractorId)
      .eq('status', 'completed');

    const totalEarnings = (allCompleted || []).reduce(
      (sum, item) => sum + (item.contractor_payout || 0),
      0
    );

    // Recent orders (last 5)
    const { data: recentOrders } = await supabase
      .from('order_items')
      .select(`
        id,
        status,
        price_snapshot,
        contractor_payout,
        scheduled_date,
        completed_at,
        catalog_services (
          id,
          name
        ),
        orders (
          id,
          order_number,
          user_profiles (
            full_name
          )
        )
      `)
      .eq('contractor_id', contractorId)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      stats: {
        pending_orders: pendingCount || 0,
        active_orders: activeCount || 0,
        completed_this_month: completedCount,
        month_earnings: monthEarnings,
        total_earnings: totalEarnings,
        rating: contractor.rating_overall,
        review_count: contractor.review_count || 0,
        jobs_completed: contractor.jobs_completed || 0,
        stripe_connected: contractor.stripe_charges_enabled || false,
      },
      recent_orders: recentOrders || [],
    });
  } catch (err) {
    console.error('GET /api/dashboard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
