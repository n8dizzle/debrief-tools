import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { getServerSupabase } from "@/lib/supabase";

// GET /api/tools - Get tools filtered by user's department permissions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const { role, departmentId } = session.user;
    const { searchParams } = new URL(request.url);
    const isAdminView = searchParams.get("admin") === "true";

    // Admin view - owners see ALL tools (including inactive)
    if (isAdminView && role === "owner") {
      const { data: tools, error } = await supabase
        .from("portal_tools")
        .select(`
          *,
          portal_tool_permissions(
            department_id,
            portal_departments(id, name, slug)
          )
        `)
        .order("section")
        .order("display_order");

      if (error) throw error;

      // Transform to include departments array
      const transformedTools = tools.map((tool: any) => ({
        ...tool,
        departments: tool.portal_tool_permissions?.map((p: any) => p.portal_departments) || [],
      }));

      return NextResponse.json(transformedTools);
    }

    // Owners see all active tools
    if (role === "owner") {
      const { data: tools, error } = await supabase
        .from("portal_tools")
        .select(`
          *,
          portal_tool_permissions(
            department_id,
            portal_departments(id, name, slug)
          )
        `)
        .eq("is_active", true)
        .order("section")
        .order("display_order");

      if (error) throw error;

      // Transform to include departments array
      const transformedTools = tools.map((tool: any) => ({
        ...tool,
        departments: tool.portal_tool_permissions?.map((p: any) => p.portal_departments) || [],
      }));

      return NextResponse.json(transformedTools);
    }

    // Non-owners see only tools assigned to their department
    if (!departmentId) {
      return NextResponse.json([]);
    }

    const { data: tools, error } = await supabase
      .from("portal_tools")
      .select(`
        *,
        portal_tool_permissions!inner(department_id)
      `)
      .eq("is_active", true)
      .eq("portal_tool_permissions.department_id", departmentId)
      .order("section")
      .order("display_order");

    if (error) throw error;

    return NextResponse.json(tools || []);
  } catch (error) {
    console.error("Error fetching tools:", error);
    return NextResponse.json({ error: "Failed to fetch tools" }, { status: 500 });
  }
}

// POST /api/tools - Create a new tool (owners only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, url, icon, section, category, department_ids } = body;

    if (!name || !url || !section) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Create tool
    const { data: tool, error: toolError } = await supabase
      .from("portal_tools")
      .insert({
        name,
        description: description || null,
        url,
        icon: icon || "link",
        section,
        category: category || null,
      })
      .select()
      .single();

    if (toolError) throw toolError;

    // Create permissions if department_ids provided
    if (department_ids?.length > 0) {
      const permissions = department_ids.map((deptId: string) => ({
        tool_id: tool.id,
        department_id: deptId,
      }));

      const { error: permError } = await supabase
        .from("portal_tool_permissions")
        .insert(permissions);

      if (permError) throw permError;
    }

    return NextResponse.json(tool, { status: 201 });
  } catch (error) {
    console.error("Error creating tool:", error);
    return NextResponse.json({ error: "Failed to create tool" }, { status: 500 });
  }
}
