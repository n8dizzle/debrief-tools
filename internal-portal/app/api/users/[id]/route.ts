import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";
import { logAuditEvent, getClientIP } from "@/lib/audit";
import type { UserPermissions } from "@/lib/permissions";

// GET /api/users/[id] - Get a single user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const { data: user, error } = await supabase
      .from("portal_users")
      .select(`
        *,
        portal_departments(id, name, slug)
      `)
      .eq("id", params.id)
      .single();

    if (error) throw error;

    return NextResponse.json({
      ...user,
      department: user.portal_departments,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

// PATCH /api/users/[id] - Update a user
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role: currentRole, departmentId: currentDeptId } = session.user;

    if (currentRole === "employee") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, department_id, role, is_active, permissions } = body;

    const supabase = getServerSupabase();

    // First, get the user being updated (include current state for audit)
    const { data: targetUser } = await supabase
      .from("portal_users")
      .select("department_id, role, is_active, permissions")
      .eq("id", params.id)
      .single();

    // Managers can only update users in their department
    if (currentRole === "manager") {
      if (targetUser?.department_id !== currentDeptId) {
        return NextResponse.json({ error: "Can only update users in your department" }, { status: 403 });
      }
      // Managers cannot change roles or move users to other departments
      if (role !== undefined || (department_id !== undefined && department_id !== currentDeptId)) {
        return NextResponse.json({ error: "Managers cannot change roles or departments" }, { status: 403 });
      }
    }

    // Only owners can set owner role
    if (role === "owner" && currentRole !== "owner") {
      return NextResponse.json({ error: "Only owners can assign owner role" }, { status: 403 });
    }

    // Build update object
    const updateData: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (department_id !== undefined) updateData.department_id = department_id;
    if (role !== undefined) updateData.role = role;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (permissions !== undefined) updateData.permissions = permissions as UserPermissions;

    const { data: user, error } = await supabase
      .from("portal_users")
      .update(updateData)
      .eq("id", params.id)
      .select(`
        *,
        portal_departments(id, name, slug)
      `)
      .single();

    if (error) throw error;

    // Determine audit action
    let action: string = 'user.updated';
    if (is_active !== undefined && is_active !== targetUser?.is_active) {
      action = is_active ? 'user.reactivated' : 'user.deactivated';
    } else if (role !== undefined && role !== targetUser?.role) {
      action = 'role.changed';
    } else if (permissions !== undefined) {
      action = 'permission.changed';
    }

    // Log audit event
    await logAuditEvent({
      actorId: session.user.id,
      action: action as any,
      targetType: 'user',
      targetId: params.id,
      oldValue: {
        role: targetUser?.role,
        is_active: targetUser?.is_active,
        permissions: targetUser?.permissions,
      },
      newValue: {
        role: user.role,
        is_active: user.is_active,
        permissions: user.permissions,
      },
      ipAddress: getClientIP(request.headers),
    });

    return NextResponse.json({
      ...user,
      department: user.portal_departments,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Deactivate a user (owners only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "owner") {
      return NextResponse.json({ error: "Only owners can deactivate users" }, { status: 403 });
    }

    // Prevent self-deactivation
    if (session.user.id === params.id) {
      return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Soft delete - set is_active to false
    const { error } = await supabase
      .from("portal_users")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", params.id);

    if (error) throw error;

    // Log audit event
    await logAuditEvent({
      actorId: session.user.id,
      action: 'user.deactivated',
      targetType: 'user',
      targetId: params.id,
      oldValue: { is_active: true },
      newValue: { is_active: false },
      ipAddress: getClientIP(request.headers),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deactivating user:", error);
    return NextResponse.json({ error: "Failed to deactivate user" }, { status: 500 });
  }
}
