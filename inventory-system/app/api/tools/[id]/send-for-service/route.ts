import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { sendToolForService } from '@/lib/services/tools';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { notes?: string | null };
    const tool = await sendToolForService(id, body, user.id);
    return NextResponse.json({ tool });
  } catch (e) {
    return errorResponse(e);
  }
}
