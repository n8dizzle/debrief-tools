import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import type { UserPermissions, UserRole } from '@/lib/permissions';

interface ValidateUserResponse {
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
 * POST /api/users/validate
 *
 * Validates a user by email for SSO with external apps (Python, etc.).
 * This endpoint checks if a user exists and is active in portal_users.
 *
 * Request:
 *   Authorization: Bearer <INTERNAL_API_SECRET>
 *   Body: { email: string }
 *
 * Response:
 *   { valid: true, user: { id, email, name, role, permissions, department_id } }
 *   or
 *   { valid: false, error: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse<ValidateUserResponse>> {
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
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { valid: false, error: 'Email required' },
        { status: 400 }
      );
    }

    // Fetch user info from database
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
      return NextResponse.json({ valid: false, error: 'User not found in portal' }, { status: 404 });
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
    console.error('User validation error:', error);
    return NextResponse.json({ valid: false, error: 'Validation failed' }, { status: 500 });
  }
}
