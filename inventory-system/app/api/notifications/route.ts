import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { buildNotifications } from '@/lib/services/notifications';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    const result = await buildNotifications(user.id);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
