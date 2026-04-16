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
      // Support filtering by role for office staff (who have null business_unit_name)
      const buNames = deptList.filter(d => !['Admin', 'CSR', 'Dispatch', 'GeneralOffice', 'Accounting', 'Owner', 'SalesManager', 'FieldManager'].includes(d));
      const roles = deptList.filter(d => ['Admin', 'CSR', 'Dispatch', 'GeneralOffice', 'Accounting', 'Owner', 'SalesManager', 'FieldManager'].includes(d));
      if (buNames.length > 0 && roles.length > 0) {
        empQuery = empQuery.or(`business_unit_name.in.(${buNames.join(',')}),role.in.(${roles.join(',')})`);
      } else if (buNames.length > 0) {
        empQuery = empQuery.in('business_unit_name', buNames);
      } else if (roles.length > 0) {
        empQuery = empQuery.in('role', roles);
      }
    }

    const { data: employees } = await empQuery;

    // Get pay items for date range
    const { data: payItems } = await supabase
      .from('pr_gross_pay_items')
      .select('employee_id, pay_type, hours, amount')
      .gte('date', start)
      .lte('date', end);

    // Get timesheet hours for date range (job + non-job)
    const [{ data: jobTs }, { data: nonJobTs }] = await Promise.all([
      supabase
        .from('pr_job_timesheets')
        .select('employee_id, duration_hours')
        .gte('date', start)
        .lte('date', end),
      supabase
        .from('pr_nonjob_timesheets')
        .select('employee_id, duration_hours')
        .gte('date', start)
        .lte('date', end),
    ]);

    // Aggregate timesheet hours per employee
    const tsHours = new Map<string, number>();
    for (const ts of [...(jobTs || []), ...(nonJobTs || [])]) {
      if (!ts.employee_id || !ts.duration_hours) continue;
      tsHours.set(ts.employee_id, (tsHours.get(ts.employee_id) || 0) + Number(ts.duration_hours));
    }

    // Aggregate pay items per employee
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

    // For employees without pay item hours, use timesheet hours
    tsHours.forEach((hours, empId) => {
      const existing = empStats.get(empId);
      if (!existing || existing.total_hours === 0) {
        empStats.set(empId, {
          total_hours: hours,
          regular_hours: hours, // timesheets don't distinguish OT
          overtime_hours: existing?.overtime_hours || 0,
          performance_pay: existing?.performance_pay || 0,
          total_pay: existing?.total_pay || 0,
        });
      }
    });

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
        business_unit_name: emp.business_unit_name || emp.role || 'Unassigned',
        total_hours: stats.total_hours,
        regular_hours: stats.regular_hours,
        overtime_hours: stats.overtime_hours,
        performance_pay: canViewPay ? stats.performance_pay : 0,
        total_pay: canViewPay ? stats.total_pay : 0,
      };
    });

    // Sort by total hours descending (zero-hour employees at end)
    const sorted = result.sort((a, b) => b.total_hours - a.total_hours);

    // Get ALL unique business unit names + roles for filter dropdown (unfiltered)
    const { data: allEmps } = await supabase
      .from('pr_employees')
      .select('business_unit_name, role')
      .eq('is_active', true);

    const buSet = new Set<string>();
    for (const e of (allEmps || [])) {
      if (e.business_unit_name) {
        buSet.add(e.business_unit_name);
      } else if (e.role) {
        buSet.add(e.role);
      }
    }
    const businessUnits = Array.from(buSet).sort();

    return NextResponse.json({ employees: sorted, business_units: businessUnits, can_view_pay: canViewPay });
  } catch (error: any) {
    console.error('Employees error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
