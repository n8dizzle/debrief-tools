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
