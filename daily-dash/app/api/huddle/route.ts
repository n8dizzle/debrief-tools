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
import { getStatusFromPercentage, getTodayDateString } from '@/lib/huddle-utils';
import { getServiceTitanClient, TradeName, HVACDepartment } from '@/lib/servicetitan';

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

    // BATCH 1: Core huddle data - run in parallel
    const [deptResult, kpiResult, snapshotResult, targetResult, notesResult] = await Promise.all([
      supabase.from('huddle_departments').select('*').eq('is_active', true).order('display_order'),
      supabase.from('huddle_kpis').select('*').eq('is_active', true).order('display_order'),
      supabase.from('huddle_snapshots').select('*').eq('snapshot_date', date),
      supabase.from('huddle_targets').select('*').eq('target_type', 'daily').lte('effective_date', date).order('effective_date', { ascending: false }),
      supabase.from('huddle_notes').select('*').eq('note_date', date),
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
    const firstOfMonth = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const dayOfWeek = selectedDate.getDay();
    const monday = new Date(selectedDate);
    monday.setDate(selectedDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const mondayStr = monday.toISOString().split('T')[0];
    const quarter = Math.floor((month - 1) / 3) + 1;
    const quarterStartMonth = (quarter - 1) * 3 + 1;
    const quarterEndMonth = quarter * 3;
    const quarterStartDate = new Date(year, quarterStartMonth - 1, 1).toISOString().split('T')[0];
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
      supabase.from('huddle_snapshots').select('actual_value, huddle_kpis!inner(slug)').gte('snapshot_date', firstOfMonth).lte('snapshot_date', date).eq('huddle_kpis.slug', 'total-revenue'),
      supabase.from('huddle_snapshots').select('actual_value, huddle_kpis!inner(slug)').gte('snapshot_date', firstOfMonth).lte('snapshot_date', date).eq('huddle_kpis.slug', 'total-sales'),
      supabase.from('huddle_snapshots').select('actual_value, huddle_kpis!inner(slug)').gte('snapshot_date', mondayStr).lte('snapshot_date', date).eq('huddle_kpis.slug', 'total-revenue'),
      supabase.from('huddle_snapshots').select('actual_value, huddle_kpis!inner(slug)').gte('snapshot_date', mondayStr).lte('snapshot_date', date).eq('huddle_kpis.slug', 'total-sales'),
      supabase.from('huddle_snapshots').select('actual_value, huddle_kpis!inner(slug)').gte('snapshot_date', quarterStartDate).lte('snapshot_date', date).eq('huddle_kpis.slug', 'total-revenue'),
      supabase.from('huddle_snapshots').select('actual_value, huddle_kpis!inner(slug)').gte('snapshot_date', quarterStartDate).lte('snapshot_date', date).eq('huddle_kpis.slug', 'total-sales'),
      supabase.from('huddle_snapshots').select('actual_value, huddle_kpis!inner(slug)').gte('snapshot_date', yearStartDate).lte('snapshot_date', date).eq('huddle_kpis.slug', 'total-revenue'),
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
      ? Math.round((expectedYtdTarget / annualTargetValue) * 100)
      : 0;

    // Business days remaining in month
    const businessDaysRemaining = businessDaysInMonth - daysElapsedInMonth;

    // Fetch trade-level metrics from ServiceTitan
    const stClient = getServiceTitanClient();

    // Calculate targets for different time periods
    const hvacWeeklyTarget = hvacDailyTarget * totalWeekBusinessDays;
    const plumbingWeeklyTarget = plumbingDailyTarget * totalWeekBusinessDays;

    // BATCH 3: Trade targets - quarterly and annual for HVAC and Plumbing
    const [hvacQtrResult, plumbingQtrResult, hvacAnnualResult, plumbingAnnualResult] = await Promise.all([
      supabase.from('dash_monthly_targets').select('target_value, department').eq('year', year).gte('month', quarterStartMonth).lte('month', quarterEndMonth).eq('target_type', 'revenue').in('department', ['HVAC Install', 'HVAC Service', 'HVAC Maintenance']),
      supabase.from('dash_monthly_targets').select('target_value').eq('year', year).gte('month', quarterStartMonth).lte('month', quarterEndMonth).eq('target_type', 'revenue').eq('department', 'Plumbing'),
      supabase.from('dash_monthly_targets').select('target_value').eq('year', year).eq('target_type', 'revenue').in('department', ['HVAC Install', 'HVAC Service', 'HVAC Maintenance']),
      supabase.from('dash_monthly_targets').select('target_value').eq('year', year).eq('target_type', 'revenue').eq('department', 'Plumbing'),
    ]);

    const hvacQuarterlyTarget = hvacQtrResult.data?.reduce((sum, t) => sum + Number(t.target_value), 0) || 0;
    const plumbingQuarterlyTarget = plumbingQtrResult.data?.reduce((sum, t) => sum + Number(t.target_value), 0) || 0;
    const hvacAnnualTarget = hvacAnnualResult.data?.reduce((sum, t) => sum + Number(t.target_value), 0) || 0;
    const plumbingAnnualTarget = plumbingAnnualResult.data?.reduce((sum, t) => sum + Number(t.target_value), 0) || 0;

    // Type for department revenue breakdown
    interface DeptRevenue {
      revenue: number;
      completedRevenue: number;
      nonJobRevenue: number;
      adjRevenue: number;
    }

    const zeroDeptRevenue: DeptRevenue = { revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0 };

    let tradeData = {
      hvac: {
        today: {
          revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0,
          departments: { install: { ...zeroDeptRevenue }, service: { ...zeroDeptRevenue }, maintenance: { ...zeroDeptRevenue } },
        },
        wtd: {
          revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0,
          departments: { install: { ...zeroDeptRevenue }, service: { ...zeroDeptRevenue }, maintenance: { ...zeroDeptRevenue } },
        },
        mtd: {
          revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0,
          departments: { install: { ...zeroDeptRevenue }, service: { ...zeroDeptRevenue }, maintenance: { ...zeroDeptRevenue } },
        },
        qtd: {
          revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0,
          departments: { install: { ...zeroDeptRevenue }, service: { ...zeroDeptRevenue }, maintenance: { ...zeroDeptRevenue } },
        },
        ytd: {
          revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0,
          departments: { install: { ...zeroDeptRevenue }, service: { ...zeroDeptRevenue }, maintenance: { ...zeroDeptRevenue } },
        },
        targets: {
          daily: hvacDailyTarget,
          weekly: hvacWeeklyTarget,
          monthly: hvacMonthlyTarget,
          quarterly: hvacQuarterlyTarget,
          annual: hvacAnnualTarget,
          departments: {
            install: deptTargets['HVAC Install']?.monthly || 0,
            service: deptTargets['HVAC Service']?.monthly || 0,
            maintenance: deptTargets['HVAC Maintenance']?.monthly || 0,
          },
        },
      },
      plumbing: {
        today: { revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0 },
        wtd: { revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0 },
        mtd: { revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0 },
        qtd: { revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0 },
        ytd: { revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0 },
        targets: {
          daily: plumbingDailyTarget,
          weekly: plumbingWeeklyTarget,
          monthly: plumbingMonthlyTarget,
          quarterly: plumbingQuarterlyTarget,
          annual: plumbingAnnualTarget,
        },
      },
    };

    // Helper to aggregate trade snapshots from Supabase
    interface TradeSnapshot {
      snapshot_date: string;
      trade: string;
      department: string | null;
      revenue: number;
      completed_revenue: number;
      non_job_revenue: number;
      adj_revenue: number;
    }

    function aggregateTradeSnapshots(snapshots: TradeSnapshot[]): typeof tradeData.hvac.today & { departments?: typeof tradeData.hvac.today.departments } {
      const result = {
        revenue: 0,
        completedRevenue: 0,
        nonJobRevenue: 0,
        adjRevenue: 0,
        departments: {
          install: { ...zeroDeptRevenue },
          service: { ...zeroDeptRevenue },
          maintenance: { ...zeroDeptRevenue },
        },
      };

      for (const snap of snapshots) {
        if (snap.department === null) {
          result.revenue += Number(snap.revenue) || 0;
          result.completedRevenue += Number(snap.completed_revenue) || 0;
          result.nonJobRevenue += Number(snap.non_job_revenue) || 0;
          result.adjRevenue += Number(snap.adj_revenue) || 0;
        } else if (snap.department === 'install') {
          result.departments.install.revenue += Number(snap.revenue) || 0;
          result.departments.install.completedRevenue += Number(snap.completed_revenue) || 0;
          result.departments.install.nonJobRevenue += Number(snap.non_job_revenue) || 0;
          result.departments.install.adjRevenue += Number(snap.adj_revenue) || 0;
        } else if (snap.department === 'service') {
          result.departments.service.revenue += Number(snap.revenue) || 0;
          result.departments.service.completedRevenue += Number(snap.completed_revenue) || 0;
          result.departments.service.nonJobRevenue += Number(snap.non_job_revenue) || 0;
          result.departments.service.adjRevenue += Number(snap.adj_revenue) || 0;
        } else if (snap.department === 'maintenance') {
          result.departments.maintenance.revenue += Number(snap.revenue) || 0;
          result.departments.maintenance.completedRevenue += Number(snap.completed_revenue) || 0;
          result.departments.maintenance.nonJobRevenue += Number(snap.non_job_revenue) || 0;
          result.departments.maintenance.adjRevenue += Number(snap.adj_revenue) || 0;
        }
      }

      return result;
    }

    // Fetch trade metrics LIVE from ServiceTitan for Today, WTD, MTD
    // This ensures accuracy without relying on cached snapshots
    const isToday = date === getTodayDateString();

    if (stClient.isConfigured()) {
      try {
        // Fetch Today, WTD, MTD directly from ServiceTitan in parallel
        // This makes 3 API calls but ensures data matches ServiceTitan exactly
        const [todayMetrics, wtdMetrics, mtdMetrics] = await Promise.all([
          stClient.getTradeMetrics(date),           // Today only
          stClient.getTradeMetrics(mondayStr, date), // Monday through today
          stClient.getTradeMetrics(firstOfMonth, date), // First of month through today
        ]);

        // TODAY
        tradeData.hvac.today = todayMetrics.hvac;
        tradeData.plumbing.today = todayMetrics.plumbing;

        // WTD (Monday through selected date) - live from ServiceTitan
        tradeData.hvac.wtd = wtdMetrics.hvac;
        tradeData.plumbing.wtd = wtdMetrics.plumbing;

        // MTD (First of month through selected date) - live from ServiceTitan
        tradeData.hvac.mtd = mtdMetrics.hvac;
        tradeData.plumbing.mtd = mtdMetrics.plumbing;

        // QTD and YTD - still use Supabase snapshots (larger date ranges)
        const periodEndDate = isToday ? getYesterdayStr() : date;

        // Fetch all historical snapshots for YTD range
        const { data: ytdSnapshots } = await supabase
          .from('trade_daily_snapshots')
          .select('*')
          .gte('snapshot_date', yearStartDate)
          .lte('snapshot_date', periodEndDate);

        if (ytdSnapshots && ytdSnapshots.length > 0) {
          const allSnaps = ytdSnapshots as TradeSnapshot[];

          // QTD from snapshots
          const qtdSnaps = allSnaps.filter(s => s.snapshot_date >= quarterStartDate);
          const hvacQtdSnaps = qtdSnaps.filter(s => s.trade === 'hvac');
          const plumbingQtdSnaps = qtdSnaps.filter(s => s.trade === 'plumbing');
          const hvacQtdAgg = aggregateTradeSnapshots(hvacQtdSnaps);
          const plumbingQtdAgg = aggregateTradeSnapshots(plumbingQtdSnaps);

          // YTD from snapshots
          const hvacYtdSnaps = allSnaps.filter(s => s.trade === 'hvac');
          const plumbingYtdSnaps = allSnaps.filter(s => s.trade === 'plumbing');
          const hvacYtdAgg = aggregateTradeSnapshots(hvacYtdSnaps);
          const plumbingYtdAgg = aggregateTradeSnapshots(plumbingYtdSnaps);

          // Helper to add today's data to aggregates
          const addTodayToAgg = (agg: ReturnType<typeof aggregateTradeSnapshots>, today: typeof tradeData.hvac.today): typeof tradeData.hvac.today => {
            const aggDepts = agg.departments || { install: { ...zeroDeptRevenue }, service: { ...zeroDeptRevenue }, maintenance: { ...zeroDeptRevenue } };
            return {
              revenue: agg.revenue + today.revenue,
              completedRevenue: agg.completedRevenue + today.completedRevenue,
              nonJobRevenue: agg.nonJobRevenue + today.nonJobRevenue,
              adjRevenue: agg.adjRevenue + today.adjRevenue,
              departments: {
                install: {
                  revenue: aggDepts.install.revenue + (today.departments?.install?.revenue || 0),
                  completedRevenue: aggDepts.install.completedRevenue + (today.departments?.install?.completedRevenue || 0),
                  nonJobRevenue: aggDepts.install.nonJobRevenue + (today.departments?.install?.nonJobRevenue || 0),
                  adjRevenue: aggDepts.install.adjRevenue + (today.departments?.install?.adjRevenue || 0),
                },
                service: {
                  revenue: aggDepts.service.revenue + (today.departments?.service?.revenue || 0),
                  completedRevenue: aggDepts.service.completedRevenue + (today.departments?.service?.completedRevenue || 0),
                  nonJobRevenue: aggDepts.service.nonJobRevenue + (today.departments?.service?.nonJobRevenue || 0),
                  adjRevenue: aggDepts.service.adjRevenue + (today.departments?.service?.adjRevenue || 0),
                },
                maintenance: {
                  revenue: aggDepts.maintenance.revenue + (today.departments?.maintenance?.revenue || 0),
                  completedRevenue: aggDepts.maintenance.completedRevenue + (today.departments?.maintenance?.completedRevenue || 0),
                  nonJobRevenue: aggDepts.maintenance.nonJobRevenue + (today.departments?.maintenance?.nonJobRevenue || 0),
                  adjRevenue: aggDepts.maintenance.adjRevenue + (today.departments?.maintenance?.adjRevenue || 0),
                },
              },
            };
          };

          const addTodayToPlumbingAgg = (agg: ReturnType<typeof aggregateTradeSnapshots>, today: typeof tradeData.plumbing.today) => ({
            revenue: agg.revenue + today.revenue,
            completedRevenue: agg.completedRevenue + today.completedRevenue,
            nonJobRevenue: agg.nonJobRevenue + today.nonJobRevenue,
            adjRevenue: agg.adjRevenue + today.adjRevenue,
          });

          // Helper to ensure departments is always defined
          const ensureDepts = (agg: ReturnType<typeof aggregateTradeSnapshots>): typeof tradeData.hvac.today => ({
            ...agg,
            departments: agg.departments || { install: { ...zeroDeptRevenue }, service: { ...zeroDeptRevenue }, maintenance: { ...zeroDeptRevenue } },
          });

          // QTD and YTD - use snapshots + today's data (MTD already fetched live from ServiceTitan above)
          if (isToday) {
            tradeData.hvac.qtd = addTodayToAgg(hvacQtdAgg, tradeData.hvac.today);
            tradeData.hvac.ytd = addTodayToAgg(hvacYtdAgg, tradeData.hvac.today);
            tradeData.plumbing.qtd = addTodayToPlumbingAgg(plumbingQtdAgg, tradeData.plumbing.today);
            tradeData.plumbing.ytd = addTodayToPlumbingAgg(plumbingYtdAgg, tradeData.plumbing.today);
          } else {
            tradeData.hvac.qtd = ensureDepts(hvacQtdAgg);
            tradeData.hvac.ytd = ensureDepts(hvacYtdAgg);
            tradeData.plumbing.qtd = plumbingQtdAgg;
            tradeData.plumbing.ytd = plumbingYtdAgg;
          }
        }

        // If viewing a historical date, fetch that day's data from Supabase
        if (!isToday) {
          const { data: todaySnaps } = await supabase
            .from('trade_daily_snapshots')
            .select('*')
            .eq('snapshot_date', date);

          if (todaySnaps && todaySnaps.length > 0) {
            const hvacTodaySnaps = (todaySnaps as TradeSnapshot[]).filter(s => s.trade === 'hvac');
            const plumbingTodaySnaps = (todaySnaps as TradeSnapshot[]).filter(s => s.trade === 'plumbing');
            const hvacTodayAgg = aggregateTradeSnapshots(hvacTodaySnaps);
            tradeData.hvac.today = {
              ...hvacTodayAgg,
              departments: hvacTodayAgg.departments || { install: { ...zeroDeptRevenue }, service: { ...zeroDeptRevenue }, maintenance: { ...zeroDeptRevenue } },
            };
            tradeData.plumbing.today = aggregateTradeSnapshots(plumbingTodaySnaps);
          }
        }
      } catch (tradeError) {
        console.error('Error fetching trade metrics:', tradeError);
        // Continue with zero values if trade data fails
      }
    }

    // Helper to get yesterday's date string
    function getYesterdayStr(): string {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    }

    // Fetch 18-month trend data for the stacked bar chart
    const monthlyTrend: MonthlyTrendData[] = [];

    // Calculate 18 months ago from current date
    const trendStartDate = new Date(selectedDate);
    trendStartDate.setMonth(trendStartDate.getMonth() - 17); // 18 months including current
    trendStartDate.setDate(1); // First of month
    const trendStartStr = trendStartDate.toISOString().split('T')[0];

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

    // Fetch trend revenue from Supabase cache (much faster than 18 ServiceTitan API calls)
    // Only fetch current month from ServiceTitan for live data
    const currentMonthKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;

    try {
      // Get cached daily snapshots and aggregate by month
      const { data: trendSnapshots } = await supabase
        .from('trade_daily_snapshots')
        .select('snapshot_date, trade, revenue')
        .gte('snapshot_date', trendStartStr)
        .lte('snapshot_date', date)
        .is('department', null); // Only trade-level aggregates

      if (trendSnapshots && trendSnapshots.length > 0) {
        // Group by month and sum revenue
        const monthlyRevenue: Record<string, { hvac: number; plumbing: number }> = {};

        for (const snap of trendSnapshots) {
          const snapDate = typeof snap.snapshot_date === 'string'
            ? snap.snapshot_date
            : new Date(snap.snapshot_date).toISOString().split('T')[0];
          const monthKey = snapDate.substring(0, 7); // "YYYY-MM"

          if (!monthlyRevenue[monthKey]) {
            monthlyRevenue[monthKey] = { hvac: 0, plumbing: 0 };
          }

          const revenue = Number(snap.revenue) || 0;
          if (snap.trade === 'hvac') {
            monthlyRevenue[monthKey].hvac += revenue;
          } else if (snap.trade === 'plumbing') {
            monthlyRevenue[monthKey].plumbing += revenue;
          }
        }

        // Update monthlyTrend with cached values
        for (const monthData of monthlyTrend) {
          const cached = monthlyRevenue[monthData.month];
          if (cached) {
            monthData.hvacRevenue = cached.hvac;
            monthData.plumbingRevenue = cached.plumbing;
            monthData.totalRevenue = cached.hvac + cached.plumbing;
          }
        }
      }

      // For current month, use live ServiceTitan data (already fetched above)
      const currentMonthData = monthlyTrend.find(m => m.month === currentMonthKey);
      if (currentMonthData && tradeData) {
        currentMonthData.hvacRevenue = tradeData.hvac.mtd.revenue;
        currentMonthData.plumbingRevenue = tradeData.plumbing.mtd.revenue;
        currentMonthData.totalRevenue = tradeData.hvac.mtd.revenue + tradeData.plumbing.mtd.revenue;
      }
    } catch (trendError) {
      console.error('Error fetching trend data from cache:', trendError);

      // Fallback: fetch from ServiceTitan if cache fails
      if (stClient.isConfigured()) {
        try {
          const fetchTasks = monthlyTrend.map(async (monthData) => {
            const [yearStr, monthStr] = monthData.month.split('-');
            const yr = parseInt(yearStr);
            const mo = parseInt(monthStr);
            const firstOfMonth = new Date(yr, mo - 1, 1);
            const lastOfMonth = new Date(yr, mo, 0);
            if (firstOfMonth > selectedDate) return;
            const endDate = lastOfMonth > selectedDate ? selectedDate : lastOfMonth;
            const startStr = firstOfMonth.toISOString().split('T')[0];
            const endStr = endDate.toISOString().split('T')[0];
            try {
              const metrics = await stClient.getTradeMetrics(startStr, endStr);
              monthData.hvacRevenue = metrics.hvac.revenue;
              monthData.plumbingRevenue = metrics.plumbing.revenue;
              monthData.totalRevenue = metrics.hvac.revenue + metrics.plumbing.revenue;
            } catch (err) {
              console.error(`Error fetching trend data for ${monthData.month}:`, err);
            }
          });
          await Promise.all(fetchTasks);
        } catch (fallbackError) {
          console.error('Fallback trend fetch also failed:', fallbackError);
        }
      }
    }

    // Pacing data object
    const pacingData = {
      todayRevenue,
      todaySales,
      dailyTarget,
      wtdRevenue,
      wtdSales,
      weeklyTarget,
      mtdRevenue,
      mtdSales,
      monthlyTarget: monthlyTargetValue,
      qtdRevenue,
      qtdSales,
      quarterlyTarget: quarterlyTargetValue,
      quarter,
      ytdRevenue,
      annualTarget: annualTargetValue,
      expectedAnnualPacingPercent, // Seasonal weighted expected YTD %
      pacingPercent,
      businessDaysRemaining,
      businessDaysElapsed: daysElapsedInMonth,
      businessDaysInMonth,
      // Trade data
      trades: tradeData,
      // Monthly trend for chart
      monthlyTrend,
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

    // Add debug version to verify deployment
    return NextResponse.json({
      ...response,
      _debug: {
        version: 'v3-direct-st-fetch',
        trendDataSource: 'servicetitan-api',
        monthCount: monthlyTrend.length,
        nonZeroMonths: monthlyTrend.filter(m => m.totalRevenue > 0).length,
      },
    });
  } catch (error) {
    console.error('Error fetching huddle data:', error);
    return NextResponse.json({ error: 'Failed to fetch huddle data' }, { status: 500 });
  }
}
