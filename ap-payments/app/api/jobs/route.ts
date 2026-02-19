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
  const jobStatus = searchParams.get('jobStatus');
  const search = searchParams.get('search');
  const showIgnored = searchParams.get('showIgnored');
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const sort = searchParams.get('sort');
  const sortDir = searchParams.get('sortDir') === 'asc';

  // Map client sort keys to DB columns
  const SORT_COLUMN_MAP: Record<string, string> = {
    job_number: 'job_number',
    customer_name: 'customer_name',
    business_unit: 'business_unit_name',
    job_type_name: 'job_type_name',
    invoice_number: 'invoice_number',
    date: 'completed_date',
    job_status: 'job_status',
    job_total: 'job_total',
    invoice_date: 'invoice_date',
    invoice_exported: 'invoice_exported_status',
    assignment_type: 'assignment_type',
    contractor: 'contractor_id',
    payment_amount: 'payment_amount',
    labor_cost: 'labor_cost',
    payment_status: 'payment_status',
  };

  const sortColumn = (sort && SORT_COLUMN_MAP[sort]) || 'scheduled_date';
  const ascending = sort ? sortDir : false;

  let query = supabase
    .from('ap_install_jobs')
    .select(`
      *,
      contractor:ap_contractors(id, name),
      technician:ap_technicians(id, name, hourly_rate)
    `, { count: 'exact' })
    .order(sortColumn, { ascending, nullsFirst: false })
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
    const statuses = paymentStatus.split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      query = query.eq('payment_status', statuses[0]);
    } else if (statuses.length > 1) {
      query = query.in('payment_status', statuses);
    }
  }
  if (jobStatus) {
    query = query.eq('job_status', jobStatus);
  }
  if (contractorId) {
    query = query.eq('contractor_id', contractorId);
  }
  // Date filter: use completed_date for completed jobs, scheduled_date for non-completed
  if (start) {
    query = query.or(`completed_date.gte.${start},and(completed_date.is.null,scheduled_date.gte.${start}),and(completed_date.is.null,scheduled_date.is.null)`);
  }
  if (end) {
    query = query.or(`completed_date.lte.${end},and(completed_date.is.null,scheduled_date.lte.${end}),and(completed_date.is.null,scheduled_date.is.null)`);
  }
  const minTotal = searchParams.get('minTotal');
  const maxTotal = searchParams.get('maxTotal');
  if (minTotal) {
    query = query.gte('job_total', parseFloat(minTotal));
  }
  if (maxTotal) {
    query = query.lte('job_total', parseFloat(maxTotal));
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
