import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { assignAsset } from '@/lib/services/it-assets';
import { errorResponse, AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'it_admin');
    const { id } = await params;
    const body = (await req.json()) as { user_id?: string; notes?: string };
    if (!body.user_id) throw new AppError('user_id is required', 400);
    const row = await assignAsset(id, body.user_id, user.id, body.notes ?? null);
    return NextResponse.json({ asset: row });
  } catch (e) {
    return errorResponse(e);
  }
}
