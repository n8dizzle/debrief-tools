import { getServerSupabase } from "@/lib/supabase";
import type {
  InvoiceBracket,
  RewardTier,
  ServiceCategory,
} from "@/lib/supabase";

const CATEGORY_ORDER: ServiceCategory[] = [
  "SERVICE_CALL",
  "MAINTENANCE",
  "REPLACEMENT",
  "COMMERCIAL",
];

/**
 * Fetch the active tiers for the default reward config, in display order.
 * Used by public marketing pages (homepage, FAQ) so admin edits go live
 * without a redeploy. Returns [] if no default-active config exists —
 * callers should fall back to static copy so the page still renders.
 */
export async function getDefaultConfigTiers(): Promise<RewardTier[]> {
  const supabase = getServerSupabase();
  const now = new Date().toISOString();

  const { data: config } = await supabase
    .from("ref_reward_configs")
    .select("id")
    .eq("is_default", true)
    .eq("is_active", true)
    .lte("effective_from", now)
    .or(`effective_until.is.null,effective_until.gt.${now}`)
    .maybeSingle();

  if (!config?.id) return [];

  const { data: tiers } = await supabase
    .from("ref_reward_tiers")
    .select("*")
    .eq("reward_config_id", config.id)
    .eq("is_active", true);

  if (!tiers) return [];

  return (tiers as RewardTier[]).slice().sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.service_category) -
      CATEGORY_ORDER.indexOf(b.service_category)
  );
}

/** Format a tier's referrer reward as a short customer-facing string. */
export function formatTierReward(tier: RewardTier): string {
  if (tier.reward_mode === "FLAT") {
    return `$${Math.round(tier.flat_reward_amount || 0)}`;
  }

  if (tier.reward_mode === "TIERED_BY_INVOICE") {
    const brackets = (tier.invoice_tier_json as InvoiceBracket[]) || [];
    const amounts = brackets
      .map((b) => Number(b.rewardAmount))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (amounts.length === 0) return "";
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const hasOpenTop = brackets.some((b) => b.maxInvoice === null);
    if (min === max) return hasOpenTop ? `$${min}+` : `$${min}`;
    return hasOpenTop ? `$${min} – $${max}+` : `$${min} – $${max}`;
  }

  if (tier.reward_mode === "PERCENTAGE_OF_INVOICE") {
    const pct = tier.percentage_of_invoice || 0;
    const cap = tier.percentage_reward_cap;
    return cap ? `${pct}% up to $${Math.round(cap)}` : `${pct}%`;
  }

  return "";
}
