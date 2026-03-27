import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");

  const supabase = getServerSupabase();

  // Fetch recent calls
  const { data: calls, error } = await supabase
    .from("retell_calls")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Fetch calls error:", error);
    return NextResponse.json({ error: "Failed to fetch calls" }, { status: 500 });
  }

  // Compute stats
  const allCalls = calls || [];
  const webCalls = allCalls.filter((c) => c.call_type === "web_call").length;
  const phoneCalls = allCalls.filter((c) => c.call_type === "phone_call").length;
  const durations = allCalls.filter((c) => c.duration_ms).map((c) => c.duration_ms);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
    : 0;

  return NextResponse.json({
    calls: allCalls,
    stats: {
      totalCalls: allCalls.length,
      webCalls,
      phoneCalls,
      avgDuration,
    },
  });
}
