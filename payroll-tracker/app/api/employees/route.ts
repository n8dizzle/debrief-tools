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
  const departments = searchParams.get('departments'); // comma-separated BU names

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end required' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const canViewPay = session.user.role === 'owner' || session.user.role === 'manager';
  const deptList = departments ? departments.split(',').map(d => d.trim()).filter(Boolean) : [];

  try {
    // Get all active employees
    let empQuery = supabase
      .from('pr_employees')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (deptList.length > 0) {
      empQuery = empQuery.in('business_unit_name', deptList);
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
        role: emp.role,
        business_unit_name: emp.business_unit_name,
        total_hours: stats.total_hours,
        regular_hours: stats.regular_hours,
        overtime_hours: stats.overtime_hours,
        performance_pay: canViewPay ? stats.performance_pay : 0,
        total_pay: canViewPay ? stats.total_pay : 0,
      };
    });

    // Sort by total hours descending (zero-hour employees at end)
    const sorted = result.sort((a, b) => b.total_hours - a.total_hours);

    // Get ALL unique business unit names for filter dropdown (unfiltered)
    const { data: allEmps } = await supabase
      .from('pr_employees')
      .select('business_unit_name')
      .eq('is_active', true)
      .not('business_unit_name', 'is', null);

    const businessUnits = Array.from(new Set(
      (allEmps || []).map((e: any) => e.business_unit_name)
    )).sort();

    return NextResponse.json({ employees: sorted, business_units: businessUnits, can_view_pay: canViewPay });
  } catch (error: any) {
    console.error('Employees error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
