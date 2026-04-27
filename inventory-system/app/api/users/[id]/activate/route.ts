import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { setUserActive } from '@/lib/services/users';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin');
    const { id } = await params;
    await setUserActive(id, true);
    return NextResponse.json({ message: 'User activated' });
  } catch (e) {
    return errorResponse(e);
  }
}
