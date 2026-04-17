import { getServerSupabase } from "@/lib/supabase";
import { getServiceTitanClient } from "@/lib/servicetitan";
import { classifyActualCategory } from "@/lib/rewards/classify-actual";
import { resolveTierForConversion } from "@/lib/rewards/resolve-tier";
import {
  calculateReward,
  calculateCharityMatch,
  tierRequiresApproval,
} from "@/lib/rewards/calculate";
import { findReferralByCustomerId } from "./match-referral";
import { sendReferralCompletedEmail } from "@/lib/email/referral-completed";
import { fulfillReward } from "@/lib/rewards/fulfill";
import { fulfillCharityDonation } from "@/lib/charities/fulfill";
import type { Charity, Referrer, Referral, RewardType } from "@/lib/supabase";

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

const REWARD_TYPE_LABEL: Record<RewardType, string> = {
  VISA_GIFT_CARD: "Visa gift card",
  AMAZON_GIFT_CARD: "Amazon credit",
  ACCOUNT_CREDIT: "account credit",
  CHARITY_DONATION: "charity donation",
};

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
  const actualCategory = classifyActualCategory(job, invoice);

  const resolved = await resolveTierForConversion(referral, actualCategory);
  if (!resolved) {
    console.warn(
      `No tier for config=${referral.reward_config_id} category=${actualCategory} — flagging for admin`
    );
  }

  const rewardAmount = resolved ? calculateReward(invoiceTotal, resolved.tier) : 0;
  const charityAmount =
    resolved && referral.triple_win_activated
      ? calculateCharityMatch(rewardAmount, resolved.tier)
      : 0;
  const requiresApproval = resolved ? tierRequiresApproval(resolved.tier) : true;

  const supabase = getServerSupabase();

  // Update the referral row
  const referralUpdate: Record<string, unknown> = {
    status: "COMPLETED",
    service_titan_job_id: jobId ? String(jobId) : referral.service_titan_job_id,
    service_titan_invoice_id: String(invoiceId),
    invoice_total: invoiceTotal,
    service_category: actualCategory,
    job_completed_at: new Date().toISOString(),
  };
  if (resolved?.snapshotForUpdate) {
    referralUpdate.snapshot_tier_json = resolved.snapshotForUpdate;
  }

  await supabase.from("ref_referrals").update(referralUpdate).eq("id", referral.id);

  // Pull the referrer for reward type + email
  const { data: referrerRow } = await supabase
    .from("ref_referrers")
    .select("*")
    .eq("id", referral.referrer_id)
    .single();

  if (!referrerRow) {
    console.error("Referrer vanished during conversion — not sending email:", referral.referrer_id);
    return { matched: true, reason: "Referrer missing", referralId: referral.id };
  }
  const referrer = referrerRow as Referrer;

  // Create reward + optional charity donation. For auto-approved rewards
  // (the common case), kick off Tremendous fulfillment asynchronously after.
  let rewardIdToFulfill: string | null = null;
  let donationIdToFulfill: string | null = null;

  if (rewardAmount > 0) {
    const rewardStatus = requiresApproval ? "PENDING" : "APPROVED";
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

    if (!requiresApproval && insertedReward) {
      rewardIdToFulfill = insertedReward.id;
    }

    if (referral.triple_win_activated && referral.snapshot_charity_id && charityAmount > 0) {
      const { data: insertedDonation } = await supabase
        .from("ref_charity_donations")
        .insert({
          referral_id: referral.id,
          charity_id: referral.snapshot_charity_id,
          amount: charityAmount,
          status: requiresApproval ? "PENDING" : "APPROVED",
        })
        .select("id")
        .single();

      if (!requiresApproval && insertedDonation) {
        donationIdToFulfill = insertedDonation.id;
      }
    }

    // total_earned tracks what the referrer EARNED (not what was delivered).
    // Updates happen on auto-approval; manual approvals bump it via the admin route.
    if (!requiresApproval) {
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
  const friendFirstName = referral.referred_name.split(/\s+/)[0] || "your neighbor";

  // Fire-and-forget: email + auto-fulfillment. Webhook responds 200 regardless.
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

  if (rewardIdToFulfill) {
    fulfillReward(rewardIdToFulfill).catch((err) =>
      console.error(`Auto-fulfill reward ${rewardIdToFulfill} failed:`, err)
    );
  }
  if (donationIdToFulfill) {
    fulfillCharityDonation(donationIdToFulfill).catch((err) =>
      console.error(`Auto-fulfill donation ${donationIdToFulfill} failed:`, err)
    );
  }

  return { matched: true, referralId: referral.id };
}
