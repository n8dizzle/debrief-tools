import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { getWarehouse, updateWarehouse, type WarehouseInput } from '@/lib/services/warehouses';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getAuthedUser(req);
    const { id } = await params;
    const row = await getWarehouse(id);
    return NextResponse.json({ warehouse: row });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin');
    const { id } = await params;
    const body = (await req.json()) as WarehouseInput;
    const row = await updateWarehouse(id, body);
    return NextResponse.json({ warehouse: row });
  } catch (e) {
    return errorResponse(e);
  }
}
