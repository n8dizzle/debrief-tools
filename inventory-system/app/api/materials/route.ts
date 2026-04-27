import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { listMaterials, createMaterial, type MaterialInput } from '@/lib/services/materials';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await getAuthedUser(req);
    const sp = req.nextUrl.searchParams;
    const isActive = sp.get('is_active');

    const rows = await listMaterials({
      department: sp.get('department'),
      category: sp.get('category'),
      search: sp.get('search'),
      isActive: isActive === null ? null : isActive !== 'false',
      belowReorder: sp.get('below_reorder') === 'true',
    });
    return NextResponse.json({ materials: rows, count: rows.length });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const body = (await req.json()) as MaterialInput;
    const row = await createMaterial(body);
    return NextResponse.json({ material: row }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
