import { getServerSupabase } from "@/lib/supabase";

/**
 * Assign a new referrer to a reward config using weighted random selection
 * across currently-active configs. Sticky: once assigned, the referrer stays
 * on that config for the lifetime of their referrals.
 *
 * Returns the config UUID, or null if no active config exists (caller decides
 * whether to block enrollment or proceed unconfigured).
 */
export async function assignRewardConfig(): Promise<string | null> {
  const supabase = getServerSupabase();
  const now = new Date().toISOString();

  const { data: configs, error } = await supabase
    .from("ref_reward_configs")
    .select("id, is_default, traffic_allocation")
    .eq("is_active", true)
    .lte("effective_from", now)
    .or(`effective_until.is.null,effective_until.gt.${now}`);

  if (error || !configs || configs.length === 0) {
    console.error("No active reward configs found", error);
    return null;
  }

  if (configs.length === 1) return configs[0].id;

  const totalWeight = configs.reduce(
    (sum, c) => sum + Number(c.traffic_allocation || 0),
    0
  );

  if (totalWeight <= 0) {
    // Fallback to default when weights don't sum
    const defaultConfig = configs.find((c) => c.is_default);
    return defaultConfig?.id || configs[0].id;
  }

  const rand = Math.random() * totalWeight;
  let cumulative = 0;
  for (const c of configs) {
    cumulative += Number(c.traffic_allocation || 0);
    if (rand < cumulative) return c.id;
  }

  // Floating-point safety net
  return configs[configs.length - 1].id;
}
