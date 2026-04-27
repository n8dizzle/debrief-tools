import { NextResponse, type NextRequest } from 'next/server';
import { refresh } from '@/lib/services/auth';
import { errorResponse, AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { refresh_token?: string } | null;
    if (!body?.refresh_token) throw new AppError('refresh_token is required', 400);
    const result = await refresh(body.refresh_token);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
