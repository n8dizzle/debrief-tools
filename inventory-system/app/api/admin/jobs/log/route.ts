import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { query } from '@/lib/db';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const sp = req.nextUrl.searchParams;
    const jobType = sp.get('job_type');
    const limit = parseInt(sp.get('limit') ?? '100', 10);

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (jobType) { params.push(jobType); conditions.push(`job_type = $${params.length}`); }
    params.push(limit);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query(
      `SELECT * FROM scheduled_job_log ${where} ORDER BY ran_at DESC LIMIT $${params.length}`,
      params,
    );
    return NextResponse.json({ log: rows });
  } catch (e) {
    return errorResponse(e);
  }
}
