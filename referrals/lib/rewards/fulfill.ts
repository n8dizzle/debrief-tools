import { getServerSupabase } from "@/lib/supabase";
import { getTremendousClient, type TremendousProduct } from "@/lib/tremendous";
import type { Referrer, Reward, RewardType } from "@/lib/supabase";

const PRODUCT_BY_REWARD_TYPE: Record<RewardType, TremendousProduct | null> = {
  // Both Visa and Amazon reward preferences now route through the shared
  // Tremendous campaign — the referrer's original pick is still stored for
  // analytics, but the recipient picks their actual card at redemption.
  VISA_GIFT_CARD: "GIFT_CARD",
  AMAZON_GIFT_CARD: "GIFT_CARD",
  CHARITY_DONATION: "CHARITY",
  ACCOUNT_CREDIT: null, // ServiceTitan credit — manual MVP
};

/**
 * Fulfill an APPROVED reward by dispatching through the right channel.
 *
 * - VISA / AMAZON / CHARITY → Tremendous order → status becomes ISSUED
 * - ACCOUNT_CREDIT → leaves status APPROVED, flagged for manual issuance
 *   (no ServiceTitan credit-memo API integration in MVP)
 *
 * Idempotent: re-running on ISSUED/DELIVERED is a no-op. On failure, status
 * flips to FAILED with failure_reason so admin can retry.
 */
export async function fulfillReward(rewardId: string): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const supabase = getServerSupabase();

  const { data: reward } = await supabase
    .from("ref_rewards")
    .select("*")
    .eq("id", rewardId)
    .single();

  if (!reward) return { ok: false, reason: "Reward not found" };

  const r = reward as Reward;
  if (r.status === "ISSUED" || r.status === "DELIVERED") {
    return { ok: true, reason: "Already issued" };
  }
  if (r.status !== "APPROVED") {
    return { ok: false, reason: `Reward not in APPROVED state (got ${r.status})` };
  }

  // ACCOUNT_CREDIT sits for manual handling — not a failure
  if (r.type === "ACCOUNT_CREDIT") {
    return { ok: true, reason: "ACCOUNT_CREDIT requires manual ServiceTitan issuance" };
  }

  const product = PRODUCT_BY_REWARD_TYPE[r.type];
  if (!product) {
    return { ok: false, reason: `Unsupported reward type: ${r.type}` };
  }

  // Pull referrer for recipient info
  const { data: referrerRow } = await supabase
    .from("ref_referrers")
    .select("*")
    .eq("id", r.referrer_id)
    .single();

  if (!referrerRow) return { ok: false, reason: "Referrer not found" };
  const referrer = referrerRow as Referrer;

  const tremendous = getTremendousClient();
  if (!tremendous.isConfigured()) {
    await supabase
      .from("ref_rewards")
      .update({
        status: "FAILED",
        failure_reason: "Tremendous credentials not configured",
      })
      .eq("id", rewardId);
    return { ok: false, reason: "Tremendous not configured" };
  }

  // GIFT_CARD rewards route through the Tremendous campaign (bundle of card
  // options, recipient picks at redeem). CHARITY rewards route through a
  // specific product ID because donations must name a specific nonprofit.
  // Campaigns and products are mutually exclusive at the Tremendous API
  // level, and there is no silent fallback — if the right config is missing
  // the reward flips to FAILED so the admin notices.
  const campaignId =
    product === "GIFT_CARD" ? tremendous.getCampaignId() : null;
  const productId =
    product === "CHARITY" ? tremendous.getProductId(product) : null;

  if (!campaignId && !productId) {
    const missing =
      product === "GIFT_CARD"
        ? "TREMENDOUS_CAMPAIGN_ID not set"
        : "TREMENDOUS_CHARITY_PRODUCT_ID not set";
    await supabase
      .from("ref_rewards")
      .update({
        status: "FAILED",
        failure_reason: missing,
      })
      .eq("id", rewardId);
    return { ok: false, reason: missing };
  }

  try {
    // No customFields: Tremendous rejects unregistered custom field IDs with
    // a 400. We don't pre-register any in this org. Audit trail lives in our
    // own ref_rewards row (tremendous_order_id stores the returned ID so you
    // can cross-reference). If we ever want filters/search inside Tremendous
    // by referral_id, register the field in their dashboard first, then
    // re-add it here.
    const { orderId, status: tStatus } = await tremendous.createOrder({
      amount: Number(r.amount),
      recipient: {
        name: `${referrer.first_name} ${referrer.last_name}`.trim(),
        email: referrer.email,
      },
      ...(campaignId ? { campaignId } : { productId: productId! }),
    });

    // Tremendous-side state drives how far we advance our own status. When
    // order-approvals are enabled, the first response is "pending_approval"
    // and nothing has been emailed yet — we stay at APPROVED (meaning "our
    // side signed off, waiting on Tremendous review"). Only on approved/
    // executed do we flip to ISSUED + propagate to the parent referral.
    const isFullyIssued = tStatus === "approved" || tStatus === "executed";
    const isDeclined = tStatus === "declined" || tStatus === "failed";

    const rewardUpdate: Record<string, unknown> = {
      tremendous_order_id: orderId,
      tremendous_status: tStatus,
    };
    if (isFullyIssued) {
      rewardUpdate.status = "ISSUED";
      rewardUpdate.issued_at = new Date().toISOString();
    } else if (isDeclined) {
      rewardUpdate.status = "FAILED";
      rewardUpdate.failure_reason = `Tremendous ${tStatus} the order`;
    }
    // For "pending_approval" we leave status at APPROVED — the order exists
    // in Tremendous but hasn't delivered. Admin will finalize it over there.

    await supabase.from("ref_rewards").update(rewardUpdate).eq("id", rewardId);

    if (isFullyIssued) {
      await supabase
        .from("ref_referrals")
        .update({
          status: "REWARD_ISSUED",
          reward_issued_at: new Date().toISOString(),
        })
        .eq("id", r.referral_id);
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Reward ${rewardId} fulfillment failed:`, message);
    await supabase
      .from("ref_rewards")
      .update({
        status: "FAILED",
        failure_reason: message.slice(0, 500),
      })
      .eq("id", rewardId);
    return { ok: false, reason: message };
  }
}
