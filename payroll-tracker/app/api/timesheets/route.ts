import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const employeeId = searchParams.get('employee');
  const type = searchParams.get('type'); // 'job' | 'nonjob' | null (all)
  const departments = searchParams.get('departments'); // comma-separated BU names

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end required' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const deptList = departments ? departments.split(',').map(d => d.trim()).filter(Boolean) : [];

  const matchesDept = (emp: { business_unit_name?: string | null } | null) => {
    if (deptList.length === 0) return true;
    return deptList.includes(emp?.business_unit_name || '');
  };

  try {
    const results: any[] = [];

    // Job timesheets
    if (!type || type === 'job') {
      let jobQuery = supabase
        .from('pr_job_timesheets')
        .select('*, employee:pr_employees(id, name, trade, business_unit_name)')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false });

      if (employeeId) {
        jobQuery = jobQuery.eq('employee_id', employeeId);
      }

      const { data: jobTimesheets } = await jobQuery;

      for (const ts of (jobTimesheets || [])) {
        if (!matchesDept(ts.employee)) continue;
        results.push({
          ...ts,
          type: 'job',
          description: `Job #${ts.job_number || ts.st_job_id}`,
        });
      }
    }

    // Non-job timesheets
    if (!type || type === 'nonjob') {
      let nonJobQuery = supabase
        .from('pr_nonjob_timesheets')
        .select('*, employee:pr_employees(id, name, trade, business_unit_name)')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false });

      if (employeeId) {
        nonJobQuery = nonJobQuery.eq('employee_id', employeeId);
      }

      const { data: nonJobTimesheets } = await nonJobQuery;

      for (const ts of (nonJobTimesheets || [])) {
        if (!matchesDept(ts.employee)) continue;
        results.push({
          ...ts,
          type: 'nonjob',
          description: ts.timesheet_code_name || 'Non-Job Time',
        });
      }
    }

    // Sort combined results by date desc
    results.sort((a, b) => {
      const dateComp = b.date.localeCompare(a.date);
      if (dateComp !== 0) return dateComp;
      return (b.clock_in || '').localeCompare(a.clock_in || '');
    });

    return NextResponse.json({ timesheets: results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
