import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { listInventoryTemplates } from '@/lib/services/inventory-templates';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await getAuthedUser(req);
    const rows = await listInventoryTemplates();
    return NextResponse.json({ templates: rows });
  } catch (e) {
    return errorResponse(e);
  }
}
