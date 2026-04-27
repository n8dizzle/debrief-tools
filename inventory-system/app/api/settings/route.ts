import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { loadSettings, patchSettings } from '@/lib/services/settings';
import { errorResponse, AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await getAuthedUser(req);
    const settings = await loadSettings();
    return NextResponse.json({ settings });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const body = (await req.json()) as { section?: string; data?: Record<string, unknown> };
    if (!body.section || !body.data || typeof body.data !== 'object') {
      throw new AppError('section and data are required', 400);
    }
    const settings = await patchSettings(body.section, body.data);
    return NextResponse.json({ settings });
  } catch (e) {
    return errorResponse(e);
  }
}
