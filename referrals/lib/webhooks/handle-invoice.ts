import { getServerSupabase } from "@/lib/supabase";
import { getServiceTitanClient } from "@/lib/servicetitan";
import { classifyActualCategory } from "@/lib/rewards/classify-actual";
import { findReferralByCustomerId } from "./match-referral";
import { finalizeConversion } from "./finalize-conversion";

interface InvoiceCreatedPayload {
  invoiceId?: number;
  customerId?: number;
  jobId?: number;
  total?: number;
  // ST webhook envelopes wrap these under `data` — we accept either shape
  data?: {
    invoiceId?: number;
    customerId?: number;
    jobId?: number;
    total?: number;
  };
}

export async function handleInvoiceCreated(
  rawPayload: Record<string, unknown>
): Promise<{ matched: boolean; reason?: string; referralId?: string }> {
  const p = rawPayload as InvoiceCreatedPayload;
  const invoiceId = p.invoiceId ?? p.data?.invoiceId;
  const customerId = p.customerId ?? p.data?.customerId;
  const jobId = p.jobId ?? p.data?.jobId;

  if (!invoiceId || !customerId) {
    return { matched: false, reason: "Missing invoiceId or customerId in payload" };
  }

  const referral = await findReferralByCustomerId(customerId);
  if (!referral) return { matched: false, reason: "No matching referral found" };

  // Already processed? idempotent exit
  if (
    referral.status === "COMPLETED" ||
    referral.status === "REWARD_ISSUED"
  ) {
    return { matched: true, reason: "Already processed", referralId: referral.id };
  }

  // Fetch job + invoice details from ST for classification + totals
  const st = getServiceTitanClient();
  const [job, invoice] = await Promise.all([
    jobId ? st.getJob(jobId) : Promise.resolve(null),
    st.getInvoice(invoiceId),
  ]);

  const invoiceTotal = invoice?.total ?? p.total ?? p.data?.total ?? 0;
  // ST sends webhook events on invoice create AND on updates (including
  // payment). We only want to issue rewards when the invoice is fully paid
  // — balance === 0 with a positive total. Open/partial invoices move the
  // referral to BOOKED status (so dispatch + admin see it's in flight) and
  // exit early. ST will fire another webhook on the payment event, which
  // re-enters this handler and falls through to reward creation.
  const invoiceBalance = invoice?.balance ?? null;
  const isPaid =
    invoiceTotal > 0 && invoiceBalance !== null && Number(invoiceBalance) <= 0;

  if (!isPaid) {
    const supabase = getServerSupabase();
    // Advance to BOOKED on first sight of the invoice, preserve whatever ST
    // IDs we now know. Do NOT set job_completed_at — it's not complete yet.
    const bookedUpdate: Record<string, unknown> = {
      service_titan_job_id: jobId ? String(jobId) : referral.service_titan_job_id,
      service_titan_invoice_id: String(invoiceId),
      invoice_total: invoiceTotal,
    };
    if (referral.status === "SUBMITTED") {
      bookedUpdate.status = "BOOKED";
    }
    await supabase
      .from("ref_referrals")
      .update(bookedUpdate)
      .eq("id", referral.id);
    return {
      matched: true,
      reason: `Invoice not yet paid (balance=${invoiceBalance ?? "unknown"}, total=${invoiceTotal})`,
      referralId: referral.id,
    };
  }

  const actualCategory = classifyActualCategory(job, invoice);

  // Run the shared conversion finalizer — also used by the admin simulate
  // flow in /api/admin/referrals/[id]/simulate-completion. Keeping both
  // paths on the same function means tests exercise the same code the
  // real webhook runs.
  await finalizeConversion({
    referral,
    invoiceTotal,
    actualCategory,
    serviceTitanJobId: jobId ? String(jobId) : null,
    serviceTitanInvoiceId: String(invoiceId),
  });

  return { matched: true, referralId: referral.id };
}
