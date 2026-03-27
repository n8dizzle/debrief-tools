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
  const url = new URL(request.url);
  const startDate = url.searchParams.get('start');
  const endDate = url.searchParams.get('end');
  const trade = url.searchParams.get('trade');
  const employeeType = url.searchParams.get('type');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start and end date required' }, { status: 400 });
  }

  try {
    // Query gross pay items grouped by employee
    let query = supabase
      .from('labor_gross_pay_items')
      .select('employee_id, employee_name, employee_type, amount, paid_duration_hours, paid_time_type, gross_pay_item_type, trade')
      .gte('date', startDate)
      .lte('date', endDate);

    if (trade) {
      query = query.eq('trade', trade);
    }

    const { data: items, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Aggregate by employee
    const employeeMap = new Map<number, {
      employee_id: number;
      name: string;
      type: string;
      trade: string | null;
      totalPay: number;
      hourlyPay: number;
      overtimePay: number;
      commissions: number;
      totalHours: number;
    }>();

    for (const item of items || []) {
      const empId = item.employee_id;
      const existing = employeeMap.get(empId) || {
        employee_id: empId,
        name: item.employee_name || `Employee ${empId}`,
        type: item.employee_type || 'Unknown',
        trade: null as string | null,
        totalPay: 0,
        hourlyPay: 0,
        overtimePay: 0,
        commissions: 0,
        totalHours: 0,
      };

      const amount = Number(item.amount) || 0;
      const hours = Number(item.paid_duration_hours) || 0;
      const type = item.gross_pay_item_type || '';
      const paidTimeType = item.paid_time_type || '';

      existing.totalPay += amount;

      if (type === 'TimesheetTime' || type === 'Timesheet') {
        if (paidTimeType === 'Overtime') {
          existing.overtimePay += amount;
        } else {
          existing.hourlyPay += amount;
        }
        existing.totalHours += hours;
      } else {
        existing.commissions += amount;
      }

      // Track trade (prefer non-null)
      if (item.trade && !existing.trade) {
        existing.trade = item.trade;
      }

      employeeMap.set(empId, existing);
    }

    let employees = Array.from(employeeMap.values()).map(emp => ({
      ...emp,
      totalPay: Math.round(emp.totalPay * 100) / 100,
      hourlyPay: Math.round(emp.hourlyPay * 100) / 100,
      overtimePay: Math.round(emp.overtimePay * 100) / 100,
      commissions: Math.round(emp.commissions * 100) / 100,
      totalHours: Math.round(emp.totalHours * 100) / 100,
      avgPerHour: emp.totalHours > 0
        ? Math.round((emp.totalPay / emp.totalHours) * 100) / 100
        : 0,
    }));

    // Filter by employee type if specified
    if (employeeType) {
      employees = employees.filter(e => e.type === employeeType);
    }

    // Sort by total pay descending
    employees.sort((a, b) => b.totalPay - a.totalPay);

    return NextResponse.json({ employees });
  } catch (error) {
    console.error('Employees API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
