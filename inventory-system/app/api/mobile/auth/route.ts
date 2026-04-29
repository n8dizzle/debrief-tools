/**
 * POST /api/mobile/auth
 * Mobile-app login: accepts { email, password }, returns a signed JWT.
 * The JWT is accepted by all existing API routes via the Bearer-token path
 * in lib/auth-guard.ts.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { sign } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
const EXPIRES_IN = '30d'; // generous TTL for mobile

interface UserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  department: string | null;
  home_warehouse_id: string | null;
  assigned_truck_id: string | null;
  password_hash: string | null;
  is_active: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { email?: string; password?: string };
    const email = (body.email ?? '').toLowerCase().trim();
    const password = body.password ?? '';

    if (!email || !password) {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
    }

    const { rows } = await query<UserRow>(
      `SELECT id, email, first_name, last_name, role, department,
              home_warehouse_id, assigned_truck_id, password_hash, is_active
         FROM users WHERE email = $1`,
      [email],
    );
    const user = rows[0];

    if (!user || !user.is_active || !user.password_hash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = sign({ sub: user.id }, SECRET, { expiresIn: EXPIRES_IN });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        department: user.department,
        homeWarehouseId: user.home_warehouse_id,
        assignedTruckId: user.assigned_truck_id,
      },
    });
  } catch (e) {
    console.error('[mobile/auth]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
