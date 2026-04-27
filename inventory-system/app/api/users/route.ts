import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, requireRole } from '@/lib/auth-guard';
import { listUsers, createUser, type CreateUserInput } from '@/lib/services/users';
import { errorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await getAuthedUser(req);
    const sp = req.nextUrl.searchParams;
    const ia = sp.get('is_active');
    const rows = await listUsers({
      department: sp.get('department'),
      role: sp.get('role'),
      isActive: ia === null ? null : ia === 'true',
      warehouseId: sp.get('warehouse_id'),
    });
    return NextResponse.json({ users: rows });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    requireRole(user, 'admin');
    const body = (await req.json()) as CreateUserInput;
    const created = await createUser(body);
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
