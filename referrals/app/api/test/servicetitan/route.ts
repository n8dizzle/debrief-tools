import { NextResponse } from "next/server";
import { getServiceTitanClient } from "@/lib/servicetitan";

/**
 * Sprint 1 smoke test: confirms ServiceTitan credentials are wired up correctly.
 * Remove once the integration is stable.
 */
export async function GET() {
  const client = getServiceTitanClient();

  if (!client.isConfigured()) {
    return NextResponse.json(
      { ok: false, error: "ServiceTitan credentials not configured" },
      { status: 500 }
    );
  }

  const ok = await client.ping();
  return NextResponse.json({ ok });
}
