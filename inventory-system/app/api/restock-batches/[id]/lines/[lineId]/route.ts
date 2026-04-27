import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { updateLine, type UpdateLineInput } from '@/lib/services/restock-batches';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const { lineId } = await params;
    const body = (await req.json()) as UpdateLineInput;
    const line = await updateLine(lineId, body);
    return NextResponse.json({ line });
  } catch (e) {
    return errorResponse(e);
  }
}
