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
  const trade = searchParams.get('trade');

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end required' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const canViewPay = session.user.role === 'owner' || session.user.role === 'manager';

  try {
    // Get all active employees
    let empQuery = supabase
      .from('pr_employees')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (trade) {
      empQuery = empQuery.eq('trade', trade);
    }

    const { data: employees } = await empQuery;

    // Get pay items for date range
    const { data: payItems } = await supabase
      .from('pr_gross_pay_items')
      .select('employee_id, pay_type, hours, amount')
      .gte('date', start)
      .lte('date', end);

    // Aggregate per employee
    const empStats = new Map<string, {
      total_hours: number;
      regular_hours: number;
      overtime_hours: number;
      performance_pay: number;
      total_pay: number;
    }>();

    for (const item of (payItems || [])) {
      if (!item.employee_id) continue;
      const entry = empStats.get(item.employee_id) || {
        total_hours: 0,
        regular_hours: 0,
        overtime_hours: 0,
        performance_pay: 0,
        total_pay: 0,
      };

      entry.total_hours += Number(item.hours) || 0;
      entry.total_pay += Number(item.amount) || 0;

      if (item.pay_type === 'Regular') {
        entry.regular_hours += Number(item.hours) || 0;
      } else if (item.pay_type === 'Overtime') {
        entry.overtime_hours += Number(item.hours) || 0;
      } else if (item.pay_type === 'PerformancePay') {
        entry.performance_pay += Number(item.amount) || 0;
      }

      empStats.set(item.employee_id, entry);
    }

    const result = (employees || []).map(emp => {
      const stats = empStats.get(emp.id) || {
        total_hours: 0,
        regular_hours: 0,
        overtime_hours: 0,
        performance_pay: 0,
        total_pay: 0,
      };

      return {
        id: emp.id,
        name: emp.name,
        trade: emp.trade,
        business_unit_name: emp.business_unit_name,
        total_hours: stats.total_hours,
        regular_hours: stats.regular_hours,
        overtime_hours: stats.overtime_hours,
        performance_pay: canViewPay ? stats.performance_pay : 0,
        total_pay: canViewPay ? stats.total_pay : 0,
      };
    });

    // Sort by total hours descending, filter out zero-hour employees
    const sorted = result
      .filter(e => e.total_hours > 0)
      .sort((a, b) => b.total_hours - a.total_hours);

    return NextResponse.json({ employees: sorted, can_view_pay: canViewPay });
  } catch (error: any) {
    console.error('Employees error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
