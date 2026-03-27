import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { formatLocalDate } from '@/lib/payroll-utils';

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon);
  return formatLocalDate(monday);
}

function formatWeekRange(mondayStr: string): string {
  const mon = new Date(mondayStr + 'T00:00:00');
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(mon)} - ${fmt(sun)}`;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'owner' && session.user.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const weeksBack = parseInt(searchParams.get('weeks') || '12', 10);
  const departments = searchParams.get('departments') || '';

  // Calculate date range: N weeks back from current week's Monday
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const thisMon = new Date(now);
  thisMon.setDate(now.getDate() + diffToMon);
  const thisSun = new Date(thisMon);
  thisSun.setDate(thisMon.getDate() + 6);

  const startMon = new Date(thisMon);
  startMon.setDate(thisMon.getDate() - (weeksBack - 1) * 7);

  const start = formatLocalDate(startMon);
  const end = formatLocalDate(thisSun);

  const supabase = getServerSupabase();
  const canViewPay = session.user.role === 'owner' || session.user.role === 'manager';
  const deptList = departments ? departments.split(',').map(d => d.trim()).filter(Boolean) : [];

  const matchesDept = (emp: { business_unit_name?: string | null } | null) => {
    if (!emp) return false;
    if (deptList.length === 0) return true;
    return deptList.includes(emp.business_unit_name || '');
  };

  try {
    // Fetch all OT pay items in range
    const { data: otItems, error } = await supabase
      .from('pr_gross_pay_items')
      .select('*, employee:pr_employees(id, name, business_unit_name)')
      .eq('pay_type', 'Overtime')
      .gte('date', start)
      .lte('date', end);

    if (error) throw error;

    const filtered = (otItems || []).filter(item => matchesDept(item.employee));

    // Also fetch regular hours to calculate OT as % of total
    const { data: regItems } = await supabase
      .from('pr_gross_pay_items')
      .select('st_employee_id, hours, date, employee:pr_employees(business_unit_name)')
      .eq('pay_type', 'Regular')
      .gte('date', start)
      .lte('date', end);

    const filteredReg = (regItems || []).filter(item => matchesDept(item.employee as any));

    // Build regular hours by employee+week
    const regByEmpWeek = new Map<string, number>();
    for (const item of filteredReg) {
      const week = getWeekLabel(item.date);
      const key = `${item.st_employee_id}::${week}`;
      regByEmpWeek.set(key, (regByEmpWeek.get(key) || 0) + (Number(item.hours) || 0));
    }

    // Build ordered list of all weeks in range
    const allWeeks: string[] = [];
    const cursor = new Date(startMon);
    while (cursor <= thisSun) {
      allWeeks.push(formatLocalDate(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }

    // Group OT by employee -> week
    const employeeMap = new Map<string, {
      employee_id: string;
      st_employee_id: number;
      name: string;
      department: string | null;
      weeks: Map<string, { hours: number; amount: number; items: { date: string; job_number: string | null; activity: string | null; hours: number; amount: number }[] }>;
    }>();

    for (const item of filtered) {
      if (!item.employee?.id) continue;
      const empId = item.employee.id;
      const week = getWeekLabel(item.date);
      const hours = Number(item.hours) || 0;
      const amount = Number(item.amount) || 0;

      let emp = employeeMap.get(empId);
      if (!emp) {
        emp = {
          employee_id: empId,
          st_employee_id: item.st_employee_id,
          name: item.employee.name,
          department: item.employee.business_unit_name,
          weeks: new Map(),
        };
        employeeMap.set(empId, emp);
      }

      let weekData = emp.weeks.get(week);
      if (!weekData) {
        weekData = { hours: 0, amount: 0, items: [] };
        emp.weeks.set(week, weekData);
      }
      weekData.hours += hours;
      weekData.amount += amount;
      weekData.items.push({
        date: item.date,
        job_number: item.job_number,
        activity: item.activity,
        hours,
        amount,
      });
    }

    // Build response
    const employees = Array.from(employeeMap.values()).map(emp => {
      const weeksWithOT = emp.weeks.size;
      const totalHours = Array.from(emp.weeks.values()).reduce((s, w) => s + w.hours, 0);
      const totalAmount = Array.from(emp.weeks.values()).reduce((s, w) => s + w.amount, 0);
      const avgPerWeek = weeksWithOT > 0 ? totalHours / weeksWithOT : 0;

      // Weekly breakdown for the chart/table
      const weeklyBreakdown = allWeeks.map(weekStart => {
        const weekData = emp.weeks.get(weekStart);
        const regKey = `${emp.st_employee_id}::${weekStart}`;
        const regHours = regByEmpWeek.get(regKey) || 0;
        return {
          week: weekStart,
          label: formatWeekRange(weekStart),
          ot_hours: weekData?.hours || 0,
          ot_amount: canViewPay ? (weekData?.amount || 0) : 0,
          regular_hours: regHours,
          items: weekData?.items.map(i => ({
            ...i,
            amount: canViewPay ? i.amount : 0,
          })) || [],
        };
      });

      // Streak: consecutive recent weeks with OT
      let streak = 0;
      for (let i = allWeeks.length - 1; i >= 0; i--) {
        if (emp.weeks.has(allWeeks[i])) streak++;
        else break;
      }

      return {
        employee_id: emp.employee_id,
        name: emp.name,
        department: emp.department,
        weeks_with_ot: weeksWithOT,
        total_weeks: allWeeks.length,
        frequency: Math.round((weeksWithOT / allWeeks.length) * 100),
        total_hours: totalHours,
        total_amount: canViewPay ? totalAmount : 0,
        avg_per_week: avgPerWeek,
        current_streak: streak,
        weekly: weeklyBreakdown,
      };
    });

    // Sort by frequency (most habitual first), then total hours
    employees.sort((a, b) => b.frequency - a.frequency || b.total_hours - a.total_hours);

    // Get business units for filter dropdown
    const { data: buList } = await supabase
      .from('pr_employees')
      .select('business_unit_name')
      .eq('is_active', true)
      .not('business_unit_name', 'is', null);

    const buNames = Array.from(new Set((buList || []).map((e: any) => e.business_unit_name))).sort();

    return NextResponse.json({
      employees,
      weeks: allWeeks.map(w => ({ start: w, label: formatWeekRange(w) })),
      total_weeks: allWeeks.length,
      range: { start, end },
      can_view_pay: canViewPay,
      business_units: buNames,
    });
  } catch (error: any) {
    console.error('Overtime analysis error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
