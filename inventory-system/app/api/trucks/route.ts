import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { listTrucks, createTruck, type TruckInput } from '@/lib/services/trucks';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await getAuthedUser(req);
    const sp = req.nextUrl.searchParams;
    const rows = await listTrucks({
      department: sp.get('department'),
      warehouseId: sp.get('warehouse_id'),
    });
    return NextResponse.json({ trucks: rows });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const body = (await req.json()) as TruckInput;
    const row = await createTruck(body);
    return NextResponse.json({ truck: row }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
