import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

// GET /api/users - Get users (filtered by role permissions)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, departmentId } = session.user;

    // Only managers and owners can see users
    if (role === "employee") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServerSupabase();

    // Owners see all users
    if (role === "owner") {
      const { data: users, error } = await supabase
        .from("portal_users")
        .select(`
          *,
          portal_departments(id, name, slug)
        `)
        .order("name");

      if (error) throw error;

      // Transform to flatten department
      const transformedUsers = users.map((user: any) => ({
        ...user,
        department: user.portal_departments,
      }));

      return NextResponse.json(transformedUsers);
    }

    // Managers see only their department
    if (!departmentId) {
      return NextResponse.json([]);
    }

    const { data: users, error } = await supabase
      .from("portal_users")
      .select(`
        *,
        portal_departments(id, name, slug)
      `)
      .eq("department_id", departmentId)
      .order("name");

    if (error) throw error;

    const transformedUsers = users.map((user: any) => ({
      ...user,
      department: user.portal_departments,
    }));

    return NextResponse.json(transformedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role: currentRole, departmentId: currentDeptId, id: currentUserId } = session.user;

    // Only managers and owners can create users
    if (currentRole === "employee") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, department_id, role } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Managers can only create employees in their department
    if (currentRole === "manager") {
      if (role && role !== "employee") {
        return NextResponse.json({ error: "Managers can only create employees" }, { status: 403 });
      }
      if (department_id && department_id !== currentDeptId) {
        return NextResponse.json({ error: "Managers can only add users to their department" }, { status: 403 });
      }
    }

    // Only owners can create owners
    if (role === "owner" && currentRole !== "owner") {
      return NextResponse.json({ error: "Only owners can create owner accounts" }, { status: 403 });
    }

    const supabase = getServerSupabase();

    // Create user
    const { data: user, error } = await supabase
      .from("portal_users")
      .insert({
        email: email.toLowerCase().trim(),
        name,
        department_id: department_id || (currentRole === "manager" ? currentDeptId : null),
        role: role || "employee",
        created_by: currentUserId,
      })
      .select(`
        *,
        portal_departments(id, name, slug)
      `)
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "User with this email already exists" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({
      ...user,
      department: user.portal_departments,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
