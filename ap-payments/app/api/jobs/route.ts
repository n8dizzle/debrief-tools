import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const { searchParams } = new URL(request.url);

  const businessUnits = searchParams.get('businessUnits');
  const trade = searchParams.get('trade');
  const assignment = searchParams.get('assignment');
  const paymentStatus = searchParams.get('paymentStatus');
  const contractorId = searchParams.get('contractorId');
  const search = searchParams.get('search');
  const showIgnored = searchParams.get('showIgnored');
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('ap_install_jobs')
    .select(`
      *,
      contractor:ap_contractors(id, name)
    `, { count: 'exact' })
    .or('job_total.gt.0,job_status.neq.Completed')
    .order('scheduled_date', { ascending: false })
    .range(offset, offset + limit - 1);

  // Exclude ignored jobs by default
  if (showIgnored !== 'true') {
    query = query.eq('is_ignored', false);
  }

  if (businessUnits) {
    const buNames = businessUnits.split(',').map(s => s.trim()).filter(Boolean);
    if (buNames.length > 0) {
      query = query.in('business_unit_name', buNames);
    }
  }
  if (trade) {
    query = query.eq('trade', trade);
  }
  if (assignment) {
    query = query.eq('assignment_type', assignment);
  }
  if (paymentStatus) {
    query = query.eq('payment_status', paymentStatus);
  }
  if (contractorId) {
    query = query.eq('contractor_id', contractorId);
  }
  if (start) {
    query = query.gte('completed_date', start);
  }
  if (end) {
    query = query.lte('completed_date', end);
  }
  if (search) {
    query = query.or(`job_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: data || [], total: count || 0 });
}
