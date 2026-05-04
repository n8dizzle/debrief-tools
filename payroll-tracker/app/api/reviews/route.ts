import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

const PTO_KEYWORDS = ['pto', 'vacation', 'sick', 'holiday', 'time off', 'personal', 'bereavement', 'jury', 'leave'];
const DAILY_HOURS_FLAG_THRESHOLD = 14;

function isRoundDuration(hours: number): boolean {
  if (!hours || hours <= 0) return false;
  const minutes = Math.round(hours * 60);
  return minutes % 15 === 0 || minutes % 20 === 0;
}

function dayKey(employeeId: string, date: string): string {
  return `${employeeId}|${date}`;
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
    // Pull job + non-job timesheets so we can detect overlaps and accurate daily totals.
    const [tsRes, njRes, payRes] = await Promise.all([
      supabase
        .from('pr_job_timesheets')
        .select('*, employee:pr_employees(id, name, business_unit_name)')
        .gte('date', start)
        .lte('date', end),
      supabase
        .from('pr_nonjob_timesheets')
        .select('*, employee:pr_employees(id, name, business_unit_name)')
        .gte('date', start)
        .lte('date', end),
      supabase
        .from('pr_gross_pay_items')
        .select('*, employee:pr_employees(id, name, business_unit_name)')
        .gte('date', start)
        .lte('date', end),
    ]);

    const { data: timesheets } = tsRes;
    const { data: nonjobTimesheets } = njRes;
    const { data: allPayItems } = payRes;

    const filteredTS = (timesheets || []).filter(ts => matchesDept(ts.employee));
    const filteredNJ = (nonjobTimesheets || []).filter(ts => matchesDept(ts.employee));
    const filteredPay = (allPayItems || []).filter(item => matchesDept(item.employee));

    // Build per-(employee, date) clocked entries from BOTH job and non-job timesheets.
    type ClockEntry = { id: string; source: 'job' | 'nonjob'; clock_in: string | null; clock_out: string | null; duration_hours: number };
    const dayEntries = new Map<string, ClockEntry[]>();
    const pushEntry = (employeeId: string, date: string, entry: ClockEntry) => {
      const k = dayKey(employeeId, date);
      const arr = dayEntries.get(k) || [];
      arr.push(entry);
      dayEntries.set(k, arr);
    };
    for (const ts of filteredTS) {
      if (!ts.employee?.id) continue;
      pushEntry(ts.employee.id, ts.date, {
        id: ts.id,
        source: 'job',
        clock_in: ts.clock_in,
        clock_out: ts.clock_out,
        duration_hours: Number(ts.duration_hours) || 0,
      });
    }
    for (const ts of filteredNJ) {
      if (!ts.employee?.id) continue;
      pushEntry(ts.employee.id, ts.date, {
        id: ts.id,
        source: 'nonjob',
        clock_in: ts.clock_in,
        clock_out: ts.clock_out,
        duration_hours: Number(ts.duration_hours) || 0,
      });
    }

    // Daily totals (employee, date) -> total clocked hours.
    const dayTotal = new Map<string, number>();
    dayEntries.forEach((entries, k) => {
      const total = entries.reduce((s: number, e: ClockEntry) => s + e.duration_hours, 0);
      dayTotal.set(k, total);
    });

    // Days with PTO (any pay item flagged as PTO/Other/keyword).
    const ptoDaySet = new Set<string>();
    for (const item of filteredPay) {
      if (!item.employee?.id) continue;
      const isPto = item.pay_type === 'Other' || (item.activity && PTO_KEYWORDS.some(kw => item.activity.toLowerCase().includes(kw)));
      if (isPto && (Number(item.hours) || 0) > 0) {
        ptoDaySet.add(dayKey(item.employee.id, item.date));
      }
    }

    // Per-row overlap check: does THIS timesheet's interval intersect any other entry on the same day?
    const overlapsOther = (ts: { id: string; clock_in: string | null; clock_out: string | null; employee?: { id: string } | null; date: string }): boolean => {
      if (!ts.clock_in || !ts.clock_out || !ts.employee?.id) return false;
      const others = dayEntries.get(dayKey(ts.employee.id, ts.date)) || [];
      const myStart = new Date(ts.clock_in).getTime();
      const myEnd = new Date(ts.clock_out).getTime();
      if (!(myEnd > myStart)) return false;
      for (const o of others) {
        if (o.id === ts.id) continue;
        if (!o.clock_in || !o.clock_out) continue;
        const oStart = new Date(o.clock_in).getTime();
        const oEnd = new Date(o.clock_out).getTime();
        if (!(oEnd > oStart)) continue;
        if (myStart < oEnd && oStart < myEnd) return true;
      }
      return false;
    };

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
      const k = dayKey(ts.employee.id, ts.date);
      const flags: string[] = [];

      if (duration > 0 && isRoundDuration(duration)) {
        flags.push('Round Duration');
      }
      if (duration > 0 && (!ts.clock_in || !ts.clock_out)) {
        flags.push('Missing Clock');
      }
      if (overlapsOther(ts)) {
        flags.push('Overlapping');
      }
      if ((dayTotal.get(k) || 0) > DAILY_HOURS_FLAG_THRESHOLD) {
        flags.push(`Day Total >${DAILY_HOURS_FLAG_THRESHOLD}h`);
      }
      if (duration > 0 && ptoDaySet.has(k)) {
        flags.push('PTO + Job');
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
