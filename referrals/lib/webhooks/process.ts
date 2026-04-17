import { getServerSupabase } from "@/lib/supabase";
import { handleInvoiceCreated } from "./handle-invoice";

/**
 * Process a stored webhook event. Idempotent: re-running on a processed event
 * is a no-op.
 */
export async function processWebhookEvent(eventId: string): Promise<void> {
  const supabase = getServerSupabase();
  const { data: event } = await supabase
    .from("ref_webhook_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (!event) return;
  if (event.processed_at) return; // already processed

  let result: { matched: boolean; reason?: string; referralId?: string } = {
    matched: false,
  };
  let error: string | null = null;

  try {
    switch (event.event_type) {
      case "invoice.created":
      case "invoice.updated":
        result = await handleInvoiceCreated(event.payload);
        break;

      case "job.completed":
        // MVP: treat job.completed as a backup signal — invoice.created is the
        // authoritative trigger because it carries the total we need. If we see
        // a job.completed but no invoice.created arrives, Sprint 5 will add a
        // 24h reconciliation poll.
        console.log("job.completed seen — waiting for invoice.created");
        break;

      case "customer.created":
      case "job.created":
        // Informational — log and skip. In a later sprint, we could backfill
        // service_titan_customer_id on pending referrals here.
        break;

      default:
        console.log(`Unhandled ST event type: ${event.event_type}`);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.error(`Webhook processing failed for ${event.event_type}:`, err);
  }

  await supabase
    .from("ref_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      processing_error: error,
    })
    .eq("id", eventId);

  if (result.reason) {
    console.log(`[webhook ${event.event_type}] ${result.reason}`);
  }
}
