import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { listJobs } from '@/lib/services/jobs';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await getAuthedUser(req);
    const sp = req.nextUrl.searchParams;
    const rows = await listJobs({
      truckId: sp.get('truck_id'),
      status: sp.get('status'),
      limit: parseInt(sp.get('limit') ?? '50', 10),
      offset: parseInt(sp.get('offset') ?? '0', 10),
    });
    return NextResponse.json({ jobs: rows });
  } catch (e) {
    return errorResponse(e);
  }
}
