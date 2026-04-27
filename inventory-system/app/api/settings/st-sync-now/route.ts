import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { syncPricebook, syncEquipment, syncTechnicians, syncVehicles } from '@/lib/services/st';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');

    if (!process.env.ST_CLIENT_ID || process.env.ST_CLIENT_ID === 'placeholder') {
      return NextResponse.json({
        ok: true,
        message: 'ServiceTitan credentials not configured — sync skipped.',
        synced: 0,
      });
    }

    const result = {
      pricebook: await syncPricebook().catch((e: Error) => ({ error: e.message })),
      equipment: await syncEquipment().catch((e: Error) => ({ error: e.message })),
      technicians: await syncTechnicians().catch((e: Error) => ({ error: e.message })),
      trucks: await syncVehicles(),
    };
    return NextResponse.json({ ok: true, message: 'ST sync triggered', result });
  } catch (e) {
    return errorResponse(e);
  }
}
