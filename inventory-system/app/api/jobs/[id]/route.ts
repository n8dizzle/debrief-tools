import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { getJob } from '@/lib/services/jobs';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getAuthedUser(req);
    const { id } = await params;
    const row = await getJob(id);
    return NextResponse.json({ job: row });
  } catch (e) {
    return errorResponse(e);
  }
}
