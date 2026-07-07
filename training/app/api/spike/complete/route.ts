import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

// PUBLIC. Records that a tech finished the dummy training. Idempotent: completed_at
// is set once (a double-tap won't move it).
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json().catch(() => ({ token: null }));
    if (!token || typeof token !== "string") {
      return NextResponse.json({ ok: false, error: "missing token" }, { status: 400 });
    }
    const supabase = getServerSupabase();
    const { data: row } = await supabase
      .from("spike_taps")
      .select("id, completed_at")
      .eq("token", token)
      .single();

    if (!row) {
      return NextResponse.json({ ok: false, error: "unknown token" }, { status: 404 });
    }

    if (!row.completed_at) {
      await supabase
        .from("spike_taps")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", row.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Public endpoint: log detail server-side, return a generic message.
    console.error("spike/complete error:", err);
    return NextResponse.json({ ok: false, error: "error" }, { status: 500 });
  }
}
