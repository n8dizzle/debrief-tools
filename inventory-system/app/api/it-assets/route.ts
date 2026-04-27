import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { listItAssets, createItAsset, type ItAssetInput } from '@/lib/services/it-assets';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await getAuthedUser(req);
    const sp = req.nextUrl.searchParams;
    const rows = await listItAssets({
      assetType: sp.get('asset_type'),
      status: sp.get('status'),
      department: sp.get('department'),
      assignedTo: sp.get('assigned_to'),
    });
    return NextResponse.json({ assets: rows });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'it_admin');
    const body = (await req.json()) as ItAssetInput;
    const row = await createItAsset(body);
    return NextResponse.json({ asset: row }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
