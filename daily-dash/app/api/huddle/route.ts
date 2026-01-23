import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import {
  HuddleDashboardResponse,
  HuddleDepartmentWithKPIs,
  HuddleKPIWithData,
  HuddleKPIStatus,
  HuddleSnapshot,
} from '@/lib/supabase';
import { getStatusFromPercentage, getTodayDateString } from '@/lib/huddle-utils';

// Helper to get business days in the current week up to the given date
function getBusinessDaysInWeekForDate(date: Date, holidays: string[]): number {
  const holidaySet = new Set(holidays);
  const dayOfWeek = date.getDay();
  // Get Monday of this week
  const monday = new Date(date);
  monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  let count = 0;
  const current = new Date(monday);

  // Count business days from Monday to the given date (inclusive)
  while (current <= date) {
    const day = current.getDay();
    const dateStr = current.toISOString().split('T')[0];
    // Monday=1 to Friday=5, not a holiday
    if (day >= 1 && day <= 5 && !holidaySet.has(dateStr)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

// Helper to get total business days in the current week
function getTotalBusinessDaysInWeek(date: Date, holidays: string[]): number {
  const holidaySet = new Set(holidays);
  const dayOfWeek = date.getDay();
  // Get Monday of this week
  const monday = new Date(date);
  monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  let count = 0;
  const current = new Date(monday);

  // Count all business days Mon-Fri
  for (let i = 0; i < 5; i++) {
    const dateStr = current.toISOString().split('T')[0];
    if (!holidaySet.has(dateStr)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

// Helper to get business days elapsed in month up to given date
function getBusinessDaysElapsedInMonth(date: Date, holidays: string[]): number {
  const holidaySet = new Set(holidays);
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);

  let count = 0;
  const current = new Date(firstOfMonth);

  while (current <= date) {
    const day = current.getDay();
    const dateStr = current.toISOString().split('T')[0];
    if (day >= 1 && day <= 5 && !holidaySet.has(dateStr)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

// GET /api/huddle - Get today's dashboard data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const date = dateParam || getTodayDateString();

    // Fetch all departments with their KPIs
    const { data: departments, error: deptError } = await supabase
      .from('huddle_departments')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (deptError) {
      console.error('Error fetching departments:', deptError);
      return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
    }

    // Fetch all KPIs
    const { data: kpis, error: kpiError } = await supabase
      .from('huddle_kpis')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (kpiError) {
      console.error('Error fetching KPIs:', kpiError);
      return NextResponse.json({ error: 'Failed to fetch KPIs' }, { status: 500 });
    }

    // Fetch snapshots for the date
    const { data: snapshots, error: snapError } = await supabase
      .from('huddle_snapshots')
      .select('*')
      .eq('snapshot_date', date);

    if (snapError) {
      console.error('Error fetching snapshots:', snapError);
    }

    // Fetch targets (most recent for each KPI)
    const { data: targets, error: targetError } = await supabase
      .from('huddle_targets')
      .select('*')
      .eq('target_type', 'daily')
      .lte('effective_date', date)
      .order('effective_date', { ascending: false });

    if (targetError) {
      console.error('Error fetching targets:', targetError);
    }

    // Fetch notes for the date
    const { data: notes, error: notesError } = await supabase
      .from('huddle_notes')
      .select('*')
      .eq('note_date', date);

    if (notesError) {
      console.error('Error fetching notes:', notesError);
    }

    // Build snapshot lookup
    type SnapshotRecord = {
      id: string;
      kpi_id: string;
      snapshot_date: string;
      actual_value: number | null;
      percent_to_goal: number | null;
      status: string;
      data_source: string | null;
      raw_data: Record<string, unknown>;
      created_at: string;
      updated_at: string;
    };
    const snapshotMap = new Map<string, SnapshotRecord>();
    (snapshots as SnapshotRecord[] | null)?.forEach((s) => snapshotMap.set(s.kpi_id, s));

    // Build target lookup (most recent for each KPI)
    const targetMap = new Map<string, number>();
    targets?.forEach((t) => {
      if (!targetMap.has(t.kpi_id)) {
        targetMap.set(t.kpi_id, t.target_value);
      }
    });

    // Build notes lookup
    const notesMap = new Map<string, string>();
    notes?.forEach((n) => notesMap.set(n.kpi_id, n.note_text || ''));

    // Fetch pacing data: monthly targets, business days, holidays
    const selectedDate = new Date(date + 'T00:00:00');
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1; // 1-indexed

    // Get monthly target for this month - use TOTAL row for company-wide target
    const { data: monthlyTarget } = await supabase
      .from('dash_monthly_targets')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .eq('department', 'TOTAL')
      .eq('target_type', 'revenue')
      .single();

    // Get business days for this month (column is 'total_days', not 'business_days')
    const { data: businessDaysData } = await supabase
      .from('dash_business_days')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .single();

    // Get holidays for this year
    const { data: holidaysData } = await supabase
      .from('dash_holidays')
      .select('date')
      .eq('year', year);

    const holidays = holidaysData?.map(h => h.date) || [];
    const businessDaysInMonth = businessDaysData?.total_days || 22;
    const monthlyTargetValue = monthlyTarget?.target_value || 855000; // Default to Jan TOTAL target

    // Calculate daily target
    const dailyTarget = businessDaysInMonth > 0 ? monthlyTargetValue / businessDaysInMonth : 0;

    // Calculate weekly target based on business days in week
    const totalWeekBusinessDays = getTotalBusinessDaysInWeek(selectedDate, holidays);
    const weeklyTarget = dailyTarget * totalWeekBusinessDays;

    // Get MTD revenue (sum of total-revenue for the month)
    // Using total-revenue to match ServiceTitan's "Total Revenue" = Completed + Non-Job + Adj
    const firstOfMonth = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const { data: mtdSnapshots } = await supabase
      .from('huddle_snapshots')
      .select('actual_value, huddle_kpis!inner(slug)')
      .gte('snapshot_date', firstOfMonth)
      .lte('snapshot_date', date)
      .eq('huddle_kpis.slug', 'total-revenue');

    const mtdRevenue = mtdSnapshots?.reduce((sum, s) => {
      const snap = s as unknown as { actual_value: number };
      return sum + (Number(snap.actual_value) || 0);
    }, 0) || 0;

    // Get week-to-date revenue (Monday to selected date)
    const dayOfWeek = selectedDate.getDay();
    const monday = new Date(selectedDate);
    monday.setDate(selectedDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const mondayStr = monday.toISOString().split('T')[0];

    const { data: wtdSnapshots } = await supabase
      .from('huddle_snapshots')
      .select('actual_value, huddle_kpis!inner(slug)')
      .gte('snapshot_date', mondayStr)
      .lte('snapshot_date', date)
      .eq('huddle_kpis.slug', 'total-revenue');

    const wtdRevenue = wtdSnapshots?.reduce((sum, s) => {
      const snap = s as unknown as { actual_value: number };
      return sum + (Number(snap.actual_value) || 0);
    }, 0) || 0;

    // Calculate quarterly data
    const quarter = Math.floor((month - 1) / 3) + 1;
    const quarterStartMonth = (quarter - 1) * 3 + 1;
    const quarterEndMonth = quarter * 3;
    const quarterStartDate = new Date(year, quarterStartMonth - 1, 1).toISOString().split('T')[0];

    // Get quarterly target (sum of 3 months)
    const { data: quarterlyTargets } = await supabase
      .from('dash_monthly_targets')
      .select('target_value')
      .eq('year', year)
      .gte('month', quarterStartMonth)
      .lte('month', quarterEndMonth)
      .eq('department', 'TOTAL')
      .eq('target_type', 'revenue');

    const quarterlyTargetValue = quarterlyTargets?.reduce((sum, t) => sum + Number(t.target_value), 0) || 0;

    // Get QTD revenue
    const { data: qtdSnapshots } = await supabase
      .from('huddle_snapshots')
      .select('actual_value, huddle_kpis!inner(slug)')
      .gte('snapshot_date', quarterStartDate)
      .lte('snapshot_date', date)
      .eq('huddle_kpis.slug', 'total-revenue');

    const qtdRevenue = qtdSnapshots?.reduce((sum, s) => {
      const snap = s as unknown as { actual_value: number };
      return sum + (Number(snap.actual_value) || 0);
    }, 0) || 0;

    // Get YTD (year-to-date) revenue
    const yearStartDate = `${year}-01-01`;
    const { data: ytdSnapshots } = await supabase
      .from('huddle_snapshots')
      .select('actual_value, huddle_kpis!inner(slug)')
      .gte('snapshot_date', yearStartDate)
      .lte('snapshot_date', date)
      .eq('huddle_kpis.slug', 'total-revenue');

    const ytdRevenue = ytdSnapshots?.reduce((sum, s) => {
      const snap = s as unknown as { actual_value: number };
      return sum + (Number(snap.actual_value) || 0);
    }, 0) || 0;

    // Get annual target (sum of all 12 months)
    const { data: annualTargets } = await supabase
      .from('dash_monthly_targets')
      .select('target_value')
      .eq('year', year)
      .eq('department', 'TOTAL')
      .eq('target_type', 'revenue');

    const annualTargetValue = annualTargets?.reduce((sum, t) => sum + Number(t.target_value), 0) || 0;

    // Today's revenue from snapshot - use total-revenue to match ST's "Total Revenue"
    const totalRevenueKpi = kpis.find(k => k.slug === 'total-revenue');
    const todaySnapshot = snapshotMap.get(totalRevenueKpi?.id || '');
    const todayRevenue = Number(todaySnapshot?.actual_value) || 0;

    // Calculate pacing percentage
    const daysElapsedInMonth = getBusinessDaysElapsedInMonth(selectedDate, holidays);
    const expectedMTD = dailyTarget * daysElapsedInMonth;
    const pacingPercent = expectedMTD > 0 ? Math.round((mtdRevenue / expectedMTD) * 100) : 0;

    // Business days remaining in month
    const businessDaysRemaining = businessDaysInMonth - daysElapsedInMonth;

    // Pacing data object
    const pacingData = {
      todayRevenue,
      dailyTarget,
      wtdRevenue,
      weeklyTarget,
      mtdRevenue,
      monthlyTarget: monthlyTargetValue,
      qtdRevenue,
      quarterlyTarget: quarterlyTargetValue,
      quarter,
      ytdRevenue,
      annualTarget: annualTargetValue,
      pacingPercent,
      businessDaysRemaining,
      businessDaysElapsed: daysElapsedInMonth,
      businessDaysInMonth,
    };

    // Build response
    const departmentsWithKPIs: HuddleDepartmentWithKPIs[] = departments.map((dept) => {
      const deptKPIs = kpis
        .filter((kpi) => kpi.department_id === dept.id)
        .map((kpi): HuddleKPIWithData => {
          const snapshot = snapshotMap.get(kpi.id);
          const target = targetMap.get(kpi.id) || null;
          const actual = snapshot?.actual_value || null;
          const percentToGoal = snapshot?.percent_to_goal || null;
          const status = snapshot?.status as HuddleKPIStatus ||
            getStatusFromPercentage(percentToGoal, kpi.higher_is_better);
          const note = notesMap.get(kpi.id) || null;

          return {
            ...kpi,
            target,
            actual,
            percent_to_goal: percentToGoal,
            status,
            note,
          };
        });

      return {
        ...dept,
        kpis: deptKPIs,
      };
    });

    const response: HuddleDashboardResponse = {
      date,
      departments: departmentsWithKPIs,
      last_updated: new Date().toISOString(),
      pacing: pacingData,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching huddle data:', error);
    return NextResponse.json({ error: 'Failed to fetch huddle data' }, { status: 500 });
  }
}
