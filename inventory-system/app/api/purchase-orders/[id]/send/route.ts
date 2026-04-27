import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { sendPO } from '@/lib/services/purchase-orders';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const { id } = await params;
    const po = await sendPO(id, user.id);
    return NextResponse.json({ message: 'Purchase order sent', purchase_order: po });
  } catch (e) {
    return errorResponse(e);
  }
}
