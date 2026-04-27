import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { submitCycleCount } from '@/lib/services/material-movements';
import { errorResponse, AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager', 'technician');
    const body = (await req.json()) as {
      warehouse_id?: string;
      counts?: Array<{ material_id: string; counted_qty: number; notes?: string }>;
    };
    if (!body.warehouse_id || !Array.isArray(body.counts) || body.counts.length === 0) {
      throw new AppError('warehouse_id and a non-empty counts array are required', 400);
    }
    const results = await submitCycleCount({
      warehouse_id: body.warehouse_id,
      counts: body.counts,
      performed_by: user.id,
    });
    return NextResponse.json({ message: 'Cycle count processed', results });
  } catch (e) {
    return errorResponse(e);
  }
}
