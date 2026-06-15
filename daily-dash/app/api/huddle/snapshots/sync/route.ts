import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import {
  getStatusFromPercentage,
  calculatePercentToGoal,
  getTodayDateString,
  getYesterdayDateString,
  calculateDailyPaceNeeded,
} from '@/lib/huddle-utils';

interface SyncResult {
  kpi_slug: string;
  actual_value: number | null;
  status: string;
  error?: string;
}

// POST /api/huddle/snapshots/sync - Trigger data sync from ServiceTitan
export async function POST(request: NextRequest) {
  try {
    // Check for cron secret (for scheduled jobs)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

    // If not cron auth, check session
    if (!isCronAuth) {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Only managers and owners can trigger sync
      const { role } = session.user;
      if (role === 'employee') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const date = body.date || getYesterdayDateString(); // Default to yesterday's data
    const syncSource = isCronAuth ? 'cron' : 'manual';

    const supabase = getServerSupabase();
    const stClient = getServiceTitanClient();

    // Fetch all KPIs with ServiceTitan as data source
    const { data: kpis, error: kpiError } = await supabase
      .from('huddle_kpis')
      .select('*, huddle_departments(slug)')
      .eq('data_source', 'servicetitan')
      .eq('is_active', true);

    if (kpiError) {
      console.error('Error fetching KPIs:', kpiError);
      return NextResponse.json({ error: 'Failed to fetch KPIs' }, { status: 500 });
    }

    // Fetch current targets for calculating percent to goal
    const { data: targets } = await supabase
      .from('huddle_targets')
      .select('*')
      .eq('target_type', 'daily')
      .lte('effective_date', date)
      .order('effective_date', { ascending: false });

    const targetMap = new Map<string, number>();
    targets?.forEach((t) => {
      if (!targetMap.has(t.kpi_id)) {
        targetMap.set(t.kpi_id, t.target_value);
      }
    });

    const results: SyncResult[] = [];

    // Log sync start
    const { data: syncLog } = await supabase
      .from('dash_sync_log')
      .insert({
        sync_type: `huddle_sync_${syncSource}`,
        status: 'running',
        records_synced: 0,
      })
      .select()
      .single();

    // Check if ServiceTitan is configured
    if (!stClient.isConfigured()) {
      console.warn('ServiceTitan not configured - skipping ST sync');
      return NextResponse.json({
        success: false,
        message: 'ServiceTitan not configured',
        results: [],
      });
    }

    // Process each KPI
    for (const kpi of kpis) {
      const deptSlug = (kpi.huddle_departments as any)?.slug || '';
      let actualValue: number | null = null;
      let error: string | undefined;

      try {
        // Map KPI slug to ServiceTitan data fetch
        switch (kpi.slug) {
          // Christmas Overall
          case 'jobs-scheduled':
            actualValue = await stClient.getScheduledJobCount(date);
            break;
          case 'yesterday-sales':
            actualValue = await stClient.getDailySales(date);
            break;
          case 'revenue-completed':
            // Use invoice totals for completed jobs (matches ST's "Completed Revenue")
            const revBreakdown = await stClient.getTotalRevenue(date);
            actualValue = revBreakdown.completedRevenue;
            break;
          case 'non-job-revenue':
            const nonJobBreakdown = await stClient.getTotalRevenue(date);
            actualValue = nonJobBreakdown.nonJobRevenue;
            break;
          case 'adj-revenue':
            // Adjustment revenue (refunds, credits - usually negative)
            const adjBreakdown = await stClient.getTotalRevenue(date);
            actualValue = adjBreakdown.adjRevenue;
            break;
          case 'total-revenue':
            // Total = Completed + Non-Job + Adj (matches ST's "Total Revenue")
            const totalRev = await stClient.getTotalRevenue(date);
            actualValue = totalRev.totalRevenue;
            break;
          case 'total-sales':
            // Sum of sold estimate subtotals (matches ST's "Total Sales")
            actualValue = await stClient.getTotalSales(date);
            break;

          // HVAC Service
          case 'service-jobs-completed':
            actualValue = await stClient.getCompletedJobCount(date, { tradeType: 'HVAC' });
            break;
          case 'average-ticket':
            actualValue = await stClient.getAverageTicket(date, { tradeType: 'HVAC' });
            break;
          case 'zero-dollar-tickets':
            actualValue = await stClient.getZeroDollarPercentage(date, 'HVAC');
            break;

          // HVAC Install
          case 'installs-scheduled':
            const installMetrics = await stClient.getInstallMetrics(date);
            actualValue = installMetrics.scheduled;
            break;
          case 'installs-completed':
            const installMetrics2 = await stClient.getInstallMetrics(date);
            actualValue = installMetrics2.completed;
            break;
          case 'install-revenue':
            const installMetrics3 = await stClient.getInstallMetrics(date);
            actualValue = installMetrics3.revenue;
            break;

          // Plumbing
          case 'plumbing-sales':
            const plumbingMetrics = await stClient.getPlumbingMetrics(date);
            actualValue = plumbingMetrics.sales;
            break;
          case 'plumbing-revenue':
            const plumbingMetrics2 = await stClient.getPlumbingMetrics(date);
            actualValue = plumbingMetrics2.revenue;
            break;
          case 'plumbing-jobs-ran':
            const plumbingMetrics3 = await stClient.getPlumbingMetrics(date);
            actualValue = plumbingMetrics3.jobsRan;
            break;
          case 'plumbing-average-ticket':
            actualValue = await stClient.getAverageTicket(date, { tradeType: 'Plumbing' });
            break;

          default:
            // KPI not mapped to ST data yet
            error = 'No ST mapping defined';
        }
      } catch (e) {
        error = e instanceof Error ? e.message : 'Unknown error';
        console.error(`Error syncing KPI ${kpi.slug}:`, e);
      }

      // Calculate percent to goal and status
      const target = targetMap.get(kpi.id) || null;
      const percentToGoal = calculatePercentToGoal(actualValue, target, kpi.higher_is_better);
      const status = getStatusFromPercentage(percentToGoal, kpi.higher_is_better);

      // Upsert snapshot
      if (actualValue !== null) {
        const { error: upsertError } = await supabase.from('huddle_snapshots').upsert(
          {
            kpi_id: kpi.id,
            snapshot_date: date,
            actual_value: actualValue,
            percent_to_goal: percentToGoal,
            status,
            data_source: 'servicetitan',
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'kpi_id,snapshot_date',
          }
        );

        if (upsertError) {
          console.error(`Error upserting snapshot for ${kpi.slug}:`, upsertError);
          error = upsertError.message;
        }
      }

      results.push({
        kpi_slug: kpi.slug,
        actual_value: actualValue,
        status,
        error,
      });
    }

    // ============================================
    // CALCULATED KPIs (Christmas Pacing)
    // ============================================
    const calculatedResults = await syncCalculatedKPIs(supabase, date);
    results.push(...calculatedResults);

    const syncedCount = results.filter((r) => r.actual_value !== null).length;

    // Update sync log with completion status
    if (syncLog?.id) {
      await supabase
        .from('dash_sync_log')
        .update({
          completed_at: new Date().toISOString(),
          status: 'completed',
          records_synced: syncedCount,
        })
        .eq('id', syncLog.id);
    }

    return NextResponse.json({
      success: true,
      date,
      synced_count: syncedCount,
      sync_source: syncSource,
      results,
    });
  } catch (error) {
    console.error('Error in snapshots sync:', error);
    return NextResponse.json({ error: 'Failed to sync snapshots' }, { status: 500 });
  }
}

// ============================================
// Calculated KPI sync (Christmas Pacing rows)
// ============================================

// KPI IDs for the Christmas Pacing department
const PACING_KPI_IDS = {
  weeklyTarget: 'f8af934e-cd52-4287-a78c-1da23f9d59cf',
  weeklyToDate: 'a448b9fb-6acc-4267-be36-917601db7f4a',
  monthlyTarget: '9daa6f7c-aba1-490a-a9c0-016556cc2dad',
  monthlyToDate: '857f9e57-72d7-4364-84b7-6fec3e2204b1',
  currentPacing: '3a8cf3dc-1ede-4245-89ee-134dfd25a519',
  businessDaysRemaining: 'e7d0ee5b-d879-4b92-97dc-3889d301a055',
  dailyPaceNeeded: 'ec5fc6c3-aa32-44c1-8426-8f10b568543a',
};

const TOTAL_REVENUE_KPI_ID = 'b66abe1f-2408-4a11-8219-9cb27f333a51';

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=Sun, 1=Mon...6=Sat
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setDate(d.getDate() - diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getMonthStart(dateStr: string): string {
  return dateStr.substring(0, 8) + '01';
}

function getBusinessDaysInMonth(year: number, month: number): number {
  const lastDay = new Date(year, month, 0).getDate(); // month is 1-indexed here
  let bizDays = 0;
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(year, month - 1, day);
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) bizDays += 1;
    else if (dow === 6) bizDays += 0.5;
  }
  return bizDays;
}

function getBusinessDaysElapsedUpTo(dateStr: string): number {
  const [year, monthStr] = dateStr.split('-');
  const y = parseInt(year);
  const m = parseInt(monthStr);
  const dayNum = parseInt(dateStr.split('-')[2]);
  let bizDays = 0;
  for (let day = 1; day <= dayNum; day++) {
    const d = new Date(y, m - 1, day);
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) bizDays += 1;
    else if (dow === 6) bizDays += 0.5;
  }
  return bizDays;
}

function getBusinessDaysRemainingAfter(dateStr: string): number {
  // Count business days from the day AFTER dateStr to end of month
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const y = parseInt(yearStr);
  const m = parseInt(monthStr);
  const startDay = parseInt(dayStr) + 1; // day after the snapshot
  const lastDay = new Date(y, m, 0).getDate(); // last day of month (m is 1-indexed)
  let bizDays = 0;
  for (let day = startDay; day <= lastDay; day++) {
    const d = new Date(y, m - 1, day);
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) bizDays += 1;
    else if (dow === 6) bizDays += 0.5;
  }
  return bizDays;
}

async function syncCalculatedKPIs(
  supabase: ReturnType<typeof getServerSupabase>,
  date: string
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const [yearStr, monthStr] = date.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);

  try {
    // 1. Get monthly target from dash_monthly_targets
    const { data: targetRow } = await supabase
      .from('dash_monthly_targets')
      .select('target_value')
      .eq('year', year)
      .eq('month', month)
      .eq('department', 'TOTAL')
      .eq('target_type', 'revenue')
      .single();

    const monthlyTarget = targetRow ? parseFloat(targetRow.target_value) : 0;

    // 2. Get total-revenue snapshots for MTD (month start through date)
    const monthStart = getMonthStart(date);
    const { data: mtdSnapshots } = await supabase
      .from('huddle_snapshots')
      .select('actual_value')
      .eq('kpi_id', TOTAL_REVENUE_KPI_ID)
      .gte('snapshot_date', monthStart)
      .lte('snapshot_date', date);

    const mtdRevenue = (mtdSnapshots || []).reduce(
      (sum, s) => sum + (parseFloat(s.actual_value) || 0),
      0
    );

    // 3. Get total-revenue snapshots for WTD (Monday through date)
    const monday = getMonday(date);
    const { data: wtdSnapshots } = await supabase
      .from('huddle_snapshots')
      .select('actual_value')
      .eq('kpi_id', TOTAL_REVENUE_KPI_ID)
      .gte('snapshot_date', monday)
      .lte('snapshot_date', date);

    const wtdRevenue = (wtdSnapshots || []).reduce(
      (sum, s) => sum + (parseFloat(s.actual_value) || 0),
      0
    );

    // 4. Calculate business days
    const bizDaysInMonth = getBusinessDaysInMonth(year, month);
    const bizDaysElapsed = getBusinessDaysElapsedUpTo(date);
    const bizDaysRemaining = getBusinessDaysRemainingAfter(date);

    // 5. Weekly target = monthly target / biz days in month * 5.5
    const weeklyTarget = bizDaysInMonth > 0
      ? (monthlyTarget / bizDaysInMonth) * 5.5
      : 0;

    // 6. Current pacing = projected monthly based on pace so far
    const currentPacing = bizDaysElapsed > 0
      ? (mtdRevenue / bizDaysElapsed) * bizDaysInMonth
      : 0;

    // 7. Daily pace needed = (target - MTD) / biz days remaining
    const dailyPaceNeeded = calculateDailyPaceNeeded(
      monthlyTarget,
      mtdRevenue,
      bizDaysRemaining
    );

    // Upsert all calculated KPIs
    const calculatedValues: Array<{
      slug: string;
      kpiId: string;
      value: number;
      target?: number;
    }> = [
      { slug: 'weekly-target', kpiId: PACING_KPI_IDS.weeklyTarget, value: weeklyTarget },
      { slug: 'weekly-to-date', kpiId: PACING_KPI_IDS.weeklyToDate, value: wtdRevenue, target: weeklyTarget },
      { slug: 'monthly-target', kpiId: PACING_KPI_IDS.monthlyTarget, value: monthlyTarget },
      { slug: 'monthly-to-date', kpiId: PACING_KPI_IDS.monthlyToDate, value: mtdRevenue, target: monthlyTarget },
      { slug: 'current-pacing', kpiId: PACING_KPI_IDS.currentPacing, value: currentPacing, target: monthlyTarget },
      { slug: 'business-days-remaining', kpiId: PACING_KPI_IDS.businessDaysRemaining, value: bizDaysRemaining },
      { slug: 'daily-pace-needed', kpiId: PACING_KPI_IDS.dailyPaceNeeded, value: dailyPaceNeeded },
    ];

    for (const calc of calculatedValues) {
      const percentToGoal = calc.target && calc.target > 0
        ? (calc.value / calc.target) * 100
        : null;
      const status = getStatusFromPercentage(percentToGoal, true);

      const { error: upsertError } = await supabase.from('huddle_snapshots').upsert(
        {
          kpi_id: calc.kpiId,
          snapshot_date: date,
          actual_value: Math.round(calc.value * 100) / 100,
          percent_to_goal: percentToGoal ? Math.round(percentToGoal * 100) / 100 : null,
          status,
          data_source: 'calculated',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'kpi_id,snapshot_date' }
      );

      if (upsertError) {
        console.error(`Error upserting calculated KPI ${calc.slug}:`, upsertError);
      }

      results.push({
        kpi_slug: calc.slug,
        actual_value: Math.round(calc.value * 100) / 100,
        status,
        error: upsertError?.message,
      });
    }
  } catch (e) {
    console.error('Error syncing calculated KPIs:', e);
    results.push({
      kpi_slug: 'calculated-kpis',
      actual_value: null,
      status: 'pending',
      error: e instanceof Error ? e.message : 'Unknown error',
    });
  }

  return results;
}

/**
 * GET /api/huddle/snapshots/sync
 * Vercel cron jobs send GET requests - delegate to POST handler
 */
export async function GET(request: NextRequest) {
  return POST(request);
}
