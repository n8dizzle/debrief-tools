import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServerSupabase } from "@/lib/supabase";
import { sendSMS, formatPhoneE164 } from "@/lib/quo";

export const runtime = "nodejs";

// GATED (CRON_SECRET). Sends the Phase 0 spike link to a list of techs and records
// one spike_taps row per recipient. This texts REAL people — it only runs when called
// deliberately with the secret. Body:
//   { recipients: [{ name, phone }], baseUrl: "https://...", message?: "..." }
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if unconfigured
  const header = req.headers.get("x-cron-secret");
  const query = new URL(req.url).searchParams.get("secret");
  return header === secret || query === secret;
}

interface Recipient {
  name?: string;
  phone: string;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { recipients?: Recipient[]; baseUrl?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const recipients = body.recipients || [];
  const baseUrl = (body.baseUrl || "").replace(/\/$/, "");
  if (!recipients.length) {
    return NextResponse.json({ ok: false, error: "no recipients" }, { status: 400 });
  }
  if (!baseUrl) {
    return NextResponse.json({ ok: false, error: "baseUrl required" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  type SendResult = { tech_name?: string | null; phone?: string | null; send_status: string; error?: string };
  const results: SendResult[] = [];

  for (const r of recipients) {
    try {
      const e164 = formatPhoneE164(r.phone || "");
      const token = randomBytes(6).toString("hex"); // 12 hex chars, plenty for a spike

      if (!e164) {
        // Record the bad number so it shows in results, but don't attempt a send.
        await supabase.from("spike_taps").insert({
          token,
          tech_name: r.name ?? null,
          phone: r.phone ?? null,
          send_status: "failed",
          send_error: "invalid phone format",
        });
        results.push({ tech_name: r.name, phone: r.phone, send_status: "failed", error: "invalid phone format" });
        continue;
      }

      // Dedup by phone: re-running send must NOT double-text or double-count. A
      // duplicate row would silently halve the funnel's tap/completion rates —
      // and the funnel's numbers are the whole point of the spike.
      const { data: existing } = await supabase
        .from("spike_taps")
        .select("id")
        .eq("phone", e164)
        .maybeSingle();
      if (existing) {
        results.push({ tech_name: r.name, phone: e164, send_status: "skipped", error: "already sent to this number" });
        continue;
      }

      const link = `${baseUrl}/train?t=${token}`;
      const message =
        body.message?.replace("{link}", link) ||
        `Christmas Air: quick 30-sec training test. Tap to start: ${link}`;

      const sent = await sendSMS(e164, message);

      await supabase.from("spike_taps").insert({
        token,
        tech_name: r.name ?? null,
        phone: e164,
        sent_at: new Date().toISOString(),
        send_status: sent.success ? "accepted" : "failed",
        send_error: sent.success ? null : sent.error ?? "send failed",
        provider_msg_id: sent.messageId ?? null,
      });

      results.push({
        tech_name: r.name,
        phone: e164,
        send_status: sent.success ? "accepted" : "failed",
        error: sent.success ? undefined : sent.error,
      });
    } catch (err) {
      // One bad recipient must not abort the whole batch (partial send + blind funnel).
      results.push({
        tech_name: r.name,
        phone: r.phone,
        send_status: "failed",
        error: err instanceof Error ? err.message : "error",
      });
    }
  }

  const accepted = results.filter((r) => r.send_status === "accepted").length;
  const failed = results.filter((r) => r.send_status === "failed").length;
  const skipped = results.filter((r) => r.send_status === "skipped").length;
  return NextResponse.json({
    ok: true,
    sent: accepted,
    failed,
    skipped,
    total: results.length,
    results,
  });
}
