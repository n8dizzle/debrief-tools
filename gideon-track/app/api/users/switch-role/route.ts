import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role } = await req.json();
  if (!role || !["admin", "tutor", "parent"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Verify the user actually has this role
  if (!session.user.roles.includes(role)) {
    return NextResponse.json({ error: "Role not assigned to user" }, { status: 403 });
  }

  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("gt_users")
    .update({ active_role: role })
    .eq("id", session.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, active_role: role });
}
