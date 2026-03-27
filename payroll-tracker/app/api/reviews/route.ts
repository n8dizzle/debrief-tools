import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

const PTO_KEYWORDS = ['pto', 'vacation', 'sick', 'holiday', 'time off', 'personal', 'bereavement', 'jury', 'leave'];

function isRoundDuration(hours: number): boolean {
  if (!hours || hours <= 0) return false;
  const minutes = Math.round(hours * 60);
  return minutes % 15 === 0 || minutes % 20 === 0;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Manager/owner only
  if (session.user.role !== 'owner' && session.user.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const departments = searchParams.get('departments');

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end required' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const canViewPay = session.user.role === 'owner' || session.user.role === 'manager';
  const deptList = departments ? departments.split(',').map(d => d.trim()).filter(Boolean) : [];

  const matchesDept = (emp: { business_unit_name?: string | null } | null) => {
    if (!emp) return false;
    if (deptList.length === 0) return true;
    return deptList.includes(emp.business_unit_name || '');
  };

  try {
    // --- Overtime ---
    const otQuery = supabase
      .from('pr_gross_pay_items')
      .select('*, employee:pr_employees(id, name, business_unit_name)')
      .eq('pay_type', 'Overtime')
      .gte('date', start)
      .lte('date', end);

    const { data: otItems } = await otQuery;
    const filteredOT = (otItems || []).filter(item => matchesDept(item.employee));

    // Group OT by employee
    const otByEmployee = new Map<string, {
      employee_id: string;
      name: string;
      total_hours: number;
      total_amount: number;
      items: { date: string; st_job_id: number | null; job_number: string | null; activity: string | null; hours: number; amount: number }[];
    }>();

    for (const item of filteredOT) {
      if (!item.employee?.id) continue;
      const key = item.employee.id;
      const entry = otByEmployee.get(key) || {
        employee_id: key,
        name: item.employee.name,
        total_hours: 0,
        total_amount: 0,
        items: [] as { date: string; st_job_id: number | null; job_number: string | null; activity: string | null; hours: number; amount: number }[],
      };
      const hours = Number(item.hours) || 0;
      const amount = Number(item.amount) || 0;
      entry.total_hours += hours;
      entry.total_amount += amount;
      entry.items.push({
        date: item.date,
        st_job_id: item.st_job_id,
        job_number: item.job_number,
        activity: item.activity,
        hours,
        amount: canViewPay ? amount : 0,
      });
      otByEmployee.set(key, entry);
    }

    const overtimeEmployees = Array.from(otByEmployee.values())
      .map(e => ({
        ...e,
        total_amount: canViewPay ? e.total_amount : 0,
        items: e.items.sort((a, b) => a.date.localeCompare(b.date)),
      }))
      .sort((a, b) => b.total_hours - a.total_hours);

    // --- Suspicious Auto-Entries ---
    const tsQuery = supabase
      .from('pr_job_timesheets')
      .select('*, employee:pr_employees(id, name, business_unit_name)')
      .gte('date', start)
      .lte('date', end);

    const { data: timesheets } = await tsQuery;
    const filteredTS = (timesheets || []).filter(ts => matchesDept(ts.employee));

    const suspiciousEntries: {
      date: string;
      employee_id: string;
      employee_name: string;
      st_job_id: number | null;
      job_number: string | null;
      duration_hours: number;
      clock_in: string | null;
      clock_out: string | null;
      flags: string[];
    }[] = [];

    for (const ts of filteredTS) {
      if (!ts.employee?.id) continue;
      const duration = Number(ts.duration_hours) || 0;
      const flags: string[] = [];

      if (duration > 0 && isRoundDuration(duration)) {
        flags.push('Round Duration');
      }
      if (duration > 0 && (!ts.clock_in || !ts.clock_out)) {
        flags.push('Missing Clock');
      }

      if (flags.length > 0) {
        suspiciousEntries.push({
          date: ts.date,
          employee_id: ts.employee.id,
          employee_name: ts.employee.name,
          st_job_id: ts.st_job_id,
          job_number: ts.job_number,
          duration_hours: duration,
          clock_in: ts.clock_in,
          clock_out: ts.clock_out,
          flags,
        });
      }
    }

    suspiciousEntries.sort((a, b) => a.date.localeCompare(b.date) || a.employee_name.localeCompare(b.employee_name));

    // --- PTO / Time Off ---
    const ptoQuery = supabase
      .from('pr_gross_pay_items')
      .select('*, employee:pr_employees(id, name, business_unit_name)')
      .gte('date', start)
      .lte('date', end);

    const { data: allPayItems } = await ptoQuery;
    const filteredPay = (allPayItems || []).filter(item => matchesDept(item.employee));

    // Filter for PTO: pay_type = 'Other' OR activity matches keywords
    const ptoItems = filteredPay.filter(item => {
      if (item.pay_type === 'Other') return true;
      if (item.activity) {
        const lower = item.activity.toLowerCase();
        return PTO_KEYWORDS.some(kw => lower.includes(kw));
      }
      return false;
    });

    // Group PTO by employee
    const ptoByEmployee = new Map<string, {
      employee_id: string;
      name: string;
      total_hours: number;
      total_amount: number;
      items: { date: string; activity: string | null; pay_type: string; hours: number; amount: number }[];
    }>();

    for (const item of ptoItems) {
      if (!item.employee?.id) continue;
      const key = item.employee.id;
      const entry = ptoByEmployee.get(key) || {
        employee_id: key,
        name: item.employee.name,
        total_hours: 0,
        total_amount: 0,
        items: [] as { date: string; activity: string | null; pay_type: string; hours: number; amount: number }[],
      };
      const hours = Number(item.hours) || 0;
      const amount = Number(item.amount) || 0;
      entry.total_hours += hours;
      entry.total_amount += amount;
      entry.items.push({
        date: item.date,
        activity: item.activity,
        pay_type: item.pay_type,
        hours,
        amount: canViewPay ? amount : 0,
      });
      ptoByEmployee.set(key, entry);
    }

    const ptoEmployees = Array.from(ptoByEmployee.values())
      .map(e => ({
        ...e,
        total_amount: canViewPay ? e.total_amount : 0,
        items: e.items.sort((a, b) => a.date.localeCompare(b.date)),
      }))
      .sort((a, b) => b.total_hours - a.total_hours);

    // Get business units for filter dropdown
    const { data: buList } = await supabase
      .from('pr_employees')
      .select('business_unit_name')
      .eq('is_active', true)
      .not('business_unit_name', 'is', null);

    const buNames = Array.from(new Set((buList || []).map((e: any) => e.business_unit_name))).sort();

    return NextResponse.json({
      overtime: {
        employees: overtimeEmployees,
        total_hours: overtimeEmployees.reduce((s, e) => s + e.total_hours, 0),
        total_amount: canViewPay ? overtimeEmployees.reduce((s, e) => s + e.total_amount, 0) : 0,
        count: overtimeEmployees.length,
      },
      suspicious: {
        entries: suspiciousEntries,
        count: suspiciousEntries.length,
      },
      pto: {
        employees: ptoEmployees,
        total_hours: ptoEmployees.reduce((s, e) => s + e.total_hours, 0),
        count: ptoEmployees.length,
      },
      business_units: buNames,
      can_view_pay: canViewPay,
    });
  } catch (error: any) {
    console.error('Reviews error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
