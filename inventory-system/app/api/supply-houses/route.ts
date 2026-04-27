import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { listSupplyHouses, createSupplyHouse, type SupplyHouseInput } from '@/lib/services/supply-houses';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await getAuthedUser(req);
    const sp = req.nextUrl.searchParams;
    const ia = sp.get('is_active');
    const rows = await listSupplyHouses({
      department: sp.get('department'),
      isActive: ia === null ? null : ia === 'true',
    });
    return NextResponse.json({ supply_houses: rows });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const body = (await req.json()) as SupplyHouseInput;
    const row = await createSupplyHouse(body);
    return NextResponse.json({ supply_house: row }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
