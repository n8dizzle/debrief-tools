import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { verifyWebhookSignature } from "@/lib/webhooks/verify";
import { processWebhookEvent } from "@/lib/webhooks/process";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature =
    req.headers.get("servicetitan-signature") ||
    req.headers.get("x-servicetitan-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType =
    (payload.eventType as string) ||
    (payload.event as string) ||
    "unknown";

  // Persist first — idempotency + audit trail
  const supabase = getServerSupabase();
  const { data: event, error: insertErr } = await supabase
    .from("ref_webhook_events")
    .insert({
      source: "servicetitan",
      event_type: eventType,
      payload,
    })
    .select("id")
    .single();

  if (insertErr || !event) {
    console.error("Webhook persist failed:", insertErr);
    return NextResponse.json({ error: "Could not persist event" }, { status: 500 });
  }

  // Process asynchronously — return 200 quickly so ST doesn't retry
  processWebhookEvent(event.id).catch((err) =>
    console.error("Background webhook processing failed:", err)
  );

  return NextResponse.json({ received: true, eventId: event.id });
}
