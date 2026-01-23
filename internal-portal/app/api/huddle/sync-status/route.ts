import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/huddle/sync-status - Get sync status and data completeness
export async function GET(request: NextRequest) {
  try {
    // Check for cron secret (for scheduled jobs and testing)
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

    // Get last sync info (any huddle sync type)
    const { data: lastSync } = await supabase
      .from('dash_sync_log')
      .select('*')
      .like('sync_type', 'huddle%')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    // Get last cron sync specifically
    const { data: lastCronSync } = await supabase
      .from('dash_sync_log')
      .select('*')
      .like('sync_type', 'huddle_cron%')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    // Calculate completeness percentage
    const completenessPercent = expectedDates.length > 0
      ? Math.round((existingDates.size / expectedDates.length) * 100)
      : 100;

    return NextResponse.json({
      month: targetMonth,
      dataCompleteness: {
        expectedDays: expectedDates.length,
        actualDays: existingDates.size,
        missingDays: missingDates.length,
        completenessPercent,
        missingDates: missingDates.slice(0, 10), // Limit to first 10
        hasMoreMissing: missingDates.length > 10,
      },
      lastSync: lastSync ? {
        startedAt: lastSync.started_at,
        completedAt: lastSync.completed_at,
        status: lastSync.status,
        type: lastSync.sync_type,
      } : null,
      lastCronSync: lastCronSync ? {
        startedAt: lastCronSync.started_at,
        completedAt: lastCronSync.completed_at,
        status: lastCronSync.status,
      } : null,
      isDataComplete: missingDates.length === 0,
    });
  } catch (error) {
    console.error('Error checking sync status:', error);
    return NextResponse.json(
      { error: 'Failed to check sync status' },
      { status: 500 }
    );
  }
}
