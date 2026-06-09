import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// POST/GET /api/scorecard/sync - Aggregate last week's daily snapshots into weekly_scorecard
// Runs Monday 8am CT via cron, or manually via button
export async function POST(request: NextRequest) {
  // Auth: cron secret or session
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronAuth) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = getServerSupabase();

  // Determine which week to aggregate
  // Default: the most recently completed week (Mon-Sun)
  const url = new URL(request.url);
  const weekParam = url.searchParams.get('week');
  const yearParam = url.searchParams.get('year');

  let targetSunday: Date;
  if (weekParam && yearParam) {
    // Find the Sunday ending the specified week
    // Week 1 starts on the first Monday of the year
    const jan1 = new Date(parseInt(yearParam), 0, 1);
    const firstMonday = new Date(jan1);
    firstMonday.setDate(jan1.getDate() + ((8 - jan1.getDay()) % 7));
    targetSunday = new Date(firstMonday);
    targetSunday.setDate(firstMonday.getDate() + (parseInt(weekParam) - 1) * 7 + 6);
  } else {
    // Find last Sunday
    const now = new Date();
    const centralTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const daysSinceSunday = centralTime.getDay(); // 0=Sun, 1=Mon, etc.
    targetSunday = new Date(centralTime);
    targetSunday.setDate(centralTime.getDate() - daysSinceSunday);
  }

  const sundayStr = `${targetSunday.getFullYear()}-${String(targetSunday.getMonth() + 1).padStart(2, '0')}-${String(targetSunday.getDate()).padStart(2, '0')}`;
  const monday = new Date(targetSunday);
  monday.setDate(targetSunday.getDate() - 6);
  const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;

  console.log(`[Scorecard Sync] Aggregating week ${mondayStr} to ${sundayStr}`);

  // Determine week number (sequential from Jan 1)
  const jan1 = new Date(targetSunday.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((targetSunday.getTime() - jan1.getTime()) / 86400000) + 1;
  const weekNumber = Math.ceil(dayOfYear / 7);
  const year = targetSunday.getFullYear();

  // Fetch daily snapshots for Mon-Sun
  const { data: dailySnaps, error: snapError } = await supabase
    .from('trade_daily_snapshots')
    .select('*')
    .gte('snapshot_date', mondayStr)
    .lte('snapshot_date', sundayStr);

  if (snapError) {
    console.error('[Scorecard Sync] Error fetching daily snapshots:', snapError);
    return NextResponse.json({ error: snapError.message }, { status: 500 });
  }

  if (!dailySnaps?.length) {
    return NextResponse.json({ message: 'No daily snapshots found for this week', week: weekNumber, range: `${mondayStr} to ${sundayStr}` });
  }

  // Aggregate by trade/department
  type Agg = {
    revenue: number; completed_revenue: number; non_job_revenue: number; adj_revenue: number;
    sales: number; jobs_ran: number;
  };
  const aggs = new Map<string, Agg>();

  for (const snap of dailySnaps) {
    const key = `${snap.trade}|${snap.department || ''}`;
    const existing = aggs.get(key) || { revenue: 0, completed_revenue: 0, non_job_revenue: 0, adj_revenue: 0, sales: 0, jobs_ran: 0 };
    existing.revenue += Number(snap.revenue) || 0;
    existing.completed_revenue += Number(snap.completed_revenue) || 0;
    existing.non_job_revenue += Number(snap.non_job_revenue) || 0;
    existing.adj_revenue += Number(snap.adj_revenue) || 0;
    existing.sales += Number(snap.sales) || 0;
    aggs.set(key, existing);
  }

  // Build upsert rows
  const rows: any[] = [];

  // Company totals (sum of all trades, null department only)
  const hvacTotal = aggs.get('hvac|') || { revenue: 0, completed_revenue: 0, non_job_revenue: 0, adj_revenue: 0, sales: 0, jobs_ran: 0 };
  const plumbTotal = aggs.get('plumbing|') || { revenue: 0, completed_revenue: 0, non_job_revenue: 0, adj_revenue: 0, sales: 0, jobs_ran: 0 };

  const companyRevenue = hvacTotal.revenue + plumbTotal.revenue;
  const companySales = hvacTotal.sales + plumbTotal.sales;

  rows.push({
    year, week_number: weekNumber, week_ending: sundayStr,
    trade: 'company', department: null,
    revenue: companyRevenue,
    completed_revenue: hvacTotal.completed_revenue + plumbTotal.completed_revenue,
    non_job_revenue: hvacTotal.non_job_revenue + plumbTotal.non_job_revenue,
    adj_revenue: hvacTotal.adj_revenue + plumbTotal.adj_revenue,
    sales: companySales,
    data_source: 'sync',
  });

  // HVAC total
  rows.push({
    year, week_number: weekNumber, week_ending: sundayStr,
    trade: 'hvac', department: null,
    revenue: hvacTotal.revenue,
    completed_revenue: hvacTotal.completed_revenue,
    non_job_revenue: hvacTotal.non_job_revenue,
    adj_revenue: hvacTotal.adj_revenue,
    sales: hvacTotal.sales,
    data_source: 'sync',
  });

  // HVAC departments
  for (const dept of ['install', 'service', 'maintenance', 'sales']) {
    const a = aggs.get(`hvac|${dept}`);
    if (a) {
      rows.push({
        year, week_number: weekNumber, week_ending: sundayStr,
        trade: 'hvac', department: dept,
        revenue: a.revenue,
        completed_revenue: a.completed_revenue,
        non_job_revenue: a.non_job_revenue,
        adj_revenue: a.adj_revenue,
        sales: a.sales,
        data_source: 'sync',
      });
    }
  }

  // Plumbing
  rows.push({
    year, week_number: weekNumber, week_ending: sundayStr,
    trade: 'plumbing', department: null,
    revenue: plumbTotal.revenue,
    completed_revenue: plumbTotal.completed_revenue,
    non_job_revenue: plumbTotal.non_job_revenue,
    adj_revenue: plumbTotal.adj_revenue,
    sales: plumbTotal.sales,
    data_source: 'sync',
  });

  // Upsert
  const { error: upsertError } = await supabase
    .from('weekly_scorecard')
    .upsert(rows, { onConflict: 'year,week_number,trade,department' });

  if (upsertError) {
    console.error('[Scorecard Sync] Upsert error:', upsertError);
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  console.log(`[Scorecard Sync] Upserted ${rows.length} rows for WK ${weekNumber} (${mondayStr} to ${sundayStr})`);

  return NextResponse.json({
    success: true,
    year,
    week: weekNumber,
    range: `${mondayStr} to ${sundayStr}`,
    rows: rows.length,
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
