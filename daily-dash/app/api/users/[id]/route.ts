import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import type { UserPermissions } from '@/lib/permissions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/users/[id]
 * Get a single user (owner-only)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only owners can view user details
  if (session.user.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: Owner access required' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  try {
    const { data: user, error } = await supabase
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
      .eq('id', id)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        ...user,
        department: user.portal_departments,
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

/**
 * PATCH /api/users/[id]
 * Update a user (owner-only)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only owners can update users
  if (session.user.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: Owner access required' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  try {
    const body = await request.json();
    const { name, role, department_id, is_active, permissions } = body;

    // Validate role if provided
    if (role) {
      const validRoles = ['employee', 'manager', 'owner'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
    }

    // Build update object (only include provided fields)
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (department_id !== undefined) updateData.department_id = department_id;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (permissions !== undefined) updateData.permissions = permissions as UserPermissions;

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('portal_users')
      .select('id, email')
      .eq('id', id)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent demoting self from owner
    if (
      existingUser.email === session.user.email &&
      role &&
      role !== 'owner'
    ) {
      return NextResponse.json(
        { error: 'Cannot change your own role from owner' },
        { status: 400 }
      );
    }

    // Prevent deactivating self
    if (existingUser.email === session.user.email && is_active === false) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 400 }
      );
    }

    // Update user
    const { data: updatedUser, error: updateError } = await supabase
      .from('portal_users')
      .update(updateData)
      .eq('id', id)
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
      .single();

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json({
      user: {
        ...updatedUser,
        department: updatedUser.portal_departments,
      },
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

/**
 * DELETE /api/users/[id]
 * Soft-delete (deactivate) a user (owner-only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only owners can delete users
  if (session.user.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: Owner access required' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  try {
    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('portal_users')
      .select('id, email')
      .eq('id', id)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deleting self
    if (existingUser.email === session.user.email) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 400 }
      );
    }

    // Soft delete (deactivate)
    const { error: updateError } = await supabase
      .from('portal_users')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error deactivating user:', updateError);
      return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    console.error('Error deactivating user:', error);
    return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 });
  }
}
