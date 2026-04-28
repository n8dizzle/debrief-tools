import { NextResponse, type NextRequest } from 'next/server';
import { checkCronSecret } from '@/lib/cron-guard';
import { runBatchLock } from '@/lib/services/admin-jobs';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Daily — locks any restock batches still in 'collecting' status. */
export async function GET(req: NextRequest) {
  const denied = checkCronSecret(req);
  if (denied) return denied;
  try {
    const result = await runBatchLock('scheduled');
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return errorResponse(e);
  }
}
