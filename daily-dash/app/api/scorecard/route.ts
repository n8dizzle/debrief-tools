import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/scorecard?week=23&year=2026
// Returns: current week data, trailing 13 weeks, same 13 weeks from prior year
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const url = new URL(request.url);

  // Default to most recent week with data
  let year = parseInt(url.searchParams.get('year') || '') || new Date().getFullYear();
  let week = parseInt(url.searchParams.get('week') || '') || 0;

  // If no week specified, find the latest week with data
  if (!week) {
    const { data: latest } = await supabase
      .from('weekly_scorecard')
      .select('year, week_number')
      .eq('year', year)
      .eq('trade', 'company')
      .order('week_number', { ascending: false })
      .limit(1)
      .single();

    if (latest) {
      year = latest.year;
      week = latest.week_number;
    } else {
      return NextResponse.json({ error: 'No scorecard data found' }, { status: 404 });
    }
  }

  // Calculate trailing 13 week range
  const startWeek = week - 12; // 13 weeks including current
  const priorYear = year - 1;

  // Fetch current year trailing 13 weeks
  const { data: currentYearData, error: currentError } = await supabase
    .from('weekly_scorecard')
    .select('*')
    .eq('year', year)
    .gte('week_number', startWeek)
    .lte('week_number', week)
    .order('week_number')
    .order('trade')
    .order('department');

  if (currentError) {
    console.error('Error fetching scorecard:', currentError);
    return NextResponse.json({ error: 'Failed to fetch scorecard data' }, { status: 500 });
  }

  // Fetch same weeks from prior year for YoY comparison
  const { data: priorYearData, error: priorError } = await supabase
    .from('weekly_scorecard')
    .select('*')
    .eq('year', priorYear)
    .gte('week_number', startWeek)
    .lte('week_number', week)
    .order('week_number')
    .order('trade')
    .order('department');

  if (priorError) {
    console.error('Error fetching prior year:', priorError);
  }

  // Fetch all target types from dash_monthly_targets
  const { data: allMonthlyTargets } = await supabase
    .from('dash_monthly_targets')
    .select('department, target_value, month, target_type')
    .eq('year', year);

  // Keep backward-compat alias
  const monthlyTargets = (allMonthlyTargets || []).filter(t => t.target_type === 'revenue');

  const { data: bizDays } = await supabase
    .from('dash_business_days')
    .select('month, total_days')
    .eq('year', year);

  // Build weekly targets per month for revenue (existing format, backward compat)
  const weeklyTargetsByMonth: Record<number, Record<string, number>> = {};
  for (const target of monthlyTargets) {
    const bd = bizDays?.find(b => b.month === target.month);
    const weeksInMonth = (bd?.total_days || 22) / 5;
    if (!weeklyTargetsByMonth[target.month]) weeklyTargetsByMonth[target.month] = {};
    weeklyTargetsByMonth[target.month][target.department] = Math.round(Number(target.target_value) / weeksInMonth);
  }

  // Build weekly targets for jobs_ran (monthly jobs / weeks in month)
  const weeklyJobsTargetsByMonth: Record<number, Record<string, number>> = {};
  for (const target of (allMonthlyTargets || []).filter(t => t.target_type === 'jobs')) {
    const bd = bizDays?.find(b => b.month === target.month);
    const weeksInMonth = (bd?.total_days || 22) / 5;
    if (!weeklyJobsTargetsByMonth[target.month]) weeklyJobsTargetsByMonth[target.month] = {};
    weeklyJobsTargetsByMonth[target.month][target.department] = Math.round(Number(target.target_value) / weeksInMonth);
  }

  // Build avg_ticket targets per month (not divided by weeks — it's a per-job metric)
  const avgTicketTargetsByMonth: Record<number, Record<string, number>> = {};
  for (const target of (allMonthlyTargets || []).filter(t => t.target_type === 'avg_ticket')) {
    if (!avgTicketTargetsByMonth[target.month]) avgTicketTargetsByMonth[target.month] = {};
    avgTicketTargetsByMonth[target.month][target.department] = Number(target.target_value);
  }

  // Build weekly sales targets (monthly sales / weeks in month)
  const weeklySalesTargetsByMonth: Record<number, Record<string, number>> = {};
  for (const target of (allMonthlyTargets || []).filter(t => t.target_type === 'sales')) {
    const bd = bizDays?.find(b => b.month === target.month);
    const weeksInMonth = (bd?.total_days || 22) / 5;
    if (!weeklySalesTargetsByMonth[target.month]) weeklySalesTargetsByMonth[target.month] = {};
    weeklySalesTargetsByMonth[target.month][target.department] = Math.round(Number(target.target_value) / weeksInMonth);
  }

  // Group data by week for easier consumption
  type WeekData = {
    week_number: number;
    week_ending: string;
    company: Record<string, unknown> | null;
    hvac: Record<string, unknown> | null;
    hvac_install: Record<string, unknown> | null;
    hvac_service: Record<string, unknown> | null;
    hvac_maintenance: Record<string, unknown> | null;
    hvac_sales: Record<string, unknown> | null;
    plumbing: Record<string, unknown> | null;
  };

  function groupByWeek(data: any[]): WeekData[] {
    const weekMap = new Map<number, WeekData>();

    for (const row of data) {
      if (!weekMap.has(row.week_number)) {
        weekMap.set(row.week_number, {
          week_number: row.week_number,
          week_ending: row.week_ending,
          company: null,
          hvac: null,
          hvac_install: null,
          hvac_service: null,
          hvac_maintenance: null,
          hvac_sales: null,
          plumbing: null,
        });
      }
      const weekEntry = weekMap.get(row.week_number)!;

      if (row.trade === 'company') weekEntry.company = row;
      else if (row.trade === 'hvac' && !row.department) weekEntry.hvac = row;
      else if (row.trade === 'hvac' && row.department === 'install') weekEntry.hvac_install = row;
      else if (row.trade === 'hvac' && row.department === 'service') weekEntry.hvac_service = row;
      else if (row.trade === 'hvac' && row.department === 'maintenance') weekEntry.hvac_maintenance = row;
      else if (row.trade === 'hvac' && row.department === 'sales') weekEntry.hvac_sales = row;
      else if (row.trade === 'plumbing') weekEntry.plumbing = row;
    }

    return Array.from(weekMap.values()).sort((a, b) => a.week_number - b.week_number);
  }

  const currentWeeks = groupByWeek(currentYearData || []);
  const priorWeeks = groupByWeek(priorYearData || []);
  const currentWeek = currentWeeks[currentWeeks.length - 1] || null;
  const prevWeek = currentWeeks.length >= 2 ? currentWeeks[currentWeeks.length - 2] : null;

  // Get the month for the current week to look up targets
  const currentWeekEnding = currentWeek?.week_ending ? new Date(currentWeek.week_ending + 'T12:00:00') : new Date();
  const currentMonth = currentWeekEnding.getMonth() + 1;
  const targets = weeklyTargetsByMonth[currentMonth] || {};
  const jobsTargets = weeklyJobsTargetsByMonth[currentMonth] || {};
  const avgTicketTargets = avgTicketTargetsByMonth[currentMonth] || {};
  const salesTargets = weeklySalesTargetsByMonth[currentMonth] || {};

  // Attach per-week targets based on each week's month
  const weeklyTargets = currentWeeks.map(w => {
    const we = new Date(w.week_ending + 'T12:00:00');
    const m = we.getMonth() + 1;
    return weeklyTargetsByMonth[m] || {};
  });

  // Compute YTD totals
  const startOfYear = `${year}-01-01T00:00:00`;
  const now = new Date().toISOString();

  const [{ data: ytdData }, { count: ytdReviewCount }, { count: activeMemberCount }] = await Promise.all([
    supabase
      .from('weekly_scorecard')
      .select('revenue, sales, jobs_ran, memberships_sold')
      .eq('year', year)
      .eq('trade', 'company')
      .lte('week_number', week),
    // YTD reviews: count directly from google_reviews (source of truth)
    supabase
      .from('google_reviews')
      .select('id', { count: 'exact', head: true })
      .gte('create_time', startOfYear)
      .lte('create_time', now),
    // Active memberships: count from mm_memberships (source of truth)
    supabase
      .from('mm_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Active'),
  ]);

  const ytd = {
    revenue: 0,
    sales: 0,
    jobs_ran: 0,
    reviews: ytdReviewCount || 0,
    memberships_active: activeMemberCount || 0,
    memberships_sold: 0,
  };
  for (const row of ytdData || []) {
    ytd.revenue += Number(row.revenue) || 0;
    ytd.sales += Number(row.sales) || 0;
    ytd.jobs_ran += (row.jobs_ran as number) || 0;
    ytd.memberships_sold += (row.memberships_sold as number) || 0;
  }

  // Annual targets for YTD pacing
  const annualRevTarget = (monthlyTargets || [])
    .filter(t => t.department === 'TOTAL')
    .reduce((sum, t) => sum + Number(t.target_value), 0);

  // Expected YTD revenue (sum of completed months + prorated current month)
  // Completed months get their full target, current month is prorated by business days elapsed
  const currentMonthBizDays = bizDays?.find(b => b.month === currentMonth)?.total_days || 22;
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const dayOfMonth = today.getDate();
  // Approximate business days elapsed: weekdays up to today in this month
  let bizDaysElapsed = 0;
  for (let d = 1; d <= dayOfMonth; d++) {
    const dt = new Date(today.getFullYear(), today.getMonth(), d);
    const dow = dt.getDay();
    if (dow === 0) continue; // Sunday
    if (dow === 6) { bizDaysElapsed += 0.5; continue; } // Saturday = 0.5
    bizDaysElapsed += 1;
  }
  const currentMonthPct = Math.min(bizDaysElapsed / currentMonthBizDays, 1);

  const expectedYtdRevenue = (monthlyTargets || [])
    .filter(t => t.department === 'TOTAL' && t.month <= currentMonth)
    .reduce((sum, t) => {
      const val = Number(t.target_value);
      return sum + (t.month < currentMonth ? val : val * currentMonthPct);
    }, 0);

  return NextResponse.json({
    year,
    week,
    currentWeek,
    prevWeek,
    trailing13: currentWeeks,
    priorYear13: priorWeeks,
    targets,
    jobsTargets,
    avgTicketTargets,
    salesTargets,
    weeklyTargets,
    ytd,
    annualRevTarget,
    expectedYtdRevenue,
  });
}
