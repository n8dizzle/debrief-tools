import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');

    if (!process.env.ST_CLIENT_ID || process.env.ST_CLIENT_ID === 'placeholder') {
      return NextResponse.json({
        ok: true,
        message: 'ServiceTitan credentials not configured — sync skipped.',
        synced: 0,
      });
    }

    // ST jobs sync — endpoint not yet implemented; the pricebook/equipment/technician
    // syncs at /api/st/sync/* cover the active integrations. Returning a stub keeps
    // the existing UI happy.
    return NextResponse.json({
      ok: true,
      message: 'ST jobs sync endpoint not yet implemented — use /api/st/sync/* for individual sync types.',
      result: null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
