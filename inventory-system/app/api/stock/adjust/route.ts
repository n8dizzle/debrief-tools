import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { adjustStock } from '@/lib/services/material-movements';
import { errorResponse, AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const body = (await req.json()) as {
      material_id?: string;
      warehouse_id?: string | null;
      truck_id?: string | null;
      new_quantity?: number;
      notes?: string;
    };
    if (!body.material_id || body.new_quantity === undefined || !body.notes) {
      throw new AppError('material_id, new_quantity, notes required', 400);
    }
    if (!body.warehouse_id && !body.truck_id) {
      throw new AppError('Either warehouse_id or truck_id is required', 400);
    }
    const result = await adjustStock({
      material_id: body.material_id,
      warehouse_id: body.warehouse_id ?? null,
      truck_id: body.truck_id ?? null,
      new_quantity: body.new_quantity,
      notes: body.notes,
      performed_by: user.id,
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
