import { getServerSupabase } from "@/lib/supabase";
import { resolveTierForConversion } from "@/lib/rewards/resolve-tier";
import {
  calculateReward,
  calculateCharityMatch,
  tierRequiresApproval,
} from "@/lib/rewards/calculate";
import { sendReferralCompletedEmail } from "@/lib/email/referral-completed";
import { fulfillReward } from "@/lib/rewards/fulfill";
import { fulfillCharityDonation } from "@/lib/charities/fulfill";
import type {
  Charity,
  Referrer,
  Referral,
  RewardType,
  ServiceCategory,
} from "@/lib/supabase";

// Gift-card redemption happens through the Tremendous catalog — the recipient
// picks their brand when the email arrives. The enum values stay brand-specific
// for legacy rows, but the customer-facing label is catalog-agnostic.
const REWARD_TYPE_LABEL: Record<RewardType, string> = {
  VISA_GIFT_CARD: "gift card",
  AMAZON_GIFT_CARD: "gift card",
  ACCOUNT_CREDIT: "account credit",
  CHARITY_DONATION: "charity donation",
};

export interface FinalizeConversionInput {
  /** The referral we've matched — must already be in SUBMITTED or BOOKED. */
  referral: Referral;
  /** Authoritative invoice total (from ST or admin-provided for simulations). */
  invoiceTotal: number;
  /** Actual service category — classified from ST data for real webhooks,
   *  admin-selected for simulations. Drives the reward tier lookup. */
  actualCategory: ServiceCategory;
  /** ST job ID if we know it. Null for simulations. */
  serviceTitanJobId: string | null;
  /** ST invoice ID. For simulations, use a synthetic value like
   *  `SIM-{timestamp}` — stored as-is so the admin can tell simulated
   *  conversions from real ones when auditing. */
  serviceTitanInvoiceId: string;
  /** True when called from the admin simulate-completion flow. Affects
   *  logging only — downstream behavior (reward + fulfillment) matches
   *  real conversions so the test actually exercises the same paths. */
  simulated?: boolean;
}

export interface FinalizeConversionResult {
  referralId: string;
  rewardId: string | null;
  rewardStatus: "PENDING" | "APPROVED" | null;
  donationId: string | null;
  rewardAmount: number;
  charityAmount: number;
}

/**
 * Finalize a paid-invoice referral conversion. Extracted from handle-invoice.ts
 * so both the real webhook path and the admin simulate-completion flow can
 * share the exact same reward + donation + email + fulfillment logic.
 *
 * Preconditions (caller's responsibility):
 *  - Referral has been matched (caller knows which referral).
 *  - Invoice is paid (balance <= 0). The webhook path checks this; simulate
 *    path trusts the admin.
 *  - Referral is not already COMPLETED / REWARD_ISSUED (caller should short
 *    circuit those cases — we re-check anyway and return early).
 *
 * Side effects:
 *  - ref_referrals row → status COMPLETED, snapshot updated
 *  - ref_rewards row inserted (PENDING or APPROVED per tier config)
 *  - ref_charity_donations row inserted if triple_win_activated + charity set
 *  - ref_referrers.total_earned bumped on auto-approved rewards
 *  - Email to the referrer (fire-and-forget)
 *  - Tremendous order queued (fire-and-forget) for auto-approved rewards
 */
export async function finalizeConversion(
  input: FinalizeConversionInput
): Promise<FinalizeConversionResult> {
  const { referral, invoiceTotal, actualCategory, simulated } = input;
  const supabase = getServerSupabase();

  // Idempotent exit — don't double-process.
  if (
    referral.status === "COMPLETED" ||
    referral.status === "REWARD_ISSUED"
  ) {
    return {
      referralId: referral.id,
      rewardId: null,
      rewardStatus: null,
      donationId: null,
      rewardAmount: 0,
      charityAmount: 0,
    };
  }

  const resolved = await resolveTierForConversion(referral, actualCategory);
  if (!resolved) {
    console.warn(
      `No tier for config=${referral.reward_config_id} category=${actualCategory} — flagging for admin (referral=${referral.id}${simulated ? ", simulated" : ""})`
    );
  }

  const rewardAmount = resolved ? calculateReward(invoiceTotal, resolved.tier) : 0;
  const charityAmount =
    resolved && referral.triple_win_activated
      ? calculateCharityMatch(rewardAmount, resolved.tier)
      : 0;
  const requiresApproval = resolved ? tierRequiresApproval(resolved.tier) : true;

  // Update the referral row
  const referralUpdate: Record<string, unknown> = {
    status: "COMPLETED",
    service_titan_job_id: input.serviceTitanJobId ?? referral.service_titan_job_id,
    service_titan_invoice_id: input.serviceTitanInvoiceId,
    invoice_total: invoiceTotal,
    service_category: actualCategory,
    job_completed_at: new Date().toISOString(),
  };
  if (resolved?.snapshotForUpdate) {
    referralUpdate.snapshot_tier_json = resolved.snapshotForUpdate;
  }
  await supabase
    .from("ref_referrals")
    .update(referralUpdate)
    .eq("id", referral.id);

  // Pull the referrer for reward type + email
  const { data: referrerRow } = await supabase
    .from("ref_referrers")
    .select("*")
    .eq("id", referral.referrer_id)
    .single();

  if (!referrerRow) {
    console.error(
      `Referrer vanished during conversion — not sending email: ${referral.referrer_id}`
    );
    return {
      referralId: referral.id,
      rewardId: null,
      rewardStatus: null,
      donationId: null,
      rewardAmount,
      charityAmount,
    };
  }
  const referrer = referrerRow as Referrer;

  let rewardId: string | null = null;
  let donationId: string | null = null;
  const rewardStatus: "PENDING" | "APPROVED" | null =
    rewardAmount > 0 ? (requiresApproval ? "PENDING" : "APPROVED") : null;

  if (rewardAmount > 0 && rewardStatus) {
    const { data: insertedReward } = await supabase
      .from("ref_rewards")
      .insert({
        referral_id: referral.id,
        referrer_id: referrer.id,
        amount: rewardAmount,
        type: referrer.reward_preference,
        status: rewardStatus,
      })
      .select("id")
      .single();

    rewardId = insertedReward?.id || null;

    if (
      referral.triple_win_activated &&
      referral.snapshot_charity_id &&
      charityAmount > 0
    ) {
      const { data: insertedDonation } = await supabase
        .from("ref_charity_donations")
        .insert({
          referral_id: referral.id,
          charity_id: referral.snapshot_charity_id,
          amount: charityAmount,
          status: rewardStatus,
        })
        .select("id")
        .single();

      donationId = insertedDonation?.id || null;
    }

    // Auto-approved rewards: bump the lifetime counter immediately. Manual
    // approvals bump via the /admin/rewards/[id]/approve route.
    if (rewardStatus === "APPROVED") {
      await supabase
        .from("ref_referrers")
        .update({
          total_earned: Number(referrer.total_earned) + rewardAmount,
          lifetime_referrals: referrer.lifetime_referrals + 1,
        })
        .eq("id", referrer.id);
    }
  }

  // Resolve charity name for email
  let charityName: string | null = null;
  if (referral.triple_win_activated && referral.snapshot_charity_id) {
    const { data } = await supabase
      .from("ref_charities")
      .select("name")
      .eq("id", referral.snapshot_charity_id)
      .single();
    charityName = (data as Charity | null)?.name || null;
  }

  const appUrl = process.env.NEXTAUTH_URL || "https://refer.christmasair.com";
  const friendFirstName =
    referral.referred_name.split(/\s+/)[0] || "your neighbor";

  // Fire-and-forget email + fulfillment — caller returns before these settle.
  sendReferralCompletedEmail({
    to: referrer.email,
    referrerFirstName: referrer.first_name,
    friendFirstName,
    rewardAmount,
    rewardLabel: REWARD_TYPE_LABEL[referrer.reward_preference] || "reward",
    pendingApproval: requiresApproval,
    dashboardUrl: `${appUrl}/dashboard`,
    tripleWinCharityName: charityName,
    charityAmount: charityAmount || null,
  }).catch((err) => console.error("Completed email failed:", err));

  if (rewardStatus === "APPROVED" && rewardId) {
    fulfillReward(rewardId).catch((err) =>
      console.error(`Auto-fulfill reward ${rewardId} failed:`, err)
    );
  }
  if (rewardStatus === "APPROVED" && donationId) {
    fulfillCharityDonation(donationId).catch((err) =>
      console.error(`Auto-fulfill donation ${donationId} failed:`, err)
    );
  }

  return {
    referralId: referral.id,
    rewardId,
    rewardStatus,
    donationId,
    rewardAmount,
    charityAmount,
  };
}
