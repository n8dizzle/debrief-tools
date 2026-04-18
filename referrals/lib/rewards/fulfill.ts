import { getServerSupabase } from "@/lib/supabase";
import { getTremendousClient, type TremendousProduct } from "@/lib/tremendous";
import type { Referrer, Reward, RewardType } from "@/lib/supabase";

const PRODUCT_BY_REWARD_TYPE: Record<RewardType, TremendousProduct | null> = {
  VISA_GIFT_CARD: "VISA",
  AMAZON_GIFT_CARD: "AMAZON",
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

  const productId = tremendous.getProductId(product);
  if (!productId) {
    await supabase
      .from("ref_rewards")
      .update({
        status: "FAILED",
        failure_reason: `No product ID configured for ${product}`,
      })
      .eq("id", rewardId);
    return { ok: false, reason: `Missing product ID for ${product}` };
  }

  try {
    const orderId = await tremendous.createOrder({
      amount: Number(r.amount),
      recipient: {
        name: `${referrer.first_name} ${referrer.last_name}`.trim(),
        email: referrer.email,
      },
      productId,
      customFields: [{ id: "referral_id", value: r.referral_id }],
    });

    await supabase
      .from("ref_rewards")
      .update({
        status: "ISSUED",
        tremendous_order_id: orderId,
        issued_at: new Date().toISOString(),
      })
      .eq("id", rewardId);

    // Mark the parent referral as REWARD_ISSUED
    await supabase
      .from("ref_referrals")
      .update({
        status: "REWARD_ISSUED",
        reward_issued_at: new Date().toISOString(),
      })
      .eq("id", r.referral_id);

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
