import { NextRequest, NextResponse } from 'next/server';
import { decode } from 'next-auth/jwt';
import { getServerSupabase } from '@/lib/supabase';
import type { UserPermissions, UserRole } from '@/lib/permissions';

interface SSOValidationResponse {
  valid: boolean;
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    permissions: UserPermissions | null;
    department_id: string | null;
  };
  error?: string;
}

/**
 * POST /api/sso/validate
 *
 * Validates a NextAuth session token for SSO with external apps (Python, etc.).
 * This endpoint decodes the JWT and returns user info.
 *
 * Request:
 *   Authorization: Bearer <INTERNAL_API_SECRET>
 *   Body: { sessionToken: string }
 *
 * Response:
 *   { valid: true, user: { id, email, name, role, permissions, department_id } }
 *   or
 *   { valid: false, error: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse<SSOValidationResponse>> {
  // Verify internal API secret
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.INTERNAL_API_SECRET;

  if (!expectedSecret) {
    console.error('INTERNAL_API_SECRET not configured');
    return NextResponse.json({ valid: false, error: 'Server configuration error' }, { status: 500 });
  }

  if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ valid: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sessionToken } = body;

    if (!sessionToken) {
      return NextResponse.json(
        { valid: false, error: 'Session token required' },
        { status: 400 }
      );
    }

    // Decode the NextAuth JWT
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('NEXTAUTH_SECRET not configured');
      return NextResponse.json({ valid: false, error: 'Server configuration error' }, { status: 500 });
    }

    const decoded = await decode({
      token: sessionToken,
      secret,
    });

    if (!decoded || !decoded.email) {
      return NextResponse.json({ valid: false, error: 'Invalid or expired session token' }, { status: 401 });
    }

    const email = decoded.email as string;

    // Fetch full user info from database
    const supabase = getServerSupabase();

    const { data: user, error } = await supabase
      .from('portal_users')
      .select(`
        id,
        email,
        name,
        role,
        permissions,
        department_id,
        is_active
      `)
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return NextResponse.json({ valid: false, error: 'User not found' }, { status: 404 });
    }

    if (!user.is_active) {
      return NextResponse.json({ valid: false, error: 'User is inactive' }, { status: 403 });
    }

    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
        permissions: (user.permissions as UserPermissions) || null,
        department_id: user.department_id,
      },
    });
  } catch (error) {
    console.error('SSO validation error:', error);
    return NextResponse.json({ valid: false, error: 'Validation failed' }, { status: 500 });
  }
}
