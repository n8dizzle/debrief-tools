import { getServerSupabase } from "@/lib/supabase";
import { serializeTierSnapshot } from "@/lib/referrals/snapshot";
import { snapshotCategoryMatches } from "./classify-actual";
import type { Referral, RewardTier, ServiceCategory } from "@/lib/supabase";
import type { TierForCalc } from "./calculate";

/**
 * Resolve the tier that should drive this referral's reward calculation.
 *
 * Preference order:
 * 1. If the existing snapshot matches the actual service category → use the snapshot as-is.
 * 2. Otherwise fetch a fresh tier from the SAME config the referral was assigned,
 *    but for the actual category. Return it as a fresh snapshot blob.
 *
 * Returns null if we can't resolve any tier — caller should flag for admin review.
 */
export async function resolveTierForConversion(
  referral: Referral,
  actualCategory: ServiceCategory
): Promise<{ tier: TierForCalc; snapshotForUpdate: Record<string, unknown> | null } | null> {
  // 1. Snapshot already matches — use it directly, no re-snapshot needed
  if (snapshotCategoryMatches(referral, actualCategory)) {
    return {
      tier: referral.snapshot_tier_json as unknown as TierForCalc,
      snapshotForUpdate: null,
    };
  }

  // 2. Fetch fresh tier from the referral's original config, for the actual category
  if (!referral.reward_config_id) return null;

  const supabase = getServerSupabase();
  const { data: tierRow } = await supabase
    .from("ref_reward_tiers")
    .select("*")
    .eq("reward_config_id", referral.reward_config_id)
    .eq("service_category", actualCategory)
    .single();

  if (!tierRow) return null;

  const freshTier = tierRow as RewardTier;
  const freshSnapshot = serializeTierSnapshot(freshTier);

  return {
    tier: freshTier as unknown as TierForCalc,
    snapshotForUpdate: freshSnapshot,
  };
}
