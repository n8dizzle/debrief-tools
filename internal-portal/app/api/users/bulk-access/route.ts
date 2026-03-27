import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";
import { logAuditEvent, getClientIP } from "@/lib/audit";

// PATCH /api/users/bulk-access - Bulk update can_access for an app across multiple users
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { app, updates } = await request.json();
    // updates: Array<{ userId: string, permissions: Record<string, boolean> }>

    if (!app || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "Missing app or updates" }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const ipAddress = getClientIP(request.headers);
    const results: { userId: string; success: boolean }[] = [];

    for (const update of updates) {
      const { userId, permissions: newAppPerms } = update;

      // Get current user permissions
      const { data: user, error: fetchErr } = await supabase
        .from("portal_users")
        .select("permissions")
        .eq("id", userId)
        .single();

      if (fetchErr || !user) {
        results.push({ userId, success: false });
        continue;
      }

      const oldPermissions = user.permissions || {};
      const newPermissions = { ...oldPermissions };

      // If all permissions are false/empty, remove the app key entirely
      const hasAnyTrue = Object.values(newAppPerms).some(Boolean);
      if (hasAnyTrue) {
        (newPermissions as Record<string, Record<string, boolean>>)[app] = newAppPerms;
      } else {
        delete (newPermissions as Record<string, any>)[app];
      }

      const { error: updateErr } = await supabase
        .from("portal_users")
        .update({ permissions: newPermissions, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (updateErr) {
        results.push({ userId, success: false });
        continue;
      }

      results.push({ userId, success: true });

      // Audit log
      await logAuditEvent({
        actorId: session.user.id,
        action: "permission.changed" as any,
        targetType: "user",
        targetId: userId,
        oldValue: { app, permissions: oldPermissions[app as keyof typeof oldPermissions] || {} },
        newValue: { app, permissions: hasAnyTrue ? newAppPerms : null },
        ipAddress,
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error bulk updating access:", error);
    return NextResponse.json({ error: "Failed to update access" }, { status: 500 });
  }
}
