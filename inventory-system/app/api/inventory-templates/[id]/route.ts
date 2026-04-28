import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { getInventoryTemplate } from '@/lib/services/inventory-templates';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getAuthedUser(req);
    const { id } = await params;
    const detail = await getInventoryTemplate(id);
    return NextResponse.json(detail);
  } catch (e) {
    return errorResponse(e);
  }
}
