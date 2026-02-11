import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { formatLocalDate } from '@/lib/mm-utils';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const today = formatLocalDate(new Date());

  // Get memberships with overdue or due-soon visits (within 30 days)
  const thirtyDaysOut = new Date();
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
  const thirtyDaysStr = formatLocalDate(thirtyDaysOut);

  const searchParams = request.nextUrl.searchParams;
  const overdueOnly = searchParams.get('overdueOnly') === 'true';
  const trade = searchParams.get('trade');
  const search = searchParams.get('search');

  let query = supabase
    .from('mm_memberships')
    .select('*')
    .eq('status', 'Active')
    .not('next_visit_due_date', 'is', null);

  if (overdueOnly) {
    query = query.lt('next_visit_due_date', today);
  } else {
    query = query.lte('next_visit_due_date', thirtyDaysStr);
  }

  query = query.order('next_visit_due_date', { ascending: true });

  const { data: memberships, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let results = memberships || [];

  // Get recurring services for trade filtering
  if (trade || true) {
    const membershipIds = results.map(m => m.st_membership_id);
    if (membershipIds.length > 0) {
      const { data: services } = await supabase
        .from('mm_recurring_services')
        .select('st_membership_id, name')
        .in('st_membership_id', membershipIds)
        .eq('status', 'Active');

      // Build trade map from service names
      const membershipTradeMap = new Map<number, string>();
      for (const svc of services || []) {
        const name = svc.name.toLowerCase();
        let svcTrade = 'unknown';
        if (name.includes('plumb') || name.includes('drain') || name.includes('water heater')) {
          svcTrade = 'plumbing';
        } else if (name.includes('heat') || name.includes('cool') || name.includes('ac') || name.includes('tune') || name.includes('furnace')) {
          svcTrade = 'hvac';
        }
        // A membership could have both - pick the first match
        if (!membershipTradeMap.has(svc.st_membership_id) || svcTrade !== 'unknown') {
          membershipTradeMap.set(svc.st_membership_id, svcTrade);
        }
      }

      // Attach trade to each membership and filter
      results = results.map(m => ({
        ...m,
        trade: membershipTradeMap.get(m.st_membership_id) || 'unknown',
      }));

      if (trade) {
        results = results.filter(m => (m as any).trade === trade);
      }
    }
  }

  // Search filter
  if (search) {
    const s = search.toLowerCase();
    results = results.filter(m =>
      (m.customer_name || '').toLowerCase().includes(s) ||
      (m.customer_address || '').toLowerCase().includes(s)
    );
  }

  return NextResponse.json({ queue: results });
}
