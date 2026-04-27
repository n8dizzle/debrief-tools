import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { updateEquipmentLocation } from '@/lib/services/equipment';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager', 'warehouse_staff');
    const { id } = await params;
    const body = (await req.json()) as { warehouse_id?: string | null; warehouse_location_id?: string | null };
    const row = await updateEquipmentLocation(id, body.warehouse_id ?? null, body.warehouse_location_id ?? null);
    return NextResponse.json({ equipment: row });
  } catch (e) {
    return errorResponse(e);
  }
}
