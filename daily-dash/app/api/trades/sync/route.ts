import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { getYesterdayDateString, getLocalDateString } from '@/lib/huddle-utils';

// POST /api/trades/sync - Sync trade metrics for a specific date
// Body: { date?: string, backfillDays?: number }
// Supports both session auth (manual) and cron auth (scheduled)
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
    }

    const syncSource = isCronAuth ? 'cron' : 'manual';
    console.log(`[Trades Sync] Starting ${syncSource} sync at ${new Date().toISOString()}`);

    const body = await request.json().catch(() => ({}));
    const { date, backfillDays, today: syncToday } = body;

    // Support ?today=true query param for GET requests (cron)
    const url = new URL(request.url);
    const isTodaySync = syncToday || url.searchParams.get('today') === 'true';

    const stClient = getServiceTitanClient();
    if (!stClient.isConfigured()) {
      return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
    }

    const supabase = getServerSupabase();
    const results: { date: string; success: boolean; error?: string }[] = [];

    // Determine dates to sync
    const datesToSync: string[] = [];

    if (backfillDays && backfillDays > 0) {
      // Backfill mode: sync multiple days
      const now = new Date();
      for (let i = 1; i <= backfillDays; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        datesToSync.push(getLocalDateString(d));
      }
    } else if (date) {
      datesToSync.push(date);
    } else if (isTodaySync) {
      // Sync today's data (for 10-min cron)
      datesToSync.push(getLocalDateString(new Date()));
    } else {
      // Default: sync yesterday
      datesToSync.push(getYesterdayDateString());
    }

    // Process each date
    for (const syncDate of datesToSync) {
      try {
        // Fetch trade metrics from ServiceTitan for this date
        const metrics = await stClient.getTradeMetrics(syncDate);

        // Prepare rows to upsert
        const rows = [
          // HVAC aggregate (no department)
          {
            snapshot_date: syncDate,
            trade: 'hvac',
            department: null,
            revenue: metrics.hvac.revenue,
            completed_revenue: metrics.hvac.completedRevenue,
            non_job_revenue: metrics.hvac.nonJobRevenue,
            adj_revenue: metrics.hvac.adjRevenue,
            sales: metrics.hvac.sales,
          },
          // HVAC Install
          {
            snapshot_date: syncDate,
            trade: 'hvac',
            department: 'install',
            revenue: metrics.hvac.departments?.install?.revenue || 0,
            completed_revenue: metrics.hvac.departments?.install?.completedRevenue || 0,
            non_job_revenue: metrics.hvac.departments?.install?.nonJobRevenue || 0,
            adj_revenue: metrics.hvac.departments?.install?.adjRevenue || 0,
            sales: metrics.hvac.departments?.install?.sales || 0,
          },
          // HVAC Service
          {
            snapshot_date: syncDate,
            trade: 'hvac',
            department: 'service',
            revenue: metrics.hvac.departments?.service?.revenue || 0,
            completed_revenue: metrics.hvac.departments?.service?.completedRevenue || 0,
            non_job_revenue: metrics.hvac.departments?.service?.nonJobRevenue || 0,
            adj_revenue: metrics.hvac.departments?.service?.adjRevenue || 0,
            sales: metrics.hvac.departments?.service?.sales || 0,
          },
          // HVAC Maintenance
          {
            snapshot_date: syncDate,
            trade: 'hvac',
            department: 'maintenance',
            revenue: metrics.hvac.departments?.maintenance?.revenue || 0,
            completed_revenue: metrics.hvac.departments?.maintenance?.completedRevenue || 0,
            non_job_revenue: metrics.hvac.departments?.maintenance?.nonJobRevenue || 0,
            adj_revenue: metrics.hvac.departments?.maintenance?.adjRevenue || 0,
            sales: metrics.hvac.departments?.maintenance?.sales || 0,
          },
          // Plumbing (no department breakdown)
          {
            snapshot_date: syncDate,
            trade: 'plumbing',
            department: null,
            revenue: metrics.plumbing.revenue,
            completed_revenue: metrics.plumbing.completedRevenue,
            non_job_revenue: metrics.plumbing.nonJobRevenue,
            adj_revenue: metrics.plumbing.adjRevenue,
            sales: metrics.plumbing.sales,
          },
        ];

        // Delete existing rows for this date, then insert new ones
        // (upsert doesn't work with COALESCE-based unique index for NULL handling)
        const { error: deleteError } = await supabase
          .from('trade_daily_snapshots')
          .delete()
          .eq('snapshot_date', syncDate);

        if (deleteError) {
          console.error(`Error deleting old snapshots for ${syncDate}:`, deleteError);
          results.push({ date: syncDate, success: false, error: deleteError.message });
          continue;
        }

        const { error: insertError } = await supabase
          .from('trade_daily_snapshots')
          .insert(rows);

        if (insertError) {
          console.error(`Error inserting trade snapshots for ${syncDate}:`, insertError);
          results.push({ date: syncDate, success: false, error: insertError.message });
        } else {
          results.push({ date: syncDate, success: true });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error syncing trade data for ${syncDate}:`, err);
        results.push({ date: syncDate, success: false, error: errorMsg });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      message: `Synced ${successCount} days, ${failCount} failed`,
      results,
    });
  } catch (error) {
    console.error('Error in trade sync:', error);
    return NextResponse.json({ error: 'Failed to sync trade data' }, { status: 500 });
  }
}

// GET /api/trades/sync - Vercel cron jobs send GET requests, delegate to POST handler
export async function GET(request: NextRequest) {
  return POST(request);
}
