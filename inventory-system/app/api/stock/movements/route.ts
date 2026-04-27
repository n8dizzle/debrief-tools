import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { listMovements, recordMovement, type RecordMovementInput } from '@/lib/services/material-movements';
import { errorResponse, AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await getAuthedUser(req);
    const sp = req.nextUrl.searchParams;
    const rows = await listMovements({
      materialId: sp.get('material_id'),
      truckId: sp.get('truck_id'),
      warehouseId: sp.get('warehouse_id'),
      movementType: sp.get('movement_type'),
      stJobId: sp.get('st_job_id'),
      limit: parseInt(sp.get('limit') ?? '100', 10),
      offset: parseInt(sp.get('offset') ?? '0', 10),
    });
    return NextResponse.json({ movements: rows });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    const body = (await req.json()) as Partial<RecordMovementInput>;
    if (!body.material_id || !body.movement_type || !body.quantity) {
      throw new AppError('material_id, movement_type, quantity required', 400);
    }
    const movement = await recordMovement({ ...body, performed_by: user.id } as RecordMovementInput);
    return NextResponse.json({ movement }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
