import { NextResponse, type NextRequest } from 'next/server';
import { login } from '@/lib/services/auth';
import { errorResponse, AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { email?: string; password?: string }
      | null;
    if (!body?.email || !body?.password) {
      throw new AppError('Email and password are required', 400);
    }
    const result = await login(body.email, body.password);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
