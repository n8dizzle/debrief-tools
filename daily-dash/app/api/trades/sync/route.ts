import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';

// Helper to get yesterday's date string
function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// POST /api/trades/sync - Sync trade metrics for a specific date
// Body: { date?: string, backfillDays?: number }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { date, backfillDays } = body;

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
      const today = new Date();
      for (let i = 1; i <= backfillDays; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        datesToSync.push(d.toISOString().split('T')[0]);
      }
    } else {
      // Single date mode
      datesToSync.push(date || getYesterdayDateString());
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
          },
        ];

        // Upsert into Supabase
        const { error: upsertError } = await supabase
          .from('trade_daily_snapshots')
          .upsert(rows, {
            onConflict: 'snapshot_date,trade,department',
          });

        if (upsertError) {
          console.error(`Error upserting trade snapshots for ${syncDate}:`, upsertError);
          results.push({ date: syncDate, success: false, error: upsertError.message });
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

// GET /api/trades/sync - Check what dates have been synced
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('trade_daily_snapshots')
      .select('snapshot_date')
      .eq('trade', 'hvac')
      .is('department', null) // Just check one row per date
      .order('snapshot_date', { ascending: false });

    if (startDate) {
      query = query.gte('snapshot_date', startDate);
    }
    if (endDate) {
      query = query.lte('snapshot_date', endDate);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const syncedDates = data?.map(d => d.snapshot_date) || [];

    return NextResponse.json({
      syncedDates,
      count: syncedDates.length,
    });
  } catch (error) {
    console.error('Error checking sync status:', error);
    return NextResponse.json({ error: 'Failed to check sync status' }, { status: 500 });
  }
}
