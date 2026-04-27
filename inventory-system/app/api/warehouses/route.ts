import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { listWarehouses } from '@/lib/services/warehouses';
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
