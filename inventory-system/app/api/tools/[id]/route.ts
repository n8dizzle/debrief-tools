import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { getTool, updateTool, type ToolInput } from '@/lib/services/tools';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthedUser(req);
    const { id } = await params;
    const detail = await getTool(id);
    return NextResponse.json(detail);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const { id } = await params;
    const body = (await req.json()) as ToolInput;
    const row = await updateTool(id, body);
    return NextResponse.json({ tool: row });
  } catch (e) {
    return errorResponse(e);
  }
}
