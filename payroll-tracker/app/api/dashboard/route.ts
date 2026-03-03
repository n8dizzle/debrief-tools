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
  const trade = searchParams.get('trade'); // 'hvac' | 'plumbing' | null (all)

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end required' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const canViewPay = session.user.role === 'owner' || session.user.role === 'manager';

  try {
    // Get gross pay items in date range
    let payQuery = supabase
      .from('pr_gross_pay_items')
      .select('*, employee:pr_employees(id, name, trade, business_unit_name)')
      .gte('date', start)
      .lte('date', end);

    if (trade) {
      payQuery = payQuery.eq('employee.trade', trade);
    }

    const { data: payItems } = await payQuery;

    // Filter out items where employee didn't match trade filter (inner join workaround)
    const filteredItems = trade
      ? (payItems || []).filter(item => item.employee?.trade === trade)
      : (payItems || []);

    // Get non-job timesheets for non-job hours
    let nonJobQuery = supabase
      .from('pr_nonjob_timesheets')
      .select('*, employee:pr_employees(id, name, trade)')
      .gte('date', start)
      .lte('date', end);

    const { data: nonJobTimesheets } = await nonJobQuery;
    const filteredNonJob = trade
      ? (nonJobTimesheets || []).filter(ts => ts.employee?.trade === trade)
      : (nonJobTimesheets || []);

    // Compute KPIs
    let totalHours = 0;
    let regularHours = 0;
    let overtimeHours = 0;
    let totalPay = 0;
    let performancePay = 0;
    const employeeSet = new Set<string>();

    for (const item of filteredItems) {
      totalHours += Number(item.hours) || 0;
      totalPay += Number(item.amount) || 0;
      if (item.employee?.id) employeeSet.add(item.employee.id);

      if (item.pay_type === 'Regular') {
        regularHours += Number(item.hours) || 0;
      } else if (item.pay_type === 'Overtime') {
        overtimeHours += Number(item.hours) || 0;
      } else if (item.pay_type === 'PerformancePay') {
        performancePay += Number(item.amount) || 0;
      }
    }

    let nonJobHours = 0;
    for (const ts of filteredNonJob) {
      nonJobHours += Number(ts.duration_hours) || 0;
    }

    const avgHourlyRate = totalHours > 0 ? totalPay / totalHours : 0;

    // Daily hours aggregation for chart
    const dailyMap = new Map<string, { regular: number; overtime: number; non_job: number }>();
    for (const item of filteredItems) {
      const day = item.date;
      const entry = dailyMap.get(day) || { regular: 0, overtime: 0, non_job: 0 };
      if (item.pay_type === 'Regular') {
        entry.regular += Number(item.hours) || 0;
      } else if (item.pay_type === 'Overtime') {
        entry.overtime += Number(item.hours) || 0;
      }
      dailyMap.set(day, entry);
    }
    for (const ts of filteredNonJob) {
      const day = ts.date;
      const entry = dailyMap.get(day) || { regular: 0, overtime: 0, non_job: 0 };
      entry.non_job += Number(ts.duration_hours) || 0;
      dailyMap.set(day, entry);
    }

    const dailyHours = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top 10 earners
    const earnerMap = new Map<string, { name: string; hours: number; pay: number; perfPay: number }>();
    for (const item of filteredItems) {
      if (!item.employee?.id) continue;
      const entry = earnerMap.get(item.employee.id) || {
        name: item.employee.name,
        hours: 0,
        pay: 0,
        perfPay: 0,
      };
      entry.hours += Number(item.hours) || 0;
      entry.pay += Number(item.amount) || 0;
      if (item.pay_type === 'PerformancePay') {
        entry.perfPay += Number(item.amount) || 0;
      }
      earnerMap.set(item.employee.id, entry);
    }

    const topEarners = Array.from(earnerMap.entries())
      .map(([id, data]) => ({
        employee_id: id,
        employee_name: data.name,
        total_hours: data.hours,
        total_pay: canViewPay ? data.pay : 0,
        performance_pay: canViewPay ? data.perfPay : 0,
      }))
      .sort((a, b) => b.total_pay - a.total_pay)
      .slice(0, 10);

    // Last sync
    const { data: lastSync } = await supabase
      .from('pr_sync_log')
      .select('completed_at')
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      total_hours: totalHours,
      regular_hours: regularHours,
      overtime_hours: overtimeHours,
      total_pay: canViewPay ? totalPay : 0,
      performance_pay: canViewPay ? performancePay : 0,
      non_job_hours: nonJobHours,
      avg_hourly_rate: canViewPay ? avgHourlyRate : 0,
      employee_count: employeeSet.size,
      daily_hours: dailyHours,
      top_earners: topEarners,
      last_sync: lastSync?.completed_at || null,
      can_view_pay: canViewPay,
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
