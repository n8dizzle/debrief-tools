import { NextResponse } from "next/server";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getTremendousClient } from "@/lib/tremendous";

export const dynamic = "force-dynamic";

/**
 * Lightweight connectivity check against Tremendous. Verifies the API key +
 * funding source configuration by fetching /funding_sources. Returns a simple
 * ok/reason payload so the admin UI can display green/red without leaking
 * credentials.
 */
export async function POST() {
  const admin = await requireReferralsAdmin("can_manage_settings");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const client = getTremendousClient();
  if (!client.isConfigured()) {
    return NextResponse.json({
      ok: false,
      reason:
        "Tremendous credentials not configured. Set TREMENDOUS_API_KEY and TREMENDOUS_FUNDING_SOURCE_ID env vars.",
    });
  }

  try {
    const ok = await client.ping();
    return NextResponse.json({
      ok,
      reason: ok ? "Connected" : "Ping failed — credentials may be invalid",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, reason: message });
  }
}
