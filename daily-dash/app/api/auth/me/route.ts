import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPermission, type UserPermissions, type UserRole } from '@/lib/permissions';

/**
 * GET /api/auth/me
 * Returns the current user's information including permissions
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  try {
    const { data: userData, error: userError } = await supabase
      .from('portal_users')
      .select('id, email, name, role, permissions')
      .eq('email', session.user.email)
      .single();

    if (userError || !userData) {
      // Return basic session info if user not found in database
      return NextResponse.json({
        email: session.user.email,
        name: session.user.name,
        role: (session.user as { role?: string }).role || 'employee',
        permissions: {},
        can_reply_reviews: false,
      });
    }

    const role = userData.role as UserRole;
    const permissions = (userData.permissions || {}) as UserPermissions;

    return NextResponse.json({
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      permissions: permissions,
      // Backwards compatibility: compute can_reply_reviews from new permission system
      can_reply_reviews: hasPermission(role, permissions, 'daily_dash', 'can_reply_reviews'),
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}
