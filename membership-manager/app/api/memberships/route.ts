import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

const SORTABLE_COLUMNS: Record<string, string> = {
  customer: 'customer_name',
  address: 'customer_address',
  type: 'membership_type_name',
  status: 'status',
  start: 'start_date',
  end: 'end_date',
  visits: 'total_visits_completed',
  next_due: 'next_visit_due_date',
  sold_on: 'sold_on',
  sold_by: 'sold_by_name',
  phone: 'customer_phone',
  email: 'customer_email',
  location: 'location_name',
  billing: 'billing_frequency',
  expiry_days: 'days_until_expiry',
  scheduled: 'total_visits_scheduled',
};

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const expiringDays = searchParams.get('expiringDays');
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');
  const sortField = searchParams.get('sortField') || 'customer';
  const sortDirection = searchParams.get('sortDirection') || 'asc';

  let query = supabase
    .from('mm_memberships')
    .select('*', { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
  }

  if (type) {
    query = query.eq('membership_type_name', type);
  }

  if (expiringDays) {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + parseInt(expiringDays));
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    const fy = futureDate.getFullYear();
    const fm = String(futureDate.getMonth() + 1).padStart(2, '0');
    const fd = String(futureDate.getDate()).padStart(2, '0');
    const futureStr = `${fy}-${fm}-${fd}`;
    query = query.gte('end_date', todayStr).lte('end_date', futureStr);
  }

  if (search) {
    query = query.or(
      `customer_name.ilike.%${search}%,customer_address.ilike.%${search}%,customer_email.ilike.%${search}%`
    );
  }

  // Apply sorting
  const dbColumn = SORTABLE_COLUMNS[sortField] || 'customer_name';
  const ascending = sortDirection === 'asc';
  query = query.order(dbColumn, { ascending, nullsFirst: false });

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get membership types for filter options
  const { data: types } = await supabase
    .from('mm_membership_types')
    .select('name')
    .order('name');

  return NextResponse.json({
    memberships: data || [],
    total: count || 0,
    types: [...new Set((types || []).map(t => t.name))],
  });
}
