import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { getTruck, updateTruck, type TruckInput } from '@/lib/services/trucks';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getAuthedUser(req);
    const { id } = await params;
    const row = await getTruck(id);
    return NextResponse.json({ truck: row });
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
    requireRole(user, 'admin', 'warehouse_manager');
    const { id } = await params;
    const body = (await req.json()) as TruckInput;
    const row = await updateTruck(id, body);
    return NextResponse.json({ truck: row });
  } catch (e) {
    return errorResponse(e);
  }
}
