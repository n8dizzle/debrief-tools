import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { getLocalDateString } from '@/lib/huddle-utils';

// POST /api/trades/backfill-jobs
// Backfills jobs_ran into existing trade_daily_snapshots rows.
// Fetches completed jobs in 14-day batches to minimize API calls,
// then buckets by day + BU and updates the snapshots.
// Body: { days?: number } (default 100)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronAuth) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const stClient = getServiceTitanClient();
  if (!stClient.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }

  const supabase = getServerSupabase();
  const body = await request.json().catch(() => ({}));
  const totalDays = body.days || 100;
  const batchSize = 14; // 2-week batches

  // Get BU mapping
  const businessUnits = await stClient.getBusinessUnits();
  const buIdToName = new Map<number, string>();
  for (const bu of businessUnits) {
    buIdToName.set(bu.id, bu.name);
  }

  // Known BU lists (imported from servicetitan.ts constants)
  const HVAC_BUS = [
    'HVAC - Install', 'HVAC - Service', 'HVAC - Maintenance', 'HVAC - Sales',
    'Mims - Service',
    'z-DNU - Christmas HVAC- Install', 'z-DNU - Christmas HVAC- Service',
    'z DNU Imported Default Businessunit',
  ];
  const PLUMBING_BUS = ['Plumbing - Install', 'Plumbing - Service', 'Plumbing - Maintenance', 'Plumbing - Sales'];
  const HVAC_DEPT_MAP: Record<string, string> = {
    'HVAC - Install': 'install', 'HVAC - Service': 'service', 'HVAC - Maintenance': 'maintenance',
    'HVAC - Sales': 'sales', 'Mims - Service': 'service',
    'z-DNU - Christmas HVAC- Install': 'install', 'z-DNU - Christmas HVAC- Service': 'service',
    'z DNU Imported Default Businessunit': 'service',
  };

  const results: { batch: string; jobsFetched: number; daysUpdated: number }[] = [];
  let totalUpdated = 0;

  // Process in batches
  for (let offset = 0; offset < totalDays; offset += batchSize) {
    const batchEnd = Math.min(offset + batchSize, totalDays);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() - offset);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (batchEnd - 1));

    const startStr = getLocalDateString(startDate);
    const endDateStr = getLocalDateString(endDate);
    const dayAfterEnd = getLocalDateString(new Date(endDate.getTime() + 86400000));

    console.log(`[Backfill Jobs] Fetching ${startStr} to ${endDateStr}...`);

    try {
      const jobs = await stClient.getCompletedJobs(startStr, dayAfterEnd);

      // Bucket by date + trade + department
      // Key: "YYYY-MM-DD|trade|department"
      const jobCounts = new Map<string, number>();

      for (const job of jobs) {
        const buName = buIdToName.get(job.businessUnitId);
        if (!buName) continue;

        const isHvac = HVAC_BUS.includes(buName);
        const isPlumbing = PLUMBING_BUS.includes(buName);
        if (!isHvac && !isPlumbing) continue;

        // Extract date from completedOn (format: "2026-06-15T14:30:00Z" or similar)
        const completedDate = job.completedOn?.split('T')[0];
        if (!completedDate) continue;

        const trade = isHvac ? 'hvac' : 'plumbing';

        // Trade total
        const tradeKey = `${completedDate}|${trade}|`;
        jobCounts.set(tradeKey, (jobCounts.get(tradeKey) || 0) + 1);

        // Department (HVAC only)
        if (isHvac) {
          const dept = HVAC_DEPT_MAP[buName];
          if (dept) {
            const deptKey = `${completedDate}|hvac|${dept}`;
            jobCounts.set(deptKey, (jobCounts.get(deptKey) || 0) + 1);
          }
        }
      }

      // Update trade_daily_snapshots for each date/trade/department
      let batchUpdated = 0;
      for (const [key, count] of jobCounts) {
        const [date, trade, department] = key.split('|');

        let query = supabase
          .from('trade_daily_snapshots')
          .update({ jobs_ran: count })
          .eq('snapshot_date', date)
          .eq('trade', trade);

        if (department) {
          query = query.eq('department', department);
        } else {
          query = query.is('department', null);
        }

        const { error } = await query;
        if (!error) batchUpdated++;
      }

      totalUpdated += batchUpdated;
      results.push({
        batch: `${startStr} to ${endDateStr}`,
        jobsFetched: jobs.length,
        daysUpdated: batchUpdated,
      });

      console.log(`[Backfill Jobs] ${startStr}-${endDateStr}: ${jobs.length} jobs, updated ${batchUpdated} rows`);

      // Brief pause between batches to avoid rate limits
      if (offset + batchSize < totalDays) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[Backfill Jobs] Error for batch ${startStr}-${endDateStr}:`, msg);
      results.push({ batch: `${startStr} to ${endDateStr}`, jobsFetched: 0, daysUpdated: 0 });

      // If rate limited, wait longer
      if (msg.includes('429')) {
        console.log('[Backfill Jobs] Rate limited, waiting 65s...');
        await new Promise(resolve => setTimeout(resolve, 65000));
      }
    }
  }

  return NextResponse.json({
    success: true,
    totalDaysUpdated: totalUpdated,
    batches: results,
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
