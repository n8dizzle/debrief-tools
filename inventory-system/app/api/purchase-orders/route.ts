import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { listPurchaseOrders, createPO, type CreatePOInput } from '@/lib/services/purchase-orders';
import { errorResponse, AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await getAuthedUser(req);
    const sp = req.nextUrl.searchParams;
    const rows = await listPurchaseOrders({
      status: sp.get('status'),
      department: sp.get('department'),
      warehouseId: sp.get('warehouse_id'),
      supplyHouseId: sp.get('supply_house_id'),
      limit: parseInt(sp.get('limit') ?? '50', 10),
      offset: parseInt(sp.get('offset') ?? '0', 10),
    });
    return NextResponse.json({ purchase_orders: rows });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const body = (await req.json()) as Partial<CreatePOInput>;
    if (!body.supply_house_id || !body.warehouse_id || !body.department || !body.trigger_type) {
      throw new AppError('supply_house_id, warehouse_id, department, trigger_type are required', 400);
    }
    const po = await createPO({ ...body, created_by: user.id } as CreatePOInput);
    return NextResponse.json({ purchase_order: po }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
