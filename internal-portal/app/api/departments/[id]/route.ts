import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase, getPortalUser } from "@/lib/supabase";

// GET /api/departments/[id] - Get a single department
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
    const { data: department, error } = await supabase
      .from("portal_departments")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    return NextResponse.json(department);
  } catch (error) {
    console.error("Error fetching department:", error);
    return NextResponse.json({ error: "Failed to fetch department" }, { status: 500 });
  }
}

// PATCH /api/departments/[id] - Update a department (owner only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is owner
    const portalUser = await getPortalUser(session.user.email);
    if (!portalUser || portalUser.role !== "owner") {
      return NextResponse.json({ error: "Only owners can update departments" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, default_permissions } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      updates.name = name;
      updates.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    if (description !== undefined) updates.description = description;
    if (default_permissions !== undefined) updates.default_permissions = default_permissions;

    const supabase = getServerSupabase();
    const { data: department, error } = await supabase
      .from("portal_departments")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "A department with this name already exists" }, { status: 400 });
      }
      throw error;
    }

    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    return NextResponse.json(department);
  } catch (error) {
    console.error("Error updating department:", error);
    return NextResponse.json({ error: "Failed to update department" }, { status: 500 });
  }
}

// DELETE /api/departments/[id] - Delete a department (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is owner
    const portalUser = await getPortalUser(session.user.email);
    if (!portalUser || portalUser.role !== "owner") {
      return NextResponse.json({ error: "Only owners can delete departments" }, { status: 403 });
    }

    const supabase = getServerSupabase();

    // Check if any users are in this department
    const { count } = await supabase
      .from("portal_users")
      .select("*", { count: "exact", head: true })
      .eq("department_id", params.id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete department with ${count} user(s). Reassign users first.` },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("portal_departments")
      .delete()
      .eq("id", params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting department:", error);
    return NextResponse.json({ error: "Failed to delete department" }, { status: 500 });
  }
}
