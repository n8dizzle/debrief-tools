import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { listTrucks } from '@/lib/services/trucks';
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
