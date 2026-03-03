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
  const canViewPay = session.user.role === 'owner' || session.user.role === 'manager';

  try {
    // Get employee
    const { data: employee, error } = await supabase
      .from('pr_employees')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Get pay items
    let payQuery = supabase
      .from('pr_gross_pay_items')
      .select('*')
      .eq('employee_id', id)
      .order('date', { ascending: false });

    if (start && end) {
      payQuery = payQuery.gte('date', start).lte('date', end);
    }

    const { data: payItems } = await payQuery;

    // Summary stats
    let totalHours = 0, regularHours = 0, overtimeHours = 0;
    let totalPay = 0, performancePay = 0;

    for (const item of (payItems || [])) {
      totalHours += Number(item.hours) || 0;
      totalPay += Number(item.amount) || 0;
      if (item.pay_type === 'Regular') regularHours += Number(item.hours) || 0;
      else if (item.pay_type === 'Overtime') overtimeHours += Number(item.hours) || 0;
      else if (item.pay_type === 'PerformancePay') performancePay += Number(item.amount) || 0;
    }

    return NextResponse.json({
      employee,
      summary: {
        total_hours: totalHours,
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        total_pay: canViewPay ? totalPay : 0,
        performance_pay: canViewPay ? performancePay : 0,
        avg_hourly_rate: canViewPay && totalHours > 0 ? totalPay / totalHours : 0,
      },
      can_view_pay: canViewPay,
    });
  } catch (error: any) {
    console.error('Employee detail error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
