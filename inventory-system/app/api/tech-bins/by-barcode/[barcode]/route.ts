import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { getTechBinByBarcode } from '@/lib/services/tech-bins';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ barcode: string }> },
) {
  try {
    await getAuthedUser(req);
    const { barcode } = await params;
    const row = await getTechBinByBarcode(barcode);
    return NextResponse.json({ bin: row });
  } catch (e) {
    return errorResponse(e);
  }
}
