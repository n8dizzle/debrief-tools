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
  const supabase = getServerSupabase();
  const canViewPay = session.user.role === 'owner' || session.user.role === 'manager';

  try {
    const { data: period } = await supabase
      .from('pr_payroll_periods')
      .select('*')
      .eq('id', id)
      .single();

    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    // Get pay items for this period
    const { data: payItems } = await supabase
      .from('pr_gross_pay_items')
      .select('*, employee:pr_employees(id, name, trade)')
      .eq('payroll_period_id', id)
      .order('date');

    // Aggregate by employee
    const empMap = new Map<string, {
      name: string;
      trade: string | null;
      total_hours: number;
      regular_hours: number;
      overtime_hours: number;
      total_pay: number;
      performance_pay: number;
    }>();

    for (const item of (payItems || [])) {
      if (!item.employee?.id) continue;
      const entry = empMap.get(item.employee.id) || {
        name: item.employee.name,
        trade: item.employee.trade,
        total_hours: 0,
        regular_hours: 0,
        overtime_hours: 0,
        total_pay: 0,
        performance_pay: 0,
      };

      entry.total_hours += Number(item.hours) || 0;
      entry.total_pay += Number(item.amount) || 0;
      if (item.pay_type === 'Regular') entry.regular_hours += Number(item.hours) || 0;
      else if (item.pay_type === 'Overtime') entry.overtime_hours += Number(item.hours) || 0;
      else if (item.pay_type === 'PerformancePay') entry.performance_pay += Number(item.amount) || 0;

      empMap.set(item.employee.id, entry);
    }

    const employees = Array.from(empMap.entries())
      .map(([id, data]) => ({
        employee_id: id,
        ...data,
        total_pay: canViewPay ? data.total_pay : 0,
        performance_pay: canViewPay ? data.performance_pay : 0,
      }))
      .sort((a, b) => b.total_hours - a.total_hours);

    // Get adjustments for this period
    const { data: adjustments } = await supabase
      .from('pr_payroll_adjustments')
      .select('*, employee:pr_employees(id, name)')
      .eq('payroll_period_id', id);

    return NextResponse.json({
      period,
      employees,
      adjustments: canViewPay ? (adjustments || []) : [],
      can_view_pay: canViewPay,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
