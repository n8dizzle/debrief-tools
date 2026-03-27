import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

// Retell sends webhook events for call lifecycle
// This endpoint is excluded from auth middleware
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, call } = body;

    console.log(`Retell webhook: ${event}`, call?.call_id);

    if (!call?.call_id) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getServerSupabase();

    switch (event) {
      case "call_started": {
        await supabase
          .from("retell_calls")
          .update({ status: "active", started_at: new Date().toISOString() })
          .eq("call_id", call.call_id);
        break;
      }

      case "call_ended": {
        await supabase
          .from("retell_calls")
          .update({
            status: "ended",
            ended_at: new Date().toISOString(),
            duration_ms: call.duration_ms || null,
            transcript: call.transcript || null,
            recording_url: call.recording_url || null,
            disconnection_reason: call.disconnection_reason || null,
          })
          .eq("call_id", call.call_id);
        break;
      }

      case "call_analyzed": {
        await supabase
          .from("retell_calls")
          .update({
            call_analysis: call.call_analysis || null,
          })
          .eq("call_id", call.call_id);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    // Always return 200 to prevent retries on processing errors
    return NextResponse.json({ ok: true });
  }
}
