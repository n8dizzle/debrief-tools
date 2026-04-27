import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { runBatchLock } from '@/lib/services/admin-jobs';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const result = await runBatchLock('manual');
    return NextResponse.json({ message: 'Batch lock job executed', result });
  } catch (e) {
    return errorResponse(e);
  }
}
