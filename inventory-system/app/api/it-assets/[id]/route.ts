import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { getItAsset, updateItAsset, type ItAssetInput } from '@/lib/services/it-assets';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getAuthedUser(req);
    const { id } = await params;
    const detail = await getItAsset(id);
    return NextResponse.json(detail);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'it_admin');
    const { id } = await params;
    const body = (await req.json()) as ItAssetInput;
    const row = await updateItAsset(id, body);
    return NextResponse.json({ asset: row });
  } catch (e) {
    return errorResponse(e);
  }
}
