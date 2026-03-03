import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  const supabase = getServerSupabase();

  try {
    // Job timesheets
    let jobQuery = supabase
      .from('pr_job_timesheets')
      .select('*')
      .eq('employee_id', id)
      .order('date', { ascending: false });

    if (start && end) {
      jobQuery = jobQuery.gte('date', start).lte('date', end);
    }

    const { data: jobTimesheets } = await jobQuery;

    // Non-job timesheets
    let nonJobQuery = supabase
      .from('pr_nonjob_timesheets')
      .select('*')
      .eq('employee_id', id)
      .order('date', { ascending: false });

    if (start && end) {
      nonJobQuery = nonJobQuery.gte('date', start).lte('date', end);
    }

    const { data: nonJobTimesheets } = await nonJobQuery;

    return NextResponse.json({
      job_timesheets: jobTimesheets || [],
      nonjob_timesheets: nonJobTimesheets || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
