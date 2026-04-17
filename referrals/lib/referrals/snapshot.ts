import type { RewardTier } from "@/lib/supabase";

/**
 * Serialize a reward tier into a snapshot blob for storage on a Referral row.
 * Snapshotting prevents mid-flight config changes from retroactively altering
 * rewards for already-submitted referrals.
 */
export function serializeTierSnapshot(tier: RewardTier): Record<string, unknown> {
  return {
    sourceTierId: tier.id,
    serviceCategory: tier.service_category,
    serviceCategoryLabel: tier.service_category_label,
    rewardMode: tier.reward_mode,
    flatRewardAmount: tier.flat_reward_amount,
    percentageOfInvoice: tier.percentage_of_invoice,
    percentageRewardCap: tier.percentage_reward_cap,
    invoiceTierJson: tier.invoice_tier_json,
    minInvoiceTotal: tier.min_invoice_total,
    maxInvoiceTotal: tier.max_invoice_total,
    refereeDiscountAmount: tier.referee_discount_amount,
    refereeDiscountType: tier.referee_discount_type,
    refereeDiscountLabel: tier.referee_discount_label,
    charityMatchMode: tier.charity_match_mode,
    charityMatchPercent: tier.charity_match_percent,
    charityMatchFlat: tier.charity_match_flat,
    charityMatchFloor: tier.charity_match_floor,
    charityMatchCap: tier.charity_match_cap,
    requiresAdminApproval: tier.requires_admin_approval,
    snapshotAt: new Date().toISOString(),
  };
}
