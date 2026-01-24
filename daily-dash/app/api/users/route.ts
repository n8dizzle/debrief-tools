import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import type { UserPermissions } from '@/lib/permissions';

/**
 * GET /api/users
 * List all users (owner-only)
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only owners can list users
  if (session.user.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: Owner access required' }, { status: 403 });
  }

  const supabase = getServerSupabase();

  try {
    const { data: users, error } = await supabase
      .from('portal_users')
      .select(`
        id,
        email,
        name,
        role,
        department_id,
        is_active,
        permissions,
        created_at,
        updated_at,
        last_login_at,
        portal_departments(id, name, slug)
      `)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Transform to include department as nested object
    const transformedUsers = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department_id: user.department_id,
      is_active: user.is_active,
      permissions: user.permissions || {},
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login_at: user.last_login_at,
      department: user.portal_departments,
    }));

    return NextResponse.json({ users: transformedUsers });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

/**
 * POST /api/users
 * Create a new user (owner-only)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only owners can create users
  if (session.user.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: Owner access required' }, { status: 403 });
  }

  const supabase = getServerSupabase();

  try {
    const body = await request.json();
    const { email, name, role, department_id, permissions } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate role
    const validRoles = ['employee', 'manager', 'owner'];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('portal_users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    // Create user
    const { data: newUser, error } = await supabase
      .from('portal_users')
      .insert({
        email: email.toLowerCase(),
        name: name || null,
        role: role || 'employee',
        department_id: department_id || null,
        permissions: (permissions as UserPermissions) || {},
        is_active: true,
        created_by: session.user.id,
      })
      .select(`
        id,
        email,
        name,
        role,
        department_id,
        is_active,
        permissions,
        created_at,
        updated_at,
        portal_departments(id, name, slug)
      `)
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    return NextResponse.json({
      user: {
        ...newUser,
        department: newUser.portal_departments,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
