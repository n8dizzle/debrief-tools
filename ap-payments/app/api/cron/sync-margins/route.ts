import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { isValidCronRequest, formatLocalDate } from '@/lib/ap-utils';

export const maxDuration = 300;

/**
 * Pull per-job cost buckets + gross margin from ServiceTitan report 33240339 and write them onto
 * ap_install_jobs (st_revenue, st_*_cost, st_gross_margin, st_gross_margin_pct, costs_synced_at).
 *
 * Kept separate from /api/cron/sync (the 60s job sync) so a slow/failing margin pull can't take
 * down the core job sync. Joins report rows → jobs by job_number (the report's "InvoiceNumber"
 * field carries the job number in this tenant — see getJobMarginReport).
 *
 * Date window: ?start=YYYY-MM-DD&end=YYYY-MM-DD for an explicit backfill, otherwise the last
 * `days_back` days (default 45, wide enough to keep recently-completed jobs fresh as ST
 * recalculates costs for a few days after completion).
 */
async function handle(request: NextRequest) {
  const isCron = isValidCronRequest(request);
  if (!isCron) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = session.user.role || 'employee';
    if (role !== 'owner' && role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const supabase = getServerSupabase();
  const st = getServiceTitanClient();

  if (!st.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');
  const daysBack = parseInt(searchParams.get('days_back') || '45', 10);

  const today = new Date();
  const end = endParam || formatLocalDate(today);
  const start =
    startParam ||
    formatLocalDate(new Date(today.getTime() - daysBack * 24 * 60 * 60 * 1000));

  const { data: syncLog } = await supabase
    .from('ap_sync_log')
    .insert({ sync_type: 'margins', started_at: new Date().toISOString(), status: 'running' })
    .select()
    .single();
  const syncId = syncLog?.id;

  let matched = 0;
  let unmatched = 0;
  const errors: string[] = [];

  try {
    const report = await st.getJobMarginReport(start, end);

    if (report.size === 0) {
      if (syncId) {
        await supabase
          .from('ap_sync_log')
          .update({
            completed_at: new Date().toISOString(),
            jobs_processed: 0,
            status: 'completed',
            errors: 'No report rows in window',
          })
          .eq('id', syncId);
      }
      return NextResponse.json({ success: true, window: { start, end }, report_rows: 0, matched: 0 });
    }

    const jobNumbers = Array.from(report.keys());

    // Which of those job_numbers actually exist in AP (only update ours).
    const existing = new Set<string>();
    const CHUNK = 200;
    for (let i = 0; i < jobNumbers.length; i += CHUNK) {
      const batch = jobNumbers.slice(i, i + CHUNK);
      const { data } = await supabase
        .from('ap_install_jobs')
        .select('job_number')
        .in('job_number', batch);
      for (const row of data || []) existing.add(String(row.job_number));
    }

    const syncedAt = new Date().toISOString();
    for (const jobNumber of jobNumbers) {
      if (!existing.has(jobNumber)) {
        unmatched++;
        continue;
      }
      const r = report.get(jobNumber)!;
      try {
        const { error } = await supabase
          .from('ap_install_jobs')
          .update({
            st_revenue: r.revenue,
            st_equipment_cost: r.equipmentCost,
            st_material_cost: r.materialCost,
            st_labor_cost: r.laborCost,
            st_total_cost: r.totalCost,
            st_gross_margin: r.grossMargin,
            st_gross_margin_pct: r.grossMarginPct,
            costs_synced_at: syncedAt,
          })
          .eq('job_number', jobNumber);
        if (error) {
          errors.push(`${jobNumber}: ${error.message}`);
        } else {
          matched++;
        }
      } catch (err) {
        errors.push(`${jobNumber}: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    if (syncId) {
      await supabase
        .from('ap_sync_log')
        .update({
          completed_at: new Date().toISOString(),
          jobs_processed: report.size,
          jobs_updated: matched,
          status: 'completed',
          errors: errors.length > 0 ? errors.slice(0, 50).join('\n') : null,
        })
        .eq('id', syncId);
    }

    console.log(`Margin sync ${start}→${end}: ${report.size} report rows, ${matched} matched, ${unmatched} not in AP`);
    return NextResponse.json({
      success: true,
      window: { start, end },
      report_rows: report.size,
      matched,
      unmatched,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Margin sync failed:', msg);
    if (syncId) {
      await supabase
        .from('ap_sync_log')
        .update({ completed_at: new Date().toISOString(), errors: msg, status: 'failed' })
        .eq('id', syncId);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handle(request);
}

// Support both GET and POST for Vercel cron
export async function GET(request: NextRequest) {
  return handle(request);
}
