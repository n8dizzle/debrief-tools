import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { listBatches } from '@/lib/services/restock-batches';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await getAuthedUser(req);
    const sp = req.nextUrl.searchParams;
    const rows = await listBatches({
      status: sp.get('status'),
      truckId: sp.get('truck_id'),
      warehouseId: sp.get('warehouse_id'),
      limit: parseInt(sp.get('limit') ?? '50', 10),
      offset: parseInt(sp.get('offset') ?? '0', 10),
    });
    return NextResponse.json({ batches: rows });
  } catch (e) {
    return errorResponse(e);
  }
}
