import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { getDashboardStats } from '@/lib/services/admin-stats';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (e) {
    return errorResponse(e);
  }
}
