import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import {
  getStatusFromPercentage,
  calculatePercentToGoal,
  getTodayDateString,
  getYesterdayDateString,
} from '@/lib/huddle-utils';

// Helper to get yesterday's date in YYYY-MM-DD format (Central Time)
function getYesterdayCT(): string {
  const now = new Date();
  // Convert to Central Time (UTC-6 or UTC-5 depending on DST)
  const ct = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  ct.setDate(ct.getDate() - 1);
  return ct.toISOString().split('T')[0];
}

// Helper to get today's date in YYYY-MM-DD format (Central Time)
function getTodayCT(): string {
  const now = new Date();
  const ct = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  return ct.toISOString().split('T')[0];
}

// GET /api/cron/huddle-sync - Called by Vercel Cron
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, verify the request is from Vercel
    // Vercel sets this header for cron jobs
    if (process.env.VERCEL === '1') {
      // Vercel cron jobs are authenticated by the platform
      // But we can also check our own secret if set
      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        // Allow if it's a genuine Vercel cron request (no auth header needed)
        const isVercelCron = request.headers.get('x-vercel-id');
        if (!isVercelCron) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
      }
    } else {
      // In development, require the cron secret
      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const syncToday = searchParams.get('today') === 'true';

    // Determine which date to sync
    const date = syncToday ? getTodayCT() : getYesterdayCT();

    const supabase = getServerSupabase();
    const stClient = getServiceTitanClient();

    if (!stClient.isConfigured()) {
      console.warn('ServiceTitan not configured - skipping cron sync');
      return NextResponse.json({
        success: false,
        message: 'ServiceTitan not configured',
      });
    }

    // Log sync start
    const { data: syncLog } = await supabase
      .from('dash_sync_log')
      .insert({
        sync_type: syncToday ? 'huddle_cron_today' : 'huddle_cron_yesterday',
        status: 'running',
        records_synced: 0,
      })
      .select()
      .single();

    // Fetch KPIs
    const { data: kpis, error: kpiError } = await supabase
      .from('huddle_kpis')
      .select('*, huddle_departments(slug)')
      .eq('data_source', 'servicetitan')
      .eq('is_active', true);

    if (kpiError) {
      console.error('Error fetching KPIs:', kpiError);
      return NextResponse.json({ error: 'Failed to fetch KPIs' }, { status: 500 });
    }

    // Fetch targets
    const { data: targets } = await supabase
      .from('huddle_targets')
      .select('*')
      .eq('target_type', 'daily')
      .lte('effective_date', date)
      .order('effective_date', { ascending: false });

    const targetMap = new Map<string, number>();
    targets?.forEach((t) => {
      if (!targetMap.has(t.kpi_id)) {
        targetMap.set(t.kpi_id, Number(t.target_value));
      }
    });

    let syncedCount = 0;
    const errors: string[] = [];

    // Process each KPI
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
            actualValue = await stClient.getDailyRevenue(date);
            break;
          case 'non-job-revenue':
            actualValue = await stClient.getNonJobRevenue(date);
            break;
          case 'total-revenue':
            const totalRev = await stClient.getTotalRevenue(date);
            actualValue = totalRev.totalRevenue;
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
        const errorMsg = `Error syncing ${kpi.slug}: ${e instanceof Error ? e.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }

      if (actualValue !== null) {
        const target = targetMap.get(kpi.id) || null;
        const percentToGoal = calculatePercentToGoal(actualValue, target, kpi.higher_is_better);
        const status = getStatusFromPercentage(percentToGoal, kpi.higher_is_better);

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
          { onConflict: 'kpi_id,snapshot_date' }
        );

        if (upsertError) {
          console.error(`Error upserting snapshot for ${kpi.slug}:`, upsertError);
          errors.push(`Upsert error for ${kpi.slug}: ${upsertError.message}`);
        } else {
          syncedCount++;
        }
      }
    }

    // Update sync log
    if (syncLog?.id) {
      await supabase
        .from('dash_sync_log')
        .update({
          completed_at: new Date().toISOString(),
          status: errors.length > 0 ? 'completed_with_errors' : 'completed',
          records_synced: syncedCount,
          error_message: errors.length > 0 ? errors.join('; ') : null,
        })
        .eq('id', syncLog.id);
    }

    console.log(`Cron sync completed for ${date}: ${syncedCount} records synced`);

    return NextResponse.json({
      success: true,
      date,
      synced_count: syncedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error in cron huddle sync:', error);
    return NextResponse.json(
      { error: 'Failed to run cron sync' },
      { status: 500 }
    );
  }
}
