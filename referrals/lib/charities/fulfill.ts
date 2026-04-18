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

  // TREMENDOUS path
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

  // Prefer the charity-specific Tremendous product ID if set;
  // fall back to the generic charity product env var.
  const productId =
    charity.tremendous_charity_id || tremendous.getProductId("CHARITY");
  if (!productId) {
    await supabase
      .from("ref_charity_donations")
      .update({
        status: "FAILED",
        failure_reason: "No Tremendous product ID for this charity",
      })
      .eq("id", donationId);
    return { ok: false, reason: "Missing Tremendous product ID" };
  }

  // Pull referral + referrer for recipient info (donation delivery email
  // goes to the referrer with a thank-you-for-the-referral framing)
  const { data: referralRow } = await supabase
    .from("ref_referrals")
    .select("*, referrer:ref_referrers(*)")
    .eq("id", d.referral_id)
    .single();

  if (!referralRow) return { ok: false, reason: "Referral not found" };
  const referrer = (referralRow as Referral & { referrer: Referrer }).referrer;

  try {
    const orderId = await tremendous.createOrder({
      amount: Number(d.amount),
      recipient: {
        name: `${referrer.first_name} ${referrer.last_name}`.trim(),
        email: referrer.email,
      },
      productId,
      customFields: [
        { id: "referral_id", value: d.referral_id },
        { id: "charity_id", value: d.charity_id },
      ],
    });

    await supabase
      .from("ref_charity_donations")
      .update({
        status: "ISSUED",
        fulfillment_reference: orderId,
        issued_at: new Date().toISOString(),
      })
      .eq("id", donationId);

    // Bump the referrer's lifetime charity impact counter
    await supabase
      .from("ref_referrers")
      .update({
        total_donated_on_their_behalf:
          Number(referrer.total_donated_on_their_behalf) + Number(d.amount),
      })
      .eq("id", referrer.id);

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
