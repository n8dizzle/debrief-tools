import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase, getPortalUser } from "@/lib/supabase";

// GET /api/departments - Get all departments
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const { data: departments, error } = await supabase
      .from("portal_departments")
      .select("*")
      .order("name");

    if (error) throw error;

    return NextResponse.json(departments);
  } catch (error) {
    console.error("Error fetching departments:", error);
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 });
  }
}

// POST /api/departments - Create a new department (owner only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is owner
    const portalUser = await getPortalUser(session.user.email);
    if (!portalUser || portalUser.role !== "owner") {
      return NextResponse.json({ error: "Only owners can create departments" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, default_permissions } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const supabase = getServerSupabase();
    const { data: department, error } = await supabase
      .from("portal_departments")
      .insert({
        name,
        slug,
        description: description || null,
        default_permissions: default_permissions || {},
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "A department with this name already exists" }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json(department);
  } catch (error) {
    console.error("Error creating department:", error);
    return NextResponse.json({ error: "Failed to create department" }, { status: 500 });
  }
}
