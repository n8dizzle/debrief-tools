import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { listEquipment } from '@/lib/services/equipment';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await getAuthedUser(req);
    const sp = req.nextUrl.searchParams;
    const rows = await listEquipment({
      status: sp.get('status'),
      department: sp.get('department'),
      warehouseId: sp.get('warehouse_id'),
      search: sp.get('search'),
      limit: parseInt(sp.get('limit') ?? '50', 10),
      offset: parseInt(sp.get('offset') ?? '0', 10),
    });
    return NextResponse.json({ equipment: rows });
  } catch (e) {
    return errorResponse(e);
  }
}
