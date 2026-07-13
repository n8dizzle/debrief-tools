import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { formatLocalDate } from '@/lib/sd-utils';
import { syncRecalls } from '@/lib/qc-recalls';

export const maxDuration = 300;

// POST/GET /api/cron/backfill-recalls
//   ?months=N            → walk N months (from N-1 months ago through now), month by month
//   ?from=YYYY-MM-DD&to= → sync a single explicit window (use this to cover history one
//                          month at a time and stay under the 300s function limit; idempotent)
// Under /api/cron so it's exempt from the auth middleware. Auth: CRON_SECRET bearer, or an
// owner/manager session. Idempotent (upserts by st_recall_job_id) — safe to re-run.
async function run(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!(cronSecret && authHeader === `Bearer ${cronSecret}`)) {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (role !== 'owner' && role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const supabase = getServerSupabase();
  const st = getServiceTitanClient();
  const serviceBUIds = await st.getServiceBusinessUnitIds();
  const allBUs = await st.getBusinessUnits();
  const buMap = new Map(allBUs.map(bu => [bu.id, bu]));

  // Build the list of [start,end] windows to process.
  const windows: { start: string; end: string }[] = [];
  const now = new Date();
  if (from && to) {
    windows.push({ start: from, end: to });
  } else {
    const months = Math.min(24, Math.max(1, parseInt(searchParams.get('months') || '12', 10) || 12));
    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); // last day of month
      windows.push({ start: formatLocalDate(start), end: formatLocalDate(end > now ? now : end) });
    }
  }

  const perWindow: { window: string; recalls: number; equipment: number }[] = [];
  const errors: string[] = [];
  let totalRecalls = 0, totalEquipment = 0;
  for (const w of windows) {
    try {
      const r = await syncRecalls(supabase, st, w.start, w.end, serviceBUIds, buMap);
      totalRecalls += r.recallsSynced;
      totalEquipment += r.equipmentSynced;
      errors.push(...r.errors);
      perWindow.push({ window: `${w.start}..${w.end}`, recalls: r.recallsSynced, equipment: r.equipmentSynced });
    } catch (e) {
      errors.push(`${w.start}..${w.end}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({
    total_recalls_synced: totalRecalls,
    total_equipment_synced: totalEquipment,
    per_window: perWindow,
    errors: errors.slice(0, 50),
  });
}

export async function GET(request: NextRequest) {
  try { return await run(request); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
export async function POST(request: NextRequest) { return GET(request); }
