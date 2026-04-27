import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { getWarehouseStock } from '@/lib/services/material-movements';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ warehouseId: string }> }) {
  try {
    await getAuthedUser(req);
    const { warehouseId } = await params;
    const sp = req.nextUrl.searchParams;
    const rows = await getWarehouseStock(warehouseId, {
      category: sp.get('category'),
      belowReorder: sp.get('below_reorder') === 'true',
    });
    return NextResponse.json({ stock: rows });
  } catch (e) {
    return errorResponse(e);
  }
}
