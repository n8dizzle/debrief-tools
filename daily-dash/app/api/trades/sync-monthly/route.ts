import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { getLocalDateString } from '@/lib/huddle-utils';

interface MonthSyncResult {
  yearMonth: string;
  hvacRevenue: number;
  plumbingRevenue: number;
  success: boolean;
  error?: string;
}

// POST /api/trades/sync-monthly - Sync monthly revenue snapshots for trend chart
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

      // Only owners can trigger monthly sync
      const { role } = session.user;
      if (role !== 'owner') {
        return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const { months, backfillMonths } = body;

    const supabase = getServerSupabase();
    const stClient = getServiceTitanClient();

    if (!stClient.isConfigured()) {
      return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
    }

    // Determine which months to sync
    let monthsToSync: string[] = [];
    const today = new Date();

    if (months && Array.isArray(months)) {
      // Sync specific months provided
      monthsToSync = months;
    } else if (backfillMonths && typeof backfillMonths === 'number') {
      // Backfill N months from current
      for (let i = 0; i < backfillMonths; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        monthsToSync.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    } else {
      // Default: sync previous month and 2 months back (for late adjustments)
      for (let i = 1; i <= 3; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        monthsToSync.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    }

    // Log sync start
    const { data: syncLog } = await supabase
      .from('dash_sync_log')
      .insert({
        sync_type: 'trade_monthly_sync',
        status: 'running',
        records_synced: 0,
      })
      .select()
      .single();

    const results: MonthSyncResult[] = [];
    let successCount = 0;

    // Process each month
    for (const yearMonth of monthsToSync) {
      const [yearStr, monthStr] = yearMonth.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);

      // Calculate date range for the month
      const firstOfMonth = new Date(year, month - 1, 1);
      const lastOfMonth = new Date(year, month, 0);

      // Don't sync future months
      if (firstOfMonth > today) {
        results.push({
          yearMonth,
          hvacRevenue: 0,
          plumbingRevenue: 0,
          success: false,
          error: 'Future month',
        });
        continue;
      }

      // For current month, only sync up to yesterday (current month should use live data)
      const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      if (yearMonth === currentMonthKey) {
        results.push({
          yearMonth,
          hvacRevenue: 0,
          plumbingRevenue: 0,
          success: false,
          error: 'Current month - use live data',
        });
        continue;
      }

      // For months in progress (shouldn't happen with current logic), cap at today
      const endDate = lastOfMonth > today ? today : lastOfMonth;
      const startStr = getLocalDateString(firstOfMonth);
      const endStr = getLocalDateString(endDate);

      try {
        console.log(`Syncing ${yearMonth}: ${startStr} to ${endStr}`);
        const metrics = await stClient.getTradeMetrics(startStr, endStr);

        // Upsert HVAC
        await supabase.from('trade_monthly_snapshots').upsert(
          {
            year_month: yearMonth,
            trade: 'hvac',
            revenue: metrics.hvac.revenue,
            completed_revenue: metrics.hvac.completedRevenue,
            non_job_revenue: metrics.hvac.nonJobRevenue,
            adj_revenue: metrics.hvac.adjRevenue,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'year_month,trade' }
        );

        // Upsert Plumbing
        await supabase.from('trade_monthly_snapshots').upsert(
          {
            year_month: yearMonth,
            trade: 'plumbing',
            revenue: metrics.plumbing.revenue,
            completed_revenue: metrics.plumbing.completedRevenue,
            non_job_revenue: metrics.plumbing.nonJobRevenue,
            adj_revenue: metrics.plumbing.adjRevenue,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'year_month,trade' }
        );

        results.push({
          yearMonth,
          hvacRevenue: metrics.hvac.revenue,
          plumbingRevenue: metrics.plumbing.revenue,
          success: true,
        });
        successCount++;

        // Rate limit to avoid API throttling
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`Error syncing ${yearMonth}:`, err);
        results.push({
          yearMonth,
          hvacRevenue: 0,
          plumbingRevenue: 0,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
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
          records_synced: successCount * 2, // 2 records per month (hvac + plumbing)
        })
        .eq('id', syncLog.id);
    }

    return NextResponse.json({
      success: true,
      monthsSynced: successCount,
      totalMonths: monthsToSync.length,
      results,
    });
  } catch (error) {
    console.error('Error in monthly sync:', error);
    return NextResponse.json({ error: 'Failed to sync monthly data' }, { status: 500 });
  }
}

// GET /api/trades/sync-monthly - Get sync status and cached months
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();

    // Get all cached monthly snapshots
    const { data: snapshots, error } = await supabase
      .from('trade_monthly_snapshots')
      .select('*')
      .order('year_month', { ascending: false });

    if (error) {
      console.error('Error fetching monthly snapshots:', error);
      return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
    }

    // Get last sync info
    const { data: lastSync } = await supabase
      .from('dash_sync_log')
      .select('*')
      .eq('sync_type', 'trade_monthly_sync')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    // Group by month
    const monthlyData: Record<string, { hvac: number; plumbing: number; syncedAt: string }> = {};
    snapshots?.forEach((s) => {
      if (!monthlyData[s.year_month]) {
        monthlyData[s.year_month] = { hvac: 0, plumbing: 0, syncedAt: s.synced_at };
      }
      if (s.trade === 'hvac') {
        monthlyData[s.year_month].hvac = Number(s.revenue);
      } else if (s.trade === 'plumbing') {
        monthlyData[s.year_month].plumbing = Number(s.revenue);
      }
    });

    return NextResponse.json({
      cachedMonths: Object.keys(monthlyData).length,
      data: monthlyData,
      lastSync: lastSync
        ? {
            startedAt: lastSync.started_at,
            completedAt: lastSync.completed_at,
            status: lastSync.status,
            recordsSynced: lastSync.records_synced,
          }
        : null,
    });
  } catch (error) {
    console.error('Error getting monthly sync status:', error);
    return NextResponse.json({ error: 'Failed to get sync status' }, { status: 500 });
  }
}
