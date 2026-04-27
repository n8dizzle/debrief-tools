import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { unassignAsset } from '@/lib/services/it-assets';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'it_admin');
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { return_notes?: string };
    const row = await unassignAsset(id, user.id, body.return_notes ?? null);
    return NextResponse.json({ asset: row });
  } catch (e) {
    return errorResponse(e);
  }
}
