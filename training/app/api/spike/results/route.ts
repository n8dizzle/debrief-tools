import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, type SpikeTap } from "@/lib/supabase";

export const runtime = "nodejs";

// GATED (CRON_SECRET). Returns the spike funnel so you can check results with a curl
// even before Google SSO is configured. The /spike-results dashboard page renders the
// same data behind SSO.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-cron-secret");
  const query = new URL(req.url).searchParams.get("secret");
  return header === secret || query === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("spike_taps")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as SpikeTap[];
  const accepted = rows.filter((r) => r.send_status === "accepted").length;
  const failed = rows.filter((r) => r.send_status === "failed").length;
  const tapped = rows.filter((r) => r.tapped_at).length;
  const completed = rows.filter((r) => r.completed_at).length;

  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  return NextResponse.json({
    ok: true,
    funnel: {
      total: rows.length,
      accepted,
      failed,
      tapped,
      completed,
      tap_rate_pct: pct(tapped, accepted),
      completion_rate_pct: pct(completed, accepted),
    },
    rows,
  });
}
