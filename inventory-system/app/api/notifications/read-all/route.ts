import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { markAllNotificationsRead } from '@/lib/services/notifications';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    await markAllNotificationsRead(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
