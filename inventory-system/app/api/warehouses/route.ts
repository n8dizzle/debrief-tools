import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { listWarehouses, createWarehouse, type WarehouseInput } from '@/lib/services/warehouses';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await getAuthedUser(req);
    const rows = await listWarehouses();
    return NextResponse.json({ warehouses: rows });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin');
    const body = (await req.json()) as WarehouseInput;
    const row = await createWarehouse(body);
    return NextResponse.json({ warehouse: row }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
