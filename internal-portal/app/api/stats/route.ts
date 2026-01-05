import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

// GET /api/stats - Get usage statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role } = session.user;

    // Only managers and owners can see stats
    if (role === "employee") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServerSupabase();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get total clicks (last 7 days)
    const { count: clicks7d } = await supabase
      .from("portal_tool_usage")
      .select("*", { count: "exact", head: true })
      .gte("accessed_at", sevenDaysAgo);

    // Get total clicks (last 30 days)
    const { count: clicks30d } = await supabase
      .from("portal_tool_usage")
      .select("*", { count: "exact", head: true })
      .gte("accessed_at", thirtyDaysAgo);

    // Get most used tools (last 30 days)
    const { data: topTools } = await supabase
      .from("portal_tool_usage")
      .select("tool_id, portal_tools(name)")
      .gte("accessed_at", thirtyDaysAgo);

    // Count tool usage
    const toolCounts: Record<string, { name: string; count: number }> = {};
    topTools?.forEach((usage: any) => {
      const toolId = usage.tool_id;
      const toolName = usage.portal_tools?.name || "Unknown";
      if (!toolCounts[toolId]) {
        toolCounts[toolId] = { name: toolName, count: 0 };
      }
      toolCounts[toolId].count++;
    });

    const sortedTools = Object.entries(toolCounts)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get active users (last 7 days)
    const { data: activeUsersData } = await supabase
      .from("portal_users")
      .select("id")
      .gte("last_login_at", sevenDaysAgo);

    // Get users by department
    const { data: usersByDept } = await supabase
      .from("portal_users")
      .select("department_id, portal_departments(name)")
      .eq("is_active", true);

    const deptCounts: Record<string, { name: string; count: number }> = {};
    usersByDept?.forEach((user: any) => {
      const deptId = user.department_id;
      const deptName = user.portal_departments?.name || "Unassigned";
      if (!deptCounts[deptId || "unassigned"]) {
        deptCounts[deptId || "unassigned"] = { name: deptName, count: 0 };
      }
      deptCounts[deptId || "unassigned"].count++;
    });

    const usersByDepartment = Object.entries(deptCounts)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count);

    // Get total users
    const { count: totalUsers } = await supabase
      .from("portal_users")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    // Get total tools
    const { count: totalTools } = await supabase
      .from("portal_tools")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    return NextResponse.json({
      clicks: {
        last7Days: clicks7d || 0,
        last30Days: clicks30d || 0,
      },
      topTools: sortedTools,
      activeUsers: {
        last7Days: activeUsersData?.length || 0,
      },
      usersByDepartment,
      totals: {
        users: totalUsers || 0,
        tools: totalTools || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
