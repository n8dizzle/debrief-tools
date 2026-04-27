import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { addPOLine } from '@/lib/services/purchase-orders';
import { errorResponse, AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const { id } = await params;
    const body = (await req.json()) as { material_id?: string; quantity_ordered?: number; unit_cost?: number; notes?: string };
    if (!body.material_id || !body.quantity_ordered) {
      throw new AppError('material_id and quantity_ordered are required', 400);
    }
    const line = await addPOLine(id, {
      material_id: body.material_id,
      quantity_ordered: body.quantity_ordered,
      unit_cost: body.unit_cost ?? null,
      notes: body.notes ?? null,
    });
    return NextResponse.json({ line }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
