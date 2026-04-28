import { NextResponse, type NextRequest } from 'next/server';
import { checkCronSecret } from '@/lib/cron-guard';
import { runWeeklyPO } from '@/lib/services/admin-jobs';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Weekly — generate draft POs for materials below reorder point. */
export async function GET(req: NextRequest) {
  const denied = checkCronSecret(req);
  if (denied) return denied;
  try {
    const result = await runWeeklyPO('scheduled');
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return errorResponse(e);
  }
}
