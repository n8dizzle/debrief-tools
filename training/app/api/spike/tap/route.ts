import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

// PUBLIC. Records that a tech tapped their texted link. Sets tapped_at on first
// tap and bumps tap_count. Best-effort: never blocks the tech's page.
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json().catch(() => ({ token: null }));
    if (!token || typeof token !== "string") {
      return NextResponse.json({ ok: false, error: "missing token" }, { status: 400 });
    }
    const supabase = getServerSupabase();
    const { data: row } = await supabase
      .from("spike_taps")
      .select("id, tapped_at, tap_count")
      .eq("token", token)
      .single();

    if (!row) {
      return NextResponse.json({ ok: false, error: "unknown token" }, { status: 404 });
    }

    await supabase
      .from("spike_taps")
      .update({
        tapped_at: row.tapped_at ?? new Date().toISOString(),
        tap_count: (row.tap_count ?? 0) + 1,
      })
      .eq("id", row.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Public endpoint: log detail server-side, return a generic message.
    console.error("spike/tap error:", err);
    return NextResponse.json({ ok: false, error: "error" }, { status: 500 });
  }
}
