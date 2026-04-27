import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { getToolByBarcode } from '@/lib/services/tools';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ barcode: string }> }) {
  try {
    await getAuthedUser(req);
    const { barcode } = await params;
    const row = await getToolByBarcode(barcode);
    return NextResponse.json({ tool: row });
  } catch (e) {
    return errorResponse(e);
  }
}
