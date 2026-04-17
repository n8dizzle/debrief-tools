import type { InvoiceBracket } from "@/lib/supabase";

/**
 * Tier shape that drives reward math. Accepts either:
 * - A live RewardTier row (snake_case DB columns)
 * - A serialized snapshot blob from ref_referrals.snapshot_tier_json (camelCase)
 *
 * The serializer in lib/referrals/snapshot.ts uses camelCase, but Supabase
 * returns snake_case. We coerce both via safe field access.
 */
export interface TierForCalc {
  reward_mode?: string;
  rewardMode?: string;
  flat_reward_amount?: number | string | null;
  flatRewardAmount?: number | string | null;
  percentage_of_invoice?: number | string | null;
  percentageOfInvoice?: number | string | null;
  percentage_reward_cap?: number | string | null;
  percentageRewardCap?: number | string | null;
  invoice_tier_json?: InvoiceBracket[] | null;
  invoiceTierJson?: InvoiceBracket[] | null;
  min_invoice_total?: number | string | null;
  minInvoiceTotal?: number | string | null;
  max_invoice_total?: number | string | null;
  maxInvoiceTotal?: number | string | null;
  charity_match_mode?: string;
  charityMatchMode?: string;
  charity_match_percent?: number | string | null;
  charityMatchPercent?: number | string | null;
  charity_match_flat?: number | string | null;
  charityMatchFlat?: number | string | null;
  charity_match_floor?: number | string | null;
  charityMatchFloor?: number | string | null;
  charity_match_cap?: number | string | null;
  charityMatchCap?: number | string | null;
  requires_admin_approval?: boolean;
  requiresAdminApproval?: boolean;
}

function num(...candidates: (number | string | null | undefined)[]): number {
  for (const c of candidates) {
    if (c === null || c === undefined) continue;
    const n = typeof c === "number" ? c : parseFloat(c);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

function str(...candidates: (string | undefined)[]): string {
  for (const c of candidates) if (c) return c;
  return "";
}

/**
 * Calculate the referrer reward for an invoice total under a given tier snapshot.
 * Returns 0 if the invoice is outside the tier's eligibility window.
 */
export function calculateReward(invoiceTotal: number, tier: TierForCalc | null): number {
  if (!tier) return 0;

  const min = num(tier.min_invoice_total, tier.minInvoiceTotal);
  const max = num(tier.max_invoice_total, tier.maxInvoiceTotal);
  if (invoiceTotal < min) return 0;
  if (max > 0 && invoiceTotal > max) return 0;

  const mode = str(tier.reward_mode, tier.rewardMode);

  switch (mode) {
    case "FLAT":
      return num(tier.flat_reward_amount, tier.flatRewardAmount);

    case "PERCENTAGE_OF_INVOICE": {
      const pct = num(tier.percentage_of_invoice, tier.percentageOfInvoice) / 100;
      const calculated = invoiceTotal * pct;
      const capRaw = tier.percentage_reward_cap ?? tier.percentageRewardCap;
      const cap = capRaw ? num(capRaw) : Infinity;
      return Math.min(calculated, cap);
    }

    case "TIERED_BY_INVOICE": {
      const brackets = (tier.invoice_tier_json || tier.invoiceTierJson || []) as InvoiceBracket[];
      const match = brackets.find(
        (b) =>
          invoiceTotal >= Number(b.minInvoice) &&
          (b.maxInvoice === null ||
            b.maxInvoice === undefined ||
            invoiceTotal < Number(b.maxInvoice))
      );
      return match ? Number(match.rewardAmount) : 0;
    }

    default:
      return 0;
  }
}

/**
 * Calculate the Triple Win charity match. Christmas Air funds this; it does NOT
 * reduce the referrer reward. Returns 0 when charity match is disabled or the
 * reward is 0.
 */
export function calculateCharityMatch(
  referrerReward: number,
  tier: TierForCalc | null
): number {
  if (!tier || referrerReward <= 0) return 0;

  const mode = str(tier.charity_match_mode, tier.charityMatchMode);
  if (mode === "DISABLED" || !mode) return 0;

  let amount = 0;
  if (mode === "PERCENTAGE") {
    const pct = num(tier.charity_match_percent, tier.charityMatchPercent) / 100;
    amount = referrerReward * pct;
  } else if (mode === "FLAT") {
    amount = num(tier.charity_match_flat, tier.charityMatchFlat);
  }

  const floor = num(tier.charity_match_floor, tier.charityMatchFloor);
  const capRaw = tier.charity_match_cap ?? tier.charityMatchCap;
  const cap = capRaw ? num(capRaw) : Infinity;

  return Math.min(Math.max(amount, floor), cap);
}

export function tierRequiresApproval(tier: TierForCalc | null): boolean {
  if (!tier) return false;
  return Boolean(tier.requires_admin_approval ?? tier.requiresAdminApproval);
}
