import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const canViewPay = session.user.role === 'owner' || session.user.role === 'manager';

  try {
    const { data: periods } = await supabase
      .from('pr_payroll_periods')
      .select('*')
      .order('start_date', { ascending: false });

    // Get pay item summaries per period
    const { data: payItems } = await supabase
      .from('pr_gross_pay_items')
      .select('payroll_period_id, pay_type, hours, amount, employee_id');

    // Aggregate per period
    const periodStats = new Map<string, {
      total_hours: number;
      regular_hours: number;
      overtime_hours: number;
      total_pay: number;
      performance_pay: number;
      employee_count: number;
      employees: Set<string>;
    }>();

    for (const item of (payItems || [])) {
      if (!item.payroll_period_id) continue;
      const entry = periodStats.get(item.payroll_period_id) || {
        total_hours: 0,
        regular_hours: 0,
        overtime_hours: 0,
        total_pay: 0,
        performance_pay: 0,
        employee_count: 0,
        employees: new Set<string>(),
      };

      entry.total_hours += Number(item.hours) || 0;
      entry.total_pay += Number(item.amount) || 0;
      if (item.employee_id) entry.employees.add(item.employee_id);

      if (item.pay_type === 'Regular') entry.regular_hours += Number(item.hours) || 0;
      else if (item.pay_type === 'Overtime') entry.overtime_hours += Number(item.hours) || 0;
      else if (item.pay_type === 'PerformancePay') entry.performance_pay += Number(item.amount) || 0;

      periodStats.set(item.payroll_period_id, entry);
    }

    const result = (periods || []).map(period => {
      const stats = periodStats.get(period.id);
      return {
        ...period,
        total_hours: stats?.total_hours || 0,
        regular_hours: stats?.regular_hours || 0,
        overtime_hours: stats?.overtime_hours || 0,
        total_pay: canViewPay ? (stats?.total_pay || 0) : 0,
        performance_pay: canViewPay ? (stats?.performance_pay || 0) : 0,
        employee_count: stats?.employees.size || 0,
      };
    });

    return NextResponse.json({ periods: result, can_view_pay: canViewPay });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
