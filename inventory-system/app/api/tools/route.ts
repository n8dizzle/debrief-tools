import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { listTools, createTool, type ToolInput } from '@/lib/services/tools';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await getAuthedUser(req);
    const sp = req.nextUrl.searchParams;
    const rows = await listTools({
      department: sp.get('department'),
      status: sp.get('status'),
      category: sp.get('category'),
      warehouseId: sp.get('warehouse_id'),
    });
    return NextResponse.json({ tools: rows });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin', 'warehouse_manager');
    const body = (await req.json()) as ToolInput;
    const row = await createTool(body);
    return NextResponse.json({ tool: row }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
