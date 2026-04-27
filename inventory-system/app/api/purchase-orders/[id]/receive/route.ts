import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { receivePO } from '@/lib/services/purchase-orders';
import { errorResponse, AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager', 'warehouse_staff');
    const { id } = await params;
    const body = (await req.json()) as { lines?: Array<{ line_id: string; quantity_received: number }>; notes?: string };
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw new AppError('lines must be a non-empty array', 400);
    }
    const result = await receivePO(id, body.lines, user.id, body.notes ?? null);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
