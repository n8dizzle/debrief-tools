import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { formatLocalDate } from '@/lib/sd-utils';
import { syncRecalls } from '@/lib/qc-recalls';

export const maxDuration = 300;

// POST/GET /api/recalls/backfill?months=12
// Widened recall sync run month-by-month over a historical window, so Trends have
// real history. Idempotent (upserts by st_recall_job_id) — safe to re-run, and if a
// long window times out, call again with a narrower ?months or ?from/?to to resume.
// Auth: CRON_SECRET bearer, or an owner/manager session.
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
  const months = Math.min(24, Math.max(1, parseInt(searchParams.get('months') || '12', 10) || 12));

  const supabase = getServerSupabase();
  const st = getServiceTitanClient();
  const serviceBUIds = await st.getServiceBusinessUnitIds();
  const allBUs = await st.getBusinessUnits();
  const buMap = new Map(allBUs.map(bu => [bu.id, bu]));

  // Walk month by month from `months` ago to now (local-time boundaries, no Z/UTC).
  const now = new Date();
  const perMonth: { window: string; recalls: number; equipment: number }[] = [];
  const errors: string[] = [];
  let totalRecalls = 0, totalEquipment = 0;

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); // last day of that month
    const startStr = formatLocalDate(start);
    const endStr = formatLocalDate(end > now ? now : end);
    try {
      const r = await syncRecalls(supabase, st, startStr, endStr, serviceBUIds, buMap);
      totalRecalls += r.recallsSynced;
      totalEquipment += r.equipmentSynced;
      errors.push(...r.errors);
      perMonth.push({ window: `${startStr}..${endStr}`, recalls: r.recallsSynced, equipment: r.equipmentSynced });
    } catch (e) {
      errors.push(`${startStr}..${endStr}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({
    months,
    total_recalls_synced: totalRecalls,
    total_equipment_synced: totalEquipment,
    per_month: perMonth,
    errors: errors.slice(0, 50),
  });
}

export async function GET(request: NextRequest) {
  try { return await run(request); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
export async function POST(request: NextRequest) { return GET(request); }
