import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { lockBatch } from '@/lib/services/restock-batches';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const { id } = await params;
    const batch = await lockBatch(id, user.id, 'manual');
    return NextResponse.json({ message: 'Batch locked', batch });
  } catch (e) {
    return errorResponse(e);
  }
}
