import { getServerSupabase } from "@/lib/supabase";
import { getTremendousClient } from "@/lib/tremendous";
import type {
  Charity,
  CharityDonation,
  Referrer,
  Referral,
} from "@/lib/supabase";

/**
 * Fulfill an APPROVED charity donation.
 *
 * Dispatch by charity.fulfillment_method:
 *  - TREMENDOUS        → immediate Tremendous order against the charity product
 *  - POOLED_QUARTERLY  → stays APPROVED; quarterly batch (Sprint 5+) issues
 *  - DIRECT_PAYMENT    → stays APPROVED; Christmas Air cuts a check manually
 *
 * On successful TREMENDOUS fulfillment, updates:
 *  - ref_charity_donations.status → ISSUED + fulfillment_reference + issued_at
 *  - ref_referrers.total_donated_on_their_behalf (cumulative impact counter)
 */
export async function fulfillCharityDonation(donationId: string): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const supabase = getServerSupabase();

  const { data: donation } = await supabase
    .from("ref_charity_donations")
    .select("*")
    .eq("id", donationId)
    .single();

  if (!donation) return { ok: false, reason: "Donation not found" };

  const d = donation as CharityDonation;
  if (d.status === "ISSUED" || d.status === "CONFIRMED") {
    return { ok: true, reason: "Already issued" };
  }
  if (d.status !== "APPROVED") {
    return { ok: false, reason: `Donation not APPROVED (got ${d.status})` };
  }

  const { data: charityRow } = await supabase
    .from("ref_charities")
    .select("*")
    .eq("id", d.charity_id)
    .single();

  if (!charityRow) return { ok: false, reason: "Charity not found" };
  const charity = charityRow as Charity;

  // Non-Tremendous methods: leave APPROVED for manual / batch handling
  if (charity.fulfillment_method === "POOLED_QUARTERLY") {
    return { ok: true, reason: "Queued for quarterly batch" };
  }
  if (charity.fulfillment_method === "DIRECT_PAYMENT") {
    return { ok: true, reason: "Queued for manual disbursement" };
  }

  // TREMENDOUS path — preserved for future use. No charity currently uses
  // this method (Christmas Air went local-only on charities). When this path
  // is re-enabled, each charity must have its own tremendous_charity_id set
  // on ref_charities — no env-var fallback, no generic charity product.
  const tremendous = getTremendousClient();
  if (!tremendous.isConfigured()) {
    await supabase
      .from("ref_charity_donations")
      .update({
        status: "FAILED",
        failure_reason: "Tremendous credentials not configured",
      })
      .eq("id", donationId);
    return { ok: false, reason: "Tremendous not configured" };
  }

  const productId = charity.tremendous_charity_id;
  if (!productId) {
    await supabase
      .from("ref_charity_donations")
      .update({
        status: "FAILED",
        failure_reason: `Charity "${charity.name}" has fulfillment_method=TREMENDOUS but no tremendous_charity_id set`,
      })
      .eq("id", donationId);
    return { ok: false, reason: "Missing tremendous_charity_id on charity" };
  }

  const { data: referralRow } = await supabase
    .from("ref_referrals")
    .select("*, referrer:ref_referrers(*)")
    .eq("id", d.referral_id)
    .single();

  if (!referralRow) return { ok: false, reason: "Referral not found" };
  const referrer = (referralRow as Referral & { referrer: Referrer }).referrer;

  try {
    const { orderId, status: tStatus } = await tremendous.createOrder({
      amount: Number(d.amount),
      recipient: {
        name: `${referrer.first_name} ${referrer.last_name}`.trim(),
        email: referrer.email,
      },
      productId,
    });

    const isFullyIssued = tStatus === "approved" || tStatus === "executed";
    const isDeclined = tStatus === "declined" || tStatus === "failed";

    const donationUpdate: Record<string, unknown> = {
      fulfillment_reference: orderId,
    };
    if (isFullyIssued) {
      donationUpdate.status = "ISSUED";
      donationUpdate.issued_at = new Date().toISOString();
    } else if (isDeclined) {
      donationUpdate.status = "FAILED";
      donationUpdate.failure_reason = `Tremendous ${tStatus} the order`;
    }
    // pending_approval keeps status = APPROVED; waiting on Tremendous-side review.

    await supabase
      .from("ref_charity_donations")
      .update(donationUpdate)
      .eq("id", donationId);

    if (isFullyIssued) {
      // Bump the referrer's lifetime charity impact counter only once the
      // donation is truly issued — not while pending Tremendous approval.
      await supabase
        .from("ref_referrers")
        .update({
          total_donated_on_their_behalf:
            Number(referrer.total_donated_on_their_behalf) + Number(d.amount),
        })
        .eq("id", referrer.id);
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Donation ${donationId} fulfillment failed:`, message);
    await supabase
      .from("ref_charity_donations")
      .update({
        status: "FAILED",
        failure_reason: message.slice(0, 500),
      })
      .eq("id", donationId);
    return { ok: false, reason: message };
  }
}
