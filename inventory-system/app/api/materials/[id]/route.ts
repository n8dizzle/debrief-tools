import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { getMaterial, updateMaterial, type MaterialInput } from '@/lib/services/materials';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthedUser(req);
    const { id } = await params;
    const detail = await getMaterial(id);
    return NextResponse.json(detail);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const { id } = await params;
    const body = (await req.json()) as MaterialInput;
    const row = await updateMaterial(id, body);
    return NextResponse.json({ material: row });
  } catch (e) {
    return errorResponse(e);
  }
}
