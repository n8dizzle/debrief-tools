import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import {
  getStatusFromPercentage,
  calculatePercentToGoal,
} from '@/lib/huddle-utils';

interface BackfillResult {
  date: string;
  success: boolean;
  synced_count: number;
  error?: string;
}

// Helper to get dates between start and end (inclusive)
function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// Helper to delay execution
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// POST /api/huddle/backfill - Backfill historical data
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

      // Only owners can trigger backfill
      const { role } = session.user;
      if (role !== 'owner') {
        return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const { startDate, endDate, skipExisting = true } = body;

    // Validate dates
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();
    const stClient = getServiceTitanClient();

    if (!stClient.isConfigured()) {
      return NextResponse.json(
        { error: 'ServiceTitan not configured' },
        { status: 500 }
      );
    }

    // Get all dates to process
    const allDates = getDateRange(startDate, endDate);

    // If skipExisting, filter out dates that already have complete data
    let datesToProcess = allDates;
    if (skipExisting) {
      // Get dates that already have snapshots for revenue-completed
      const { data: existingSnapshots } = await supabase
        .from('huddle_snapshots')
        .select('snapshot_date, huddle_kpis!inner(slug)')
        .gte('snapshot_date', startDate)
        .lte('snapshot_date', endDate)
        .eq('huddle_kpis.slug', 'revenue-completed');

      const existingDates = new Set(
        existingSnapshots?.map((s) => s.snapshot_date) || []
      );
      datesToProcess = allDates.filter((d) => !existingDates.has(d));
    }

    // Log the backfill start
    const { data: syncLog } = await supabase
      .from('dash_sync_log')
      .insert({
        sync_type: 'huddle_backfill',
        status: 'running',
        records_synced: 0,
      })
      .select()
      .single();

    // Fetch KPIs and targets
    const { data: kpis } = await supabase
      .from('huddle_kpis')
      .select('*, huddle_departments(slug)')
      .eq('data_source', 'servicetitan')
      .eq('is_active', true);

    const { data: targets } = await supabase
      .from('huddle_targets')
      .select('*')
      .eq('target_type', 'daily')
      .order('effective_date', { ascending: false });

    // Build target lookup
    const targetMap = new Map<string, number>();
    targets?.forEach((t) => {
      if (!targetMap.has(t.kpi_id)) {
        targetMap.set(t.kpi_id, Number(t.target_value));
      }
    });

    const results: BackfillResult[] = [];
    let totalSynced = 0;

    // Process each date with rate limiting
    for (const date of datesToProcess) {
      try {
        let syncedCount = 0;

        for (const kpi of kpis || []) {
          let actualValue: number | null = null;

          try {
            switch (kpi.slug) {
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
              case 'service-jobs-completed':
                actualValue = await stClient.getCompletedJobCount(date, { tradeType: 'HVAC' });
                break;
              case 'average-ticket':
                actualValue = await stClient.getAverageTicket(date, { tradeType: 'HVAC' });
                break;
              case 'zero-dollar-tickets':
                actualValue = await stClient.getZeroDollarPercentage(date, 'HVAC');
                break;
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
            }
          } catch (e) {
            console.error(`Error fetching ${kpi.slug} for ${date}:`, e);
          }

          if (actualValue !== null) {
            const target = targetMap.get(kpi.id) || null;
            const percentToGoal = calculatePercentToGoal(actualValue, target, kpi.higher_is_better);
            const status = getStatusFromPercentage(percentToGoal, kpi.higher_is_better);

            await supabase.from('huddle_snapshots').upsert(
              {
                kpi_id: kpi.id,
                snapshot_date: date,
                actual_value: actualValue,
                percent_to_goal: percentToGoal,
                status,
                data_source: 'servicetitan',
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'kpi_id,snapshot_date' }
            );
            syncedCount++;
          }
        }

        results.push({ date, success: true, synced_count: syncedCount });
        totalSynced += syncedCount;

        // Rate limit: wait 500ms between dates to avoid API throttling
        await delay(500);
      } catch (e) {
        results.push({
          date,
          success: false,
          synced_count: 0,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    // Update sync log
    if (syncLog?.id) {
      await supabase
        .from('dash_sync_log')
        .update({
          completed_at: new Date().toISOString(),
          status: 'completed',
          records_synced: totalSynced,
        })
        .eq('id', syncLog.id);
    }

    return NextResponse.json({
      success: true,
      total_dates: datesToProcess.length,
      total_synced: totalSynced,
      skipped_dates: allDates.length - datesToProcess.length,
      results,
    });
  } catch (error) {
    console.error('Error in backfill:', error);
    return NextResponse.json(
      { error: 'Failed to run backfill' },
      { status: 500 }
    );
  }
}

// GET /api/huddle/backfill - Get backfill status and data completeness
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM format

    const supabase = getServerSupabase();

    // Default to current month
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const [year, monthNum] = targetMonth.split('-').map(Number);

    // Get first and last day of month
    const firstDay = new Date(year, monthNum - 1, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, monthNum, 0).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const effectiveEndDate = lastDay < today ? lastDay : today;

    // Get holidays to calculate business days
    const { data: holidays } = await supabase
      .from('dash_holidays')
      .select('holiday_date')
      .gte('holiday_date', firstDay)
      .lte('holiday_date', effectiveEndDate);

    const holidaySet = new Set(holidays?.map((h) => h.holiday_date) || []);

    // Calculate expected business days
    const expectedDates: string[] = [];
    const current = new Date(firstDay);
    const end = new Date(effectiveEndDate);
    while (current <= end) {
      const day = current.getDay();
      const dateStr = current.toISOString().split('T')[0];
      if (day >= 1 && day <= 5 && !holidaySet.has(dateStr)) {
        expectedDates.push(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }

    // Get existing snapshots for revenue-completed (our primary KPI)
    const { data: snapshots } = await supabase
      .from('huddle_snapshots')
      .select('snapshot_date, actual_value, huddle_kpis!inner(slug)')
      .gte('snapshot_date', firstDay)
      .lte('snapshot_date', effectiveEndDate)
      .eq('huddle_kpis.slug', 'revenue-completed');

    const existingDates = new Set(snapshots?.map((s) => s.snapshot_date) || []);
    const missingDates = expectedDates.filter((d) => !existingDates.has(d));

    // Get last sync info
    const { data: lastSync } = await supabase
      .from('dash_sync_log')
      .select('*')
      .eq('sync_type', 'huddle_backfill')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    // Calculate MTD from snapshots
    const mtdRevenue = snapshots?.reduce((sum, s) => {
      return sum + (Number((s as any).actual_value) || 0);
    }, 0) || 0;

    return NextResponse.json({
      month: targetMonth,
      dataCompleteness: {
        expectedDays: expectedDates.length,
        actualDays: existingDates.size,
        missingDays: missingDates.length,
        completenessPercent: expectedDates.length > 0
          ? Math.round((existingDates.size / expectedDates.length) * 100)
          : 0,
        missingDates,
      },
      mtdRevenue,
      lastBackfill: lastSync ? {
        startedAt: lastSync.started_at,
        completedAt: lastSync.completed_at,
        status: lastSync.status,
        recordsSynced: lastSync.records_synced,
      } : null,
    });
  } catch (error) {
    console.error('Error checking backfill status:', error);
    return NextResponse.json(
      { error: 'Failed to check backfill status' },
      { status: 500 }
    );
  }
}
