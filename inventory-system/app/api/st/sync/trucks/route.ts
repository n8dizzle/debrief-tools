import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { syncVehicles } from '@/lib/services/st';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const result = await syncVehicles();
    return NextResponse.json({ message: 'Truck sync complete', result });
  } catch (e) {
    return errorResponse(e);
  }
}
