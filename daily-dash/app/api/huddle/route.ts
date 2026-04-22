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
  MonthlyTrendData,
} from '@/lib/supabase';
import { getStatusFromPercentage, getTodayDateString, getYesterdayDateString } from '@/lib/huddle-utils';
import { getServiceTitanClient, TradeName, HVACDepartment } from '@/lib/servicetitan';

// Helper to get business days in the current week up to the given date
// Saturday counts as 0.5 business day, Sunday counts as 0
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
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    if (!holidaySet.has(dateStr)) {
      // Monday-Friday = 1 full day each
      if (day >= 1 && day <= 5) {
        count++;
      }
      // Saturday = 0.5 day
      else if (day === 6) {
        count += 0.5;
      }
      // Sunday = 0
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

// Helper to get total business days in the current week
// Mon-Fri = 1 day each, Saturday = 0.5, Sunday = 0 (total: 5.5 max)
function getTotalBusinessDaysInWeek(date: Date, holidays: string[]): number {
  const holidaySet = new Set(holidays);
  const dayOfWeek = date.getDay();
  // Get Monday of this week
  const monday = new Date(date);
  monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  let count = 0;
  const current = new Date(monday);

  // Count all business days Mon-Sat (Mon-Fri = 1 each, Sat = 0.5)
  for (let i = 0; i < 6; i++) {
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    const currentDay = current.getDay();
    if (!holidaySet.has(dateStr)) {
      if (currentDay >= 1 && currentDay <= 5) {
        count++; // Mon-Fri = 1 day
      } else if (currentDay === 6) {
        count += 0.5; // Saturday = 0.5 day
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

// Helper to get COMPLETED business days in month (excludes today since the day isn't over)
// Saturday counts as 0.5 business day, Sunday counts as 0
function getBusinessDaysElapsedInMonth(date: Date, holidays: string[]): number {
  const holidaySet = new Set(holidays);
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);

  let count = 0;
  const current = new Date(firstOfMonth);

  while (current < date) { // strictly less than: excludes today
    const day = current.getDay();
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    if (!holidaySet.has(dateStr)) {
      if (day >= 1 && day <= 5) {
        count++;
      } else if (day === 6) {
        count += 0.5;
      }
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
    const endDateParam = searchParams.get('endDate');
    const date = dateParam || getTodayDateString();
    const endDate = endDateParam || date;
    const isRange = endDate !== date;

    // BATCH 1: Core huddle data - run in parallel
    // For ranges, fetch all snapshots/notes in the range (will aggregate below)
    const [deptResult, kpiResult, snapshotResult, targetResult, notesResult] = await Promise.all([
      supabase.from('huddle_departments').select('*').eq('is_active', true).order('display_order'),
      supabase.from('huddle_kpis').select('*').eq('is_active', true).order('display_order'),
      isRange
        ? supabase.from('huddle_snapshots').select('*').gte('snapshot_date', date).lte('snapshot_date', endDate)
        : supabase.from('huddle_snapshots').select('*').eq('snapshot_date', date),
      supabase.from('huddle_targets').select('*').eq('target_type', 'daily').lte('effective_date', endDate).order('effective_date', { ascending: false }),
      isRange
        ? supabase.from('huddle_notes').select('*').gte('note_date', date).lte('note_date', endDate)
        : supabase.from('huddle_notes').select('*').eq('note_date', date),
    ]);

    const { data: departments, error: deptError } = deptResult;
    const { data: kpis, error: kpiError } = kpiResult;
    const { data: snapshots, error: snapError } = snapshotResult;
    const { data: targets, error: targetError } = targetResult;
    const { data: notes, error: notesError } = notesResult;

    if (deptError) {
      console.error('Error fetching departments:', deptError);
      return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
    }

    if (kpiError) {
      console.error('Error fetching KPIs:', kpiError);
      return NextResponse.json({ error: 'Failed to fetch KPIs' }, { status: 500 });
    }

    if (snapError) console.error('Error fetching snapshots:', snapError);
    if (targetError) console.error('Error fetching targets:', targetError);
    if (notesError) console.error('Error fetching notes:', notesError);

    // Build snapshot lookup. For ranges, aggregate by KPI format:
    //   - currency/number (count): sum
    //   - percent/time: weighted or simple average
    //   - boolean/text: take latest
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

    // Count days in the range for target scaling
    const daysInRange = isRange
      ? Math.round((new Date(endDate + 'T12:00:00').getTime() - new Date(date + 'T12:00:00').getTime()) / 86400000) + 1
      : 1;

    // Map KPI format by id
    const kpiFormatMap = new Map<string, string>();
    kpis?.forEach((k) => kpiFormatMap.set(k.id, k.format || 'number'));

    const snapshotMap = new Map<string, SnapshotRecord>();
    if (isRange) {
      // Aggregate per-KPI across the range
      const perKpi = new Map<string, SnapshotRecord[]>();
      (snapshots as SnapshotRecord[] | null)?.forEach((s) => {
        const list = perKpi.get(s.kpi_id) || [];
        list.push(s);
        perKpi.set(s.kpi_id, list);
      });
      for (const [kpiId, list] of perKpi) {
        const format = kpiFormatMap.get(kpiId) || 'number';
        const sorted = [...list].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
        const latest = sorted[sorted.length - 1];
        let agg: number | null = null;
        const valid = list.map(s => Number(s.actual_value)).filter(v => !isNaN(v) && v !== null);
        if (valid.length > 0) {
          if (format === 'percent' || format === 'time') {
            agg = valid.reduce((sum, v) => sum + v, 0) / valid.length;
          } else {
            // currency, number, count -> sum
            agg = valid.reduce((sum, v) => sum + v, 0);
          }
        }
        snapshotMap.set(kpiId, { ...latest, actual_value: agg });
      }
    } else {
      (snapshots as SnapshotRecord[] | null)?.forEach((s) => snapshotMap.set(s.kpi_id, s));
    }


    // Build target lookup (most recent for each KPI). Scale by days in range for sum-type KPIs.
    const targetMap = new Map<string, number>();
    targets?.forEach((t) => {
      if (!targetMap.has(t.kpi_id)) {
        const format = kpiFormatMap.get(t.kpi_id) || 'number';
        const scale = isRange && format !== 'percent' && format !== 'time' ? daysInRange : 1;
        targetMap.set(t.kpi_id, t.target_value * scale);
      }
    });

    // Auto-fill revenue KPI targets from dash_monthly_targets (synced from admin Google Sheet).
    // This keeps huddle targets in sync with the source of truth without manual seeding.
    const selDate = new Date(endDate + 'T00:00:00');
    const selYear = selDate.getFullYear();
    const selMonth = selDate.getMonth() + 1;
    const [monthlyTargetsAll, bizDaysRow] = await Promise.all([
      supabase.from('dash_monthly_targets').select('department, target_value, daily_target_value')
        .eq('year', selYear).eq('month', selMonth).eq('target_type', 'revenue'),
      supabase.from('dash_business_days').select('total_days').eq('year', selYear).eq('month', selMonth).single(),
    ]);
    const bizDays = Number(bizDaysRow.data?.total_days || 22);
    const deptDailyByName: Record<string, number> = {};
    monthlyTargetsAll.data?.forEach((t) => {
      deptDailyByName[t.department] = Number(t.daily_target_value) || (Number(t.target_value) / bizDays);
    });

    // Map KPI slug -> derived daily target from admin data
    const kpiSlugToId = new Map<string, string>();
    kpis?.forEach(k => kpiSlugToId.set(k.slug, k.id));
    const revenueTargetBySlug: Record<string, number | undefined> = {
      'total-revenue': deptDailyByName['TOTAL'],
      'revenue-completed': deptDailyByName['TOTAL'],
      'install-revenue': deptDailyByName['HVAC Install'],
      'plumbing-revenue': deptDailyByName['Plumbing'],
    };
    for (const [slug, daily] of Object.entries(revenueTargetBySlug)) {
      const id = kpiSlugToId.get(slug);
      if (!id || !daily || targetMap.has(id)) continue;
      const format = kpiFormatMap.get(id) || 'currency';
      const scale = isRange && format !== 'percent' && format !== 'time' ? daysInRange : 1;
      targetMap.set(id, daily * scale);
    }

    // Build notes lookup. For ranges, concatenate notes from each day.
    const notesMap = new Map<string, string>();
    if (isRange) {
      const perKpi = new Map<string, { note_date: string; note_text: string }[]>();
      notes?.forEach((n) => {
        if (!n.note_text) return;
        const list = perKpi.get(n.kpi_id) || [];
        list.push({ note_date: n.note_date, note_text: n.note_text });
        perKpi.set(n.kpi_id, list);
      });
      for (const [kpiId, list] of perKpi) {
        const sorted = list.sort((a, b) => a.note_date.localeCompare(b.note_date));
        notesMap.set(kpiId, sorted.map(n => `${n.note_date}: ${n.note_text}`).join(' | '));
      }
    } else {
      notes?.forEach((n) => notesMap.set(n.kpi_id, n.note_text || ''));
    }

    // Fetch pacing data: monthly targets, business days, holidays
    // For range queries, use endDate as the reference for WTD/MTD calculations
    const selectedDate = new Date(endDate + 'T00:00:00');
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

    // Get department-specific targets for trade sections
    const { data: departmentTargets } = await supabase
      .from('dash_monthly_targets')
      .select('department, target_value, daily_target_value')
      .eq('year', year)
      .eq('month', month)
      .eq('target_type', 'revenue')
      .in('department', ['HVAC Install', 'HVAC Service', 'HVAC Maintenance', 'Plumbing']);

    // Build department targets lookup
    const deptTargets: Record<string, { monthly: number; daily: number }> = {};
    departmentTargets?.forEach((t) => {
      deptTargets[t.department] = {
        monthly: Number(t.target_value) || 0,
        daily: Number(t.daily_target_value) || 0,
      };
    });

    // Calculate HVAC combined targets (Install + Service + Maintenance)
    const hvacMonthlyTarget =
      (deptTargets['HVAC Install']?.monthly || 0) +
      (deptTargets['HVAC Service']?.monthly || 0) +
      (deptTargets['HVAC Maintenance']?.monthly || 0);
    const hvacDailyTarget =
      (deptTargets['HVAC Install']?.daily || 0) +
      (deptTargets['HVAC Service']?.daily || 0) +
      (deptTargets['HVAC Maintenance']?.daily || 0);

    const plumbingMonthlyTarget = deptTargets['Plumbing']?.monthly || 0;
    const plumbingDailyTarget = deptTargets['Plumbing']?.daily || 0;

    // Calculate date ranges for batch queries
    const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    const dayOfWeek = selectedDate.getDay();
    const monday = new Date(selectedDate);
    monday.setDate(selectedDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    const quarter = Math.floor((month - 1) / 3) + 1;
    const quarterStartMonth = (quarter - 1) * 3 + 1;
    const quarterEndMonth = quarter * 3;
    const quarterStartDate = `${year}-${String(quarterStartMonth).padStart(2, '0')}-01`;
    const yearStartDate = `${year}-01-01`;

    // BATCH 2: Business days, holidays, revenue/sales snapshots, and targets - run in parallel
    const [
      businessDaysResult, holidaysResult,
      mtdRevenueResult, mtdSalesResult,
      wtdRevenueResult, wtdSalesResult,
      qtdRevenueResult, qtdSalesResult,
      ytdRevenueResult, annualTargetsResult, quarterlyTargetsResult,
    ] = await Promise.all([
      supabase.from('dash_business_days').select('*').eq('year', year).eq('month', month).single(),
      supabase.from('dash_holidays').select('date').eq('year', year),
      supabase.from('huddle_snapshots').select('actual_value, huddle_kpis!inner(slug)').gte('snapshot_date', firstOfMonth).lte('snapshot_date', endDate).eq('huddle_kpis.slug', 'total-revenue'),
      supabase.from('huddle_snapshots').select('actual_value, huddle_kpis!inner(slug)').gte('snapshot_date', firstOfMonth).lte('snapshot_date', endDate).eq('huddle_kpis.slug', 'total-sales'),
      supabase.from('huddle_snapshots').select('actual_value, huddle_kpis!inner(slug)').gte('snapshot_date', mondayStr).lte('snapshot_date', endDate).eq('huddle_kpis.slug', 'total-revenue'),
      supabase.from('huddle_snapshots').select('actual_value, huddle_kpis!inner(slug)').gte('snapshot_date', mondayStr).lte('snapshot_date', endDate).eq('huddle_kpis.slug', 'total-sales'),
      supabase.from('huddle_snapshots').select('actual_value, huddle_kpis!inner(slug)').gte('snapshot_date', quarterStartDate).lte('snapshot_date', endDate).eq('huddle_kpis.slug', 'total-revenue'),
      supabase.from('huddle_snapshots').select('actual_value, huddle_kpis!inner(slug)').gte('snapshot_date', quarterStartDate).lte('snapshot_date', endDate).eq('huddle_kpis.slug', 'total-sales'),
      supabase.from('huddle_snapshots').select('actual_value, huddle_kpis!inner(slug)').gte('snapshot_date', yearStartDate).lte('snapshot_date', endDate).eq('huddle_kpis.slug', 'total-revenue'),
      supabase.from('dash_monthly_targets').select('target_value, month').eq('year', year).eq('department', 'TOTAL').eq('target_type', 'revenue').order('month'),
      supabase.from('dash_monthly_targets').select('target_value').eq('year', year).gte('month', quarterStartMonth).lte('month', quarterEndMonth).eq('department', 'TOTAL').eq('target_type', 'revenue'),
    ]);

    // Unpack batch results
    const businessDaysData = businessDaysResult.data;
    const holidaysData = holidaysResult.data;
    const holidays = holidaysData?.map(h => h.date) || [];
    const businessDaysInMonth = businessDaysData?.total_days || 22;
    const monthlyTargetValue = monthlyTarget?.target_value || 855000;

    // Calculate daily/weekly targets
    const dailyTarget = businessDaysInMonth > 0 ? monthlyTargetValue / businessDaysInMonth : 0;
    const totalWeekBusinessDays = getTotalBusinessDaysInWeek(selectedDate, holidays);
    const weeklyTarget = dailyTarget * totalWeekBusinessDays;

    // Calculate today's target based on day of week (dayOfWeek already declared above)
    // Sunday = $0, Saturday = 50% of daily, Mon-Fri = 100% of daily
    const todayTarget = dayOfWeek === 0 ? 0 : dayOfWeek === 6 ? dailyTarget * 0.5 : dailyTarget;

    // Helper to sum snapshot values
    const sumSnapshots = (data: unknown): number => {
      if (!data || !Array.isArray(data)) return 0;
      return data.reduce((sum, s) => sum + (Number((s as { actual_value: number }).actual_value) || 0), 0);
    };

    const mtdRevenue = sumSnapshots(mtdRevenueResult.data);
    const mtdSales = sumSnapshots(mtdSalesResult.data);
    const wtdRevenue = sumSnapshots(wtdRevenueResult.data);
    const wtdSales = sumSnapshots(wtdSalesResult.data);
    const qtdRevenue = sumSnapshots(qtdRevenueResult.data);
    const qtdSales = sumSnapshots(qtdSalesResult.data);
    const ytdRevenue = sumSnapshots(ytdRevenueResult.data);

    const annualTargets = annualTargetsResult.data;
    const quarterlyTargetValue = quarterlyTargetsResult.data?.reduce((sum, t) => sum + Number(t.target_value), 0) || 0;
    const annualTargetValue = annualTargets?.reduce((sum, t) => sum + Number(t.target_value), 0) || 0;

    // Today's revenue from snapshot - use total-revenue to match ST's "Total Revenue"
    // Note: actual_value is stored as numeric in Postgres, which Supabase returns as string
    // Today's revenue from snapshot
    const totalRevenueKpi = kpis?.find(k => k.slug === 'total-revenue');
    const todaySnapshot = totalRevenueKpi ? snapshotMap.get(totalRevenueKpi.id) : undefined;
    const todayRevenue = todaySnapshot?.actual_value
      ? parseFloat(String(todaySnapshot.actual_value))
      : 0;

    // Today's sales from snapshot
    const totalSalesKpi = kpis?.find(k => k.slug === 'total-sales');
    const todaySalesSnapshot = totalSalesKpi ? snapshotMap.get(totalSalesKpi.id) : undefined;
    const todaySales = todaySalesSnapshot?.actual_value
      ? parseFloat(String(todaySalesSnapshot.actual_value))
      : 0;

    // Calculate pacing percentage
    const daysElapsedInMonth = getBusinessDaysElapsedInMonth(selectedDate, holidays);
    const expectedMTD = dailyTarget * daysElapsedInMonth;
    const pacingPercent = expectedMTD > 0 ? Math.round((mtdRevenue / expectedMTD) * 100) : 0;

    // Calculate expected YTD percentage based on seasonal monthly weights
    // Sum of completed months + prorated current month
    let priorMonthsTargetSum = 0;
    let currentMonthTargetForPacing = monthlyTargetValue;

    if (annualTargets && annualTargets.length > 0) {
      // Sum targets for all completed months (before current month)
      for (const t of annualTargets) {
        if (t.month < month) {
          priorMonthsTargetSum += Number(t.target_value);
        } else if (t.month === month) {
          currentMonthTargetForPacing = Number(t.target_value);
        }
      }
    }

    // Calculate month progress (business days elapsed / total business days)
    const monthProgressForAnnual = businessDaysInMonth > 0 ? daysElapsedInMonth / businessDaysInMonth : 0;

    // Expected YTD = prior months (100%) + current month (prorated)
    const expectedYtdTarget = priorMonthsTargetSum + (currentMonthTargetForPacing * monthProgressForAnnual);
    const expectedAnnualPacingPercent = annualTargetValue > 0
      ? Math.round((expectedYtdTarget / annualTargetValue) * 10000) / 100
      : 0;

    // Business days remaining in month (always relative to today, not selected date)
    // Use Central Time for "today" to avoid UTC date shift after 6/7pm CT
    const nowCT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const todayStr = `${nowCT.getFullYear()}-${String(nowCT.getMonth() + 1).padStart(2, '0')}-${String(nowCT.getDate()).padStart(2, '0')}`;
    const todayForRemaining = new Date(todayStr + 'T00:00:00');
    const daysElapsedToday = getBusinessDaysElapsedInMonth(todayForRemaining, holidays);
    const businessDaysRemaining = businessDaysInMonth - daysElapsedToday;

    // Fetch trade-level metrics from ServiceTitan
    const stClient = getServiceTitanClient();

    // Calculate targets for different time periods
    const hvacWeeklyTarget = hvacDailyTarget * totalWeekBusinessDays;
    const plumbingWeeklyTarget = plumbingDailyTarget * totalWeekBusinessDays;

    // BATCH 3: Trade targets - quarterly and annual for HVAC and Plumbing (with per-department breakdown)
    const [hvacQtrResult, plumbingQtrResult, hvacAnnualResult, plumbingAnnualResult] = await Promise.all([
      supabase.from('dash_monthly_targets').select('target_value, department').eq('year', year).gte('month', quarterStartMonth).lte('month', quarterEndMonth).eq('target_type', 'revenue').in('department', ['HVAC Install', 'HVAC Service', 'HVAC Maintenance']),
      supabase.from('dash_monthly_targets').select('target_value').eq('year', year).gte('month', quarterStartMonth).lte('month', quarterEndMonth).eq('target_type', 'revenue').eq('department', 'Plumbing'),
      supabase.from('dash_monthly_targets').select('target_value, department').eq('year', year).eq('target_type', 'revenue').in('department', ['HVAC Install', 'HVAC Service', 'HVAC Maintenance']),
      supabase.from('dash_monthly_targets').select('target_value').eq('year', year).eq('target_type', 'revenue').eq('department', 'Plumbing'),
    ]);

    const hvacQuarterlyTarget = hvacQtrResult.data?.reduce((sum, t) => sum + Number(t.target_value), 0) || 0;
    const plumbingQuarterlyTarget = plumbingQtrResult.data?.reduce((sum, t) => sum + Number(t.target_value), 0) || 0;
    const hvacAnnualTarget = hvacAnnualResult.data?.reduce((sum, t) => sum + Number(t.target_value), 0) || 0;
    const plumbingAnnualTarget = plumbingAnnualResult.data?.reduce((sum, t) => sum + Number(t.target_value), 0) || 0;

    // Per-department annual targets (sum of 12 months for each department)
    const hvacInstallAnnualTarget = hvacAnnualResult.data?.filter(t => t.department === 'HVAC Install').reduce((sum, t) => sum + Number(t.target_value), 0) || 0;
    const hvacServiceAnnualTarget = hvacAnnualResult.data?.filter(t => t.department === 'HVAC Service').reduce((sum, t) => sum + Number(t.target_value), 0) || 0;
    const hvacMaintenanceAnnualTarget = hvacAnnualResult.data?.filter(t => t.department === 'HVAC Maintenance').reduce((sum, t) => sum + Number(t.target_value), 0) || 0;

    // Type for department revenue breakdown
    interface DeptRevenue {
      revenue: number;
      completedRevenue: number;
      nonJobRevenue: number;
      adjRevenue: number;
      sales: number;
    }

    const zeroDeptRevenue: DeptRevenue = { revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0, sales: 0 };

    // Per-department daily/weekly targets
    const installDaily = deptTargets['HVAC Install']?.daily || 0;
    const serviceDaily = deptTargets['HVAC Service']?.daily || 0;
    const maintenanceDaily = deptTargets['HVAC Maintenance']?.daily || 0;
    const installWeekly = installDaily * totalWeekBusinessDays;
    const serviceWeekly = serviceDaily * totalWeekBusinessDays;
    const maintenanceWeekly = maintenanceDaily * totalWeekBusinessDays;

    let tradeData = {
      hvac: {
        today: {
          revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0, sales: 0,
          departments: { install: { ...zeroDeptRevenue }, service: { ...zeroDeptRevenue }, maintenance: { ...zeroDeptRevenue } },
        },
        wtd: {
          revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0, sales: 0,
          departments: { install: { ...zeroDeptRevenue }, service: { ...zeroDeptRevenue }, maintenance: { ...zeroDeptRevenue } },
        },
        mtd: {
          revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0, sales: 0,
          departments: { install: { ...zeroDeptRevenue }, service: { ...zeroDeptRevenue }, maintenance: { ...zeroDeptRevenue } },
        },
        qtd: {
          revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0, sales: 0,
          departments: { install: { ...zeroDeptRevenue }, service: { ...zeroDeptRevenue }, maintenance: { ...zeroDeptRevenue } },
        },
        ytd: {
          revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0, sales: 0,
          departments: { install: { ...zeroDeptRevenue }, service: { ...zeroDeptRevenue }, maintenance: { ...zeroDeptRevenue } },
        },
        targets: {
          daily: hvacDailyTarget,
          weekly: hvacWeeklyTarget,
          monthly: hvacMonthlyTarget,
          quarterly: hvacQuarterlyTarget,
          annual: hvacAnnualTarget,
          departments: {
            install: { monthly: deptTargets['HVAC Install']?.monthly || 0, daily: installDaily, weekly: installWeekly },
            service: { monthly: deptTargets['HVAC Service']?.monthly || 0, daily: serviceDaily, weekly: serviceWeekly },
            maintenance: { monthly: deptTargets['HVAC Maintenance']?.monthly || 0, daily: maintenanceDaily, weekly: maintenanceWeekly },
          },
        },
      },
      plumbing: {
        today: { revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0, sales: 0 },
        wtd: { revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0, sales: 0 },
        mtd: { revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0, sales: 0 },
        qtd: { revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0, sales: 0 },
        ytd: { revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0, sales: 0 },
        targets: {
          daily: plumbingDailyTarget,
          weekly: plumbingWeeklyTarget,
          monthly: plumbingMonthlyTarget,
          quarterly: plumbingQuarterlyTarget,
          annual: plumbingAnnualTarget,
        },
      },
    };

    // Helper to add two trade metric objects together (for combining snapshot totals + today's live data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function addTradeMetrics(base: any, add: any): any {
      const result = {
        revenue: (base.revenue || 0) + (add.revenue || 0),
        completedRevenue: (base.completedRevenue || 0) + (add.completedRevenue || 0),
        nonJobRevenue: (base.nonJobRevenue || 0) + (add.nonJobRevenue || 0),
        adjRevenue: (base.adjRevenue || 0) + (add.adjRevenue || 0),
        sales: (base.sales || 0) + (add.sales || 0),
      } as any;
      if (base.departments || add.departments) {
        const baseDepts = base.departments || {};
        const addDepts = add.departments || {};
        result.departments = {
          install: {
            revenue: (baseDepts.install?.revenue || 0) + (addDepts.install?.revenue || 0),
            completedRevenue: (baseDepts.install?.completedRevenue || 0) + (addDepts.install?.completedRevenue || 0),
            nonJobRevenue: (baseDepts.install?.nonJobRevenue || 0) + (addDepts.install?.nonJobRevenue || 0),
            adjRevenue: (baseDepts.install?.adjRevenue || 0) + (addDepts.install?.adjRevenue || 0),
            sales: (baseDepts.install?.sales || 0) + (addDepts.install?.sales || 0),
          },
          service: {
            revenue: (baseDepts.service?.revenue || 0) + (addDepts.service?.revenue || 0),
            completedRevenue: (baseDepts.service?.completedRevenue || 0) + (addDepts.service?.completedRevenue || 0),
            nonJobRevenue: (baseDepts.service?.nonJobRevenue || 0) + (addDepts.service?.nonJobRevenue || 0),
            adjRevenue: (baseDepts.service?.adjRevenue || 0) + (addDepts.service?.adjRevenue || 0),
            sales: (baseDepts.service?.sales || 0) + (addDepts.service?.sales || 0),
          },
          maintenance: {
            revenue: (baseDepts.maintenance?.revenue || 0) + (addDepts.maintenance?.revenue || 0),
            completedRevenue: (baseDepts.maintenance?.completedRevenue || 0) + (addDepts.maintenance?.completedRevenue || 0),
            nonJobRevenue: (baseDepts.maintenance?.nonJobRevenue || 0) + (addDepts.maintenance?.nonJobRevenue || 0),
            adjRevenue: (baseDepts.maintenance?.adjRevenue || 0) + (addDepts.maintenance?.adjRevenue || 0),
            sales: (baseDepts.maintenance?.sales || 0) + (addDepts.maintenance?.sales || 0),
          },
        };
      }
      return result;
    }

    // Helper to aggregate trade snapshots from Supabase
    interface TradeSnapshot {
      snapshot_date: string;
      trade: string;
      department: string | null;
      revenue: number;
      completed_revenue: number;
      non_job_revenue: number;
      adj_revenue: number;
      sales: number;
    }

    function aggregateTradeSnapshots(snapshots: TradeSnapshot[]) {
      const result = {
        revenue: 0,
        completedRevenue: 0,
        nonJobRevenue: 0,
        adjRevenue: 0,
        sales: 0,
        departments: {
          install: { ...zeroDeptRevenue },
          service: { ...zeroDeptRevenue },
          maintenance: { ...zeroDeptRevenue },
          sales: { ...zeroDeptRevenue },
        },
      };

      for (const snap of snapshots) {
        if (snap.department === null) {
          result.revenue += Number(snap.revenue) || 0;
          result.completedRevenue += Number(snap.completed_revenue) || 0;
          result.nonJobRevenue += Number(snap.non_job_revenue) || 0;
          result.adjRevenue += Number(snap.adj_revenue) || 0;
          result.sales += Number(snap.sales) || 0;
        } else if (snap.department === 'install') {
          result.departments.install.revenue += Number(snap.revenue) || 0;
          result.departments.install.completedRevenue += Number(snap.completed_revenue) || 0;
          result.departments.install.nonJobRevenue += Number(snap.non_job_revenue) || 0;
          result.departments.install.adjRevenue += Number(snap.adj_revenue) || 0;
          result.departments.install.sales += Number(snap.sales) || 0;
        } else if (snap.department === 'service') {
          result.departments.service.revenue += Number(snap.revenue) || 0;
          result.departments.service.completedRevenue += Number(snap.completed_revenue) || 0;
          result.departments.service.nonJobRevenue += Number(snap.non_job_revenue) || 0;
          result.departments.service.adjRevenue += Number(snap.adj_revenue) || 0;
          result.departments.service.sales += Number(snap.sales) || 0;
        } else if (snap.department === 'maintenance') {
          result.departments.maintenance.revenue += Number(snap.revenue) || 0;
          result.departments.maintenance.completedRevenue += Number(snap.completed_revenue) || 0;
          result.departments.maintenance.nonJobRevenue += Number(snap.non_job_revenue) || 0;
          result.departments.maintenance.adjRevenue += Number(snap.adj_revenue) || 0;
          result.departments.maintenance.sales += Number(snap.sales) || 0;
        } else if (snap.department === 'sales') {
          result.departments.sales.revenue += Number(snap.revenue) || 0;
          result.departments.sales.completedRevenue += Number(snap.completed_revenue) || 0;
          result.departments.sales.nonJobRevenue += Number(snap.non_job_revenue) || 0;
          result.departments.sales.adjRevenue += Number(snap.adj_revenue) || 0;
          result.departments.sales.sales += Number(snap.sales) || 0;
        }
      }

      return result;
    }

    // ALL data from Supabase — zero ST API calls on page load.
    // Today's data is kept fresh by a 10-min cron that syncs to trade_daily_snapshots.
    // The Sync button triggers /api/trades/sync for manual refresh.

    let allSnapsData: TradeSnapshot[] | null = null;
    try {
      // Single query: all snapshots from start of year to today (includes today's cached data)
      const { data: allSnaps } = await supabase
        .from('trade_daily_snapshots')
        .select('snapshot_date, trade, department, revenue, completed_revenue, non_job_revenue, adj_revenue, sales')
        .gte('snapshot_date', yearStartDate)
        .lte('snapshot_date', date)
        .order('snapshot_date');

      if (allSnaps && allSnaps.length > 0) {
        allSnapsData = allSnaps as TradeSnapshot[];
        const typedSnaps = allSnapsData;

        // Helper to sum snapshots for a date range
        const sumRange = (startD: string, endD: string) => {
          const rangeSnaps = typedSnaps.filter(s => s.snapshot_date >= startD && s.snapshot_date <= endD);
          const hvacSnaps = rangeSnaps.filter(s => s.trade === 'hvac');
          const plumbingSnaps = rangeSnaps.filter(s => s.trade === 'plumbing');
          return {
            hvac: aggregateTradeSnapshots(hvacSnaps),
            plumbing: aggregateTradeSnapshots(plumbingSnaps),
          };
        };

        // Today
        const todayData = sumRange(date, date);
        tradeData.hvac.today = todayData.hvac;
        tradeData.plumbing.today = todayData.plumbing;

        // WTD (Monday to date)
        if (mondayStr <= date) {
          const wtd = sumRange(mondayStr, date);
          tradeData.hvac.wtd = wtd.hvac;
          tradeData.plumbing.wtd = wtd.plumbing;
        }

        // MTD (1st of month to date)
        if (firstOfMonth <= date) {
          const mtd = sumRange(firstOfMonth, date);
          tradeData.hvac.mtd = mtd.hvac;
          tradeData.plumbing.mtd = mtd.plumbing;
        }

        // QTD (quarter start to date)
        if (quarterStartDate <= date) {
          const qtd = sumRange(quarterStartDate, date);
          tradeData.hvac.qtd = qtd.hvac;
          tradeData.plumbing.qtd = qtd.plumbing;
        }

        // YTD (Jan 1 to date)
        const ytd = sumRange(yearStartDate, date);
        tradeData.hvac.ytd = ytd.hvac;
        tradeData.plumbing.ytd = ytd.plumbing;
      }
    } catch (snapError) {
      console.error('Error fetching trade snapshots:', snapError);
    }

    // Helper to get yesterday's date string (Central Time)
    function getYesterdayStr(): string {
      return getYesterdayDateString();
    }

    // Fetch 18-month trend data for the stacked bar chart
    const monthlyTrend: MonthlyTrendData[] = [];

    // Calculate 18 months ago from current date
    const trendStartDate = new Date(selectedDate);
    trendStartDate.setMonth(trendStartDate.getMonth() - 17); // 18 months including current
    trendStartDate.setDate(1); // First of month

    // Get all monthly targets for the trend period
    const trendStartYear = trendStartDate.getFullYear();
    const trendEndYear = selectedDate.getFullYear();

    const { data: trendTargets } = await supabase
      .from('dash_monthly_targets')
      .select('year, month, target_value, department')
      .gte('year', trendStartYear)
      .lte('year', trendEndYear)
      .eq('target_type', 'revenue')
      .in('department', ['TOTAL', 'HVAC Install', 'HVAC Service', 'HVAC Maintenance', 'Plumbing']);

    // Build a map of monthly goals and targets by trade
    const monthlyGoals: Record<string, { total: number; hvac: number; plumbing: number }> = {};
    trendTargets?.forEach((t) => {
      const key = `${t.year}-${String(t.month).padStart(2, '0')}`;
      if (!monthlyGoals[key]) {
        monthlyGoals[key] = { total: 0, hvac: 0, plumbing: 0 };
      }
      if (t.department === 'TOTAL') {
        monthlyGoals[key].total = Number(t.target_value);
      } else if (t.department.startsWith('HVAC')) {
        monthlyGoals[key].hvac += Number(t.target_value);
      } else if (t.department === 'Plumbing') {
        monthlyGoals[key].plumbing = Number(t.target_value);
      }
    });

    // Generate all 18 months with unique labels (include year to avoid duplicates)
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const current = new Date(trendStartDate);

    while (current <= selectedDate) {
      const yr = current.getFullYear();
      const mo = current.getMonth();
      const monthKey = `${yr}-${String(mo + 1).padStart(2, '0')}`;
      // Include year abbreviation to make labels unique (e.g., "DEC '24", "DEC '25")
      const label = `${monthNames[mo]} '${String(yr).slice(-2)}`;
      const goal = monthlyGoals[monthKey]?.total || 0;

      monthlyTrend.push({
        month: monthKey,
        label,
        hvacRevenue: 0, // Will be populated from ServiceTitan
        plumbingRevenue: 0,
        totalRevenue: 0,
        goal,
      });

      current.setMonth(current.getMonth() + 1);
    }

    // Current month key
    const currentMonthKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;

    // For current month, use live ServiceTitan data (already fetched above as MTD)
    const currentMonthData = monthlyTrend.find(m => m.month === currentMonthKey);
    if (currentMonthData && tradeData) {
      currentMonthData.hvacRevenue = tradeData.hvac.mtd.revenue;
      currentMonthData.plumbingRevenue = tradeData.plumbing.mtd.revenue;
      currentMonthData.totalRevenue = tradeData.hvac.mtd.revenue + tradeData.plumbing.mtd.revenue;
    }

    // Fetch historical months from cached monthly snapshots (fast!)
    // This avoids expensive ServiceTitan API calls for each historical month
    const historicalMonthKeys = monthlyTrend
      .filter(m => m.month !== currentMonthKey)
      .map(m => m.month);

    if (historicalMonthKeys.length > 0) {
      const { data: monthlyCache } = await supabase
        .from('trade_monthly_snapshots')
        .select('year_month, trade, revenue')
        .in('year_month', historicalMonthKeys);

      // Build lookup map from cached data
      const cacheMap = new Map<string, { hvac: number; plumbing: number }>();
      monthlyCache?.forEach((row) => {
        const key = row.year_month;
        if (!cacheMap.has(key)) {
          cacheMap.set(key, { hvac: 0, plumbing: 0 });
        }
        const entry = cacheMap.get(key)!;
        if (row.trade === 'hvac') {
          entry.hvac = Number(row.revenue) || 0;
        } else if (row.trade === 'plumbing') {
          entry.plumbing = Number(row.revenue) || 0;
        }
      });

      // Populate monthlyTrend from cache
      for (const monthData of monthlyTrend) {
        if (monthData.month === currentMonthKey) continue; // Skip current month (already populated)
        const cached = cacheMap.get(monthData.month);
        if (cached) {
          monthData.hvacRevenue = cached.hvac;
          monthData.plumbingRevenue = cached.plumbing;
          monthData.totalRevenue = cached.hvac + cached.plumbing;
        }
        // If not in cache, leave as 0 (will be populated by next sync)
      }
    }

    // Use trade data totals for pacing cards (snapshots + today's live data)
    const liveTodayRevenue = tradeData.hvac.today.revenue + tradeData.plumbing.today.revenue;
    const liveTodaySales = tradeData.hvac.today.sales + tradeData.plumbing.today.sales;
    const liveWtdRevenue = tradeData.hvac.wtd.revenue + tradeData.plumbing.wtd.revenue;
    const liveWtdSales = tradeData.hvac.wtd.sales + tradeData.plumbing.wtd.sales;
    const liveMtdRevenue = tradeData.hvac.mtd.revenue + tradeData.plumbing.mtd.revenue;
    const liveMtdSales = tradeData.hvac.mtd.sales + tradeData.plumbing.mtd.sales;
    const liveQtdRevenue = tradeData.hvac.qtd.revenue + tradeData.plumbing.qtd.revenue;
    const liveQtdSales = tradeData.hvac.qtd.sales + tradeData.plumbing.qtd.sales;
    const liveYtdRevenue = tradeData.hvac.ytd.revenue + tradeData.plumbing.ytd.revenue;

    // Recalculate pacing with live MTD data
    const livePacingPercent = expectedMTD > 0 ? Math.round((liveMtdRevenue / expectedMTD) * 100) : 0;

    // --- Review data for huddle cards ---
    const REVIEW_TARGETS: Record<number, { monthly: number[] }> = {
      2026: { monthly: [68, 56, 76, 99, 137, 159, 159, 163, 96, 88, 75, 74] },
      2025: { monthly: [83, 83, 83, 83, 83, 83, 83, 83, 83, 83, 83, 87] },
    };
    const reviewMonthlyGoal = REVIEW_TARGETS[year]?.monthly[month - 1] || 0;

    // MTD review count and avg rating
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`;
    const monthEndReview = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}T23:59:59`;
    const [mtdReviewCount, mtdReviewRatings] = await Promise.all([
      supabase
        .from('google_reviews')
        .select('id', { count: 'exact', head: true })
        .gte('create_time', monthStart)
        .lte('create_time', monthEndReview),
      supabase
        .from('google_reviews')
        .select('star_rating')
        .gte('create_time', monthStart)
        .lte('create_time', monthEndReview),
    ]);
    const reviewsMtdCount = mtdReviewCount.count || 0;
    const reviewsMtdRatings = mtdReviewRatings.data || [];
    const reviewsMtdAvgRating = reviewsMtdRatings.length > 0
      ? reviewsMtdRatings.reduce((sum, r) => sum + r.star_rating, 0) / reviewsMtdRatings.length
      : 0;

    // --- Replacement leads from ST Report 173574034 (operations category) ---
    const REPLACEMENT_LEAD_TARGETS: Record<number, { monthly: number[] }> = {
      2026: { monthly: [80, 60, 89, 120, 173, 203, 200, 206, 113, 99, 80, 80] },
    };
    const replacementLeadMonthlyGoal = REPLACEMENT_LEAD_TARGETS[year]?.monthly[month - 1] || 0;

    // --- Opportunity Job Average (Svc+Mnt+Plb, excludes HVAC Sales) ---
    const OPP_JOB_AVG_TARGETS: Record<number, { monthly: number[] }> = {
      2026: { monthly: [290, 334, 379, 400, 576, 514, 528, 574, 433, 459, 390, 397] },
    };
    const oppJobAvgTarget = OPP_JOB_AVG_TARGETS[year]?.monthly[month - 1] || 0;

    let oppJobAvgActual = 0;
    let replacementLeadsMtd = 0;
    let tglLeadsMtd = 0;
    let marketingLeadsMtd = 0;
    let hvacSalesCloseRate = 0;
    let hvacSalesAvgSale = 0;
    try {
      const firstOfMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastOfMonthStr = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

      // Lead count from Jobs API (matches sheet logic)
      const leads = await stClient.getReplacementLeads(firstOfMonthStr, lastOfMonthStr);
      tglLeadsMtd = leads.tgl;
      marketingLeadsMtd = leads.marketingLead;
      replacementLeadsMtd = leads.total;

      // Single operations report call for both opp job avg AND HVAC Sales close rate
      const reportData = await stClient.getOperationsReport(173574034, firstOfMonthStr, lastOfMonthStr);
      if (reportData.fields && reportData.data) {
        const fieldMap = new Map<string, number>();
        reportData.fields.forEach((f: { name: string }, i: number) => fieldMap.set(f.name, i));
        const buIdx = fieldMap.get('Name') ?? -1;
        const oppAvgIdx = fieldMap.get('OpportunityJobAverage') ?? -1;
        const oppIdx = fieldMap.get('Opportunity') ?? -1;
        const closeRateIdx = fieldMap.get('CloseRate') ?? -1;
        const avgSaleIdx = fieldMap.get('ClosedAverageSale') ?? fieldMap.get('ConvertedJobAverage') ?? -1;

        let weightedSum = 0;
        let totalOppJobs = 0;

        for (const row of reportData.data) {
          const buName = buIdx >= 0 ? String(row[buIdx]) : '';

          // HVAC Sales: extract close rate + avg sale
          if (buName === 'HVAC - Sales') {
            if (closeRateIdx >= 0) hvacSalesCloseRate = Number(row[closeRateIdx]) || 0;
            if (avgSaleIdx >= 0) hvacSalesAvgSale = Number(row[avgSaleIdx]) || 0;
          }

          // Opp Job Avg: all BUs except HVAC Sales and HVAC Install
          if (buName !== 'HVAC - Sales' && buName !== 'HVAC - Install') {
            const oppAvg = oppAvgIdx >= 0 ? Number(row[oppAvgIdx]) || 0 : 0;
            const oppJobs = oppIdx >= 0 ? Number(row[oppIdx]) || 0 : 0;
            weightedSum += oppAvg * oppJobs;
            totalOppJobs += oppJobs;
          }
        }

        oppJobAvgActual = totalOppJobs > 0 ? Math.round(weightedSum / totalOppJobs) : 0;
      }
    } catch (err) {
      console.error('Error fetching operations report data:', err);
    }

    // Pacing data object
    const pacingData = {
      todayRevenue: liveTodayRevenue,
      todaySales: liveTodaySales || todaySales,
      dailyTarget,      // Base daily target (for full business day)
      todayTarget,      // Adjusted for day of week (0 on Sunday, 50% on Saturday)
      wtdRevenue: liveWtdRevenue,
      wtdSales: liveWtdSales || wtdSales,
      weeklyTarget,
      weekBusinessDaysTotal: totalWeekBusinessDays,
      mtdRevenue: liveMtdRevenue,
      mtdSales: liveMtdSales || mtdSales,
      monthlyTarget: monthlyTargetValue,
      qtdRevenue: liveQtdRevenue,
      qtdSales: liveQtdSales || qtdSales,
      quarterlyTarget: quarterlyTargetValue,
      quarter,
      ytdRevenue: liveYtdRevenue,
      annualTarget: annualTargetValue,
      expectedAnnualPacingPercent, // Seasonal weighted expected YTD %
      pacingPercent: livePacingPercent,
      businessDaysRemaining,
      businessDaysElapsed: daysElapsedInMonth,
      businessDaysInMonth,
      // Department-specific monthly targets
      hvacInstallMonthlyTarget: deptTargets['HVAC Install']?.monthly || 0,
      hvacServiceMonthlyTarget: deptTargets['HVAC Service']?.monthly || 0,
      hvacMaintenanceMonthlyTarget: deptTargets['HVAC Maintenance']?.monthly || 0,
      plumbingMonthlyTarget: deptTargets['Plumbing']?.monthly || 0,
      // Department-specific annual targets (sum of all 12 months)
      hvacInstallAnnualTarget,
      hvacServiceAnnualTarget,
      hvacMaintenanceAnnualTarget,
      plumbingAnnualTarget,
      // Trade data
      trades: tradeData,
      // Monthly trend for chart
      monthlyTrend,
      // Reviews
      reviewsMtdCount,
      reviewsMtdAvgRating: Math.round(reviewsMtdAvgRating * 100) / 100,
      reviewMonthlyGoal,
      // Replacement leads
      replacementLeadsMtd,
      tglLeadsMtd,
      marketingLeadsMtd,
      replacementLeadMonthlyGoal,
      hvacSalesCloseRate: Math.round(hvacSalesCloseRate * 100) / 100,
      hvacSalesAvgSale: Math.round(hvacSalesAvgSale),
      oppJobAvgActual,
      oppJobAvgTarget,
    };

    // Build trade totals for the selected date from trade_daily_snapshots
    // These override the old huddle_snapshots values for Christmas (Overall) KPIs
    const tradeTodayTotals = {
      revenue: tradeData.hvac.today.revenue + tradeData.plumbing.today.revenue,
      completedRevenue: tradeData.hvac.today.completedRevenue + tradeData.plumbing.today.completedRevenue,
      nonJobRevenue: tradeData.hvac.today.nonJobRevenue + tradeData.plumbing.today.nonJobRevenue,
      adjRevenue: tradeData.hvac.today.adjRevenue + tradeData.plumbing.today.adjRevenue,
      sales: ((tradeData.hvac.today as any).sales || 0) + ((tradeData.plumbing.today as any).sales || 0),
    };

    // Get yesterday's sales from trade snapshots
    const yesterdayDate = getYesterdayDateString();
    let yesterdaySales = 0;
    if (allSnapsData) {
      const yesterdaySnaps = (allSnapsData as TradeSnapshot[]).filter(s => s.snapshot_date === yesterdayDate && s.department === null);
      yesterdaySales = yesterdaySnaps.reduce((sum, s) => sum + (Number(s.sales) || 0), 0);
    }

    // Map KPI slugs to trade snapshot values for Christmas (Overall)
    const tradeOverrides: Record<string, number> = {
      'total-revenue': tradeTodayTotals.revenue,
      'revenue-completed': tradeTodayTotals.completedRevenue,
      'non-job-revenue': tradeTodayTotals.nonJobRevenue,
      'total-sales': tradeTodayTotals.sales,
      'yesterday-sales': yesterdaySales,
    };

    // Build response
    const christmasOverallSlug = 'christmas-overall';
    const departmentsWithKPIs: HuddleDepartmentWithKPIs[] = departments.map((dept) => {
      const isChristmasOverall = dept.slug === christmasOverallSlug;
      const deptKPIs = kpis
        .filter((kpi) => kpi.department_id === dept.id)
        .map((kpi): HuddleKPIWithData => {
          const snapshot = snapshotMap.get(kpi.id);
          const target = targetMap.get(kpi.id) || null;

          // For Christmas (Overall), override with trade_daily_snapshots data
          let actual = snapshot?.actual_value || null;
          if (isChristmasOverall && tradeOverrides[kpi.slug] !== undefined) {
            actual = tradeOverrides[kpi.slug];
          }

          const targetVal = target ? Number(target) : null;
          const percentToGoal = (actual !== null && targetVal && targetVal > 0)
            ? Math.round((Number(actual) / targetVal) * 100)
            : (snapshot?.percent_to_goal || null);
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

    // Extract department-level general notes (keyed as dept-{id})
    const generalNotes: Record<string, string> = {};
    notesMap.forEach((text, key) => {
      if (key.startsWith('dept-')) generalNotes[key] = text;
    });

    const response: HuddleDashboardResponse = {
      date,
      endDate,
      daysInRange,
      departments: departmentsWithKPIs,
      last_updated: new Date().toISOString(),
      pacing: pacingData,
      generalNotes,
    };

    // Add debug version to verify deployment
    return NextResponse.json({
      ...response,
      _debug: {
        version: 'v5-live-trade-totals',
        pacingSource: 'live-trade-data',
        trendDataSource: 'supabase-cache',
        monthCount: monthlyTrend.length,
        nonZeroMonths: monthlyTrend.filter(m => m.totalRevenue > 0).length,
        liveTodayRevenue,
        liveMtdRevenue,
      },
    });
  } catch (error) {
    console.error('Error fetching huddle data:', error);
    return NextResponse.json({ error: 'Failed to fetch huddle data' }, { status: 500 });
  }
}
