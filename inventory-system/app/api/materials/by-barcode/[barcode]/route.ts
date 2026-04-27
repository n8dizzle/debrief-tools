import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { getMaterialByBarcode } from '@/lib/services/materials';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ barcode: string }> }) {
  try {
    await getAuthedUser(req);
    const { barcode } = await params;
    const row = await getMaterialByBarcode(barcode);
    return NextResponse.json({ material: row });
  } catch (e) {
    return errorResponse(e);
  }
}
