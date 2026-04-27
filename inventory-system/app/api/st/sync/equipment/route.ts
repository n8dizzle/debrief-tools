import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { syncEquipment } from '@/lib/services/st';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const result = await syncEquipment();
    return NextResponse.json({ message: 'Equipment sync complete', result });
  } catch (e) {
    return errorResponse(e);
  }
}
