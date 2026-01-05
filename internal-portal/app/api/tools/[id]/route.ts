import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getServerSupabase } from "@/lib/supabase";

// GET /api/tools/[id] - Get a single tool
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
    const { data: tool, error } = await supabase
      .from("portal_tools")
      .select(`
        *,
        portal_tool_permissions(
          department_id,
          portal_departments(id, name, slug)
        )
      `)
      .eq("id", params.id)
      .single();

    if (error) throw error;

    // Transform to include departments array
    const transformedTool = {
      ...tool,
      departments: tool.portal_tool_permissions?.map((p: any) => p.portal_departments) || [],
    };

    return NextResponse.json(transformedTool);
  } catch (error) {
    console.error("Error fetching tool:", error);
    return NextResponse.json({ error: "Failed to fetch tool" }, { status: 500 });
  }
}

// PATCH /api/tools/[id] - Update a tool (owners only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, url, icon, section, category, is_active, display_order, departmentIds } = body;

    const supabase = getServerSupabase();

    // Update tool
    const updateData: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (url !== undefined) updateData.url = url;
    if (icon !== undefined) updateData.icon = icon;
    if (section !== undefined) updateData.section = section;
    if (category !== undefined) updateData.category = category;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (display_order !== undefined) updateData.display_order = display_order;

    const { data: tool, error: toolError } = await supabase
      .from("portal_tools")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

    if (toolError) throw toolError;

    // Update permissions if departmentIds provided
    if (departmentIds !== undefined) {
      // Delete existing permissions
      await supabase
        .from("portal_tool_permissions")
        .delete()
        .eq("tool_id", params.id);

      // Insert new permissions
      if (departmentIds.length > 0) {
        const permissions = departmentIds.map((deptId: string) => ({
          tool_id: params.id,
          department_id: deptId,
        }));

        const { error: permError } = await supabase
          .from("portal_tool_permissions")
          .insert(permissions);

        if (permError) throw permError;
      }
    }

    return NextResponse.json(tool);
  } catch (error) {
    console.error("Error updating tool:", error);
    return NextResponse.json({ error: "Failed to update tool" }, { status: 500 });
  }
}

// DELETE /api/tools/[id] - Delete a tool (owners only)
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServerSupabase();

    // Delete tool (permissions cascade)
    const { error } = await supabase
      .from("portal_tools")
      .delete()
      .eq("id", params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tool:", error);
    return NextResponse.json({ error: "Failed to delete tool" }, { status: 500 });
  }
}
