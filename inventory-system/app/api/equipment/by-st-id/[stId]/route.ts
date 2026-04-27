import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { getEquipmentByStId } from '@/lib/services/equipment';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ stId: string }> },
) {
  try {
    await getAuthedUser(req);
    const { stId } = await params;
    const row = await getEquipmentByStId(stId);
    return NextResponse.json({ equipment: row });
  } catch (e) {
    return errorResponse(e);
  }
}
