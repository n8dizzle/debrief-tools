import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { updatePOLine, deletePOLine } from '@/lib/services/purchase-orders';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const { lineId } = await params;
    const body = (await req.json()) as {
      quantity_ordered?: number;
      unit_cost?: number;
      notes?: string;
      backorder_routed_to?: string;
    };
    const line = await updatePOLine(lineId, body);
    return NextResponse.json({ line });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const { id, lineId } = await params;
    await deletePOLine(id, lineId);
    return NextResponse.json({ message: 'Line removed' });
  } catch (e) {
    return errorResponse(e);
  }
}
