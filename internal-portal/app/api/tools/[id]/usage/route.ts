import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { getServerSupabase } from "@/lib/supabase";

// POST /api/tools/[id]/usage - Log tool usage
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabase();

    const { error } = await supabase
      .from("portal_tool_usage")
      .insert({
        user_id: session.user.id,
        tool_id: params.id,
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error logging usage:", error);
    return NextResponse.json({ error: "Failed to log usage" }, { status: 500 });
  }
}
