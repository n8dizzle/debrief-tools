import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { hasAPPermission, formatLocalDate } from '@/lib/ap-utils';

/**
 * GET /api/payroll-periods — distinct ServiceTitan pay cycles (most recent first).
 * ST returns one payroll row per employee per cycle; we dedupe to {start, end} date
 * ranges so the Install Jobs tab can filter by pay period.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_view_jobs')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const st = getServiceTitanClient();
  if (!st.isConfigured()) return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });

  // Look back ~6 months so the dropdown stays light.
  const since = formatLocalDate(new Date(Date.now() - 183 * 24 * 60 * 60 * 1000));
  const rows = await st.getPayrollPeriods(since);

  // Dedupe by date-only start|end (ST values are its own period boundaries — slice, don't convert).
  const seen = new Map<string, { start: string; end: string }>();
  for (const r of rows) {
    if (!r.startedOn || !r.endedOn) continue;
    const start = r.startedOn.slice(0, 10);
    const end = r.endedOn.slice(0, 10);
    seen.set(`${start}|${end}`, { start, end });
  }

  const periods = Array.from(seen.values())
    .sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0))
    .slice(0, 16);

  return NextResponse.json(periods);
}
