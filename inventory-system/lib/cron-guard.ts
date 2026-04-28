import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Verify a cron-route call. Vercel cron sends `Authorization: Bearer <CRON_SECRET>`
 * automatically. Manual invocations from `curl` etc. need to pass the same header.
 *
 * Returns null if authorized, otherwise a 401 NextResponse to return immediately.
 */
export function checkCronSecret(req: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error('[cron] CRON_SECRET is not set — refusing all cron calls.');
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }
  const header = req.headers.get('authorization');
  if (header !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
