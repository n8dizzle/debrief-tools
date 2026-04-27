import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/auth-guard';
import { checkinTool } from '@/lib/services/tools';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthedUser(req);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { condition?: string | null; notes?: string | null };
    const tool = await checkinTool(id, body, user.id);
    return NextResponse.json({ tool });
  } catch (e) {
    return errorResponse(e);
  }
}
