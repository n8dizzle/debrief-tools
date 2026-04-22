import { getServerSupabase } from "@/lib/supabase";

export interface CurrentProgram {
  referrer_amount: number;
  friend_amount: number;
  charity_amount: number;
  campaign_label: string | null;
}

/**
 * Fetch the current flat Triple Win program (3 amounts + optional campaign
 * label). Drives all public-facing copy so admin edits go live without a
 * redeploy. Returns null only if seed data is missing — callers should
 * render a safe fallback (seed baseline $50/$50/$50, no banner).
 *
 * Reads one tier row (arbitrarily — all 4 are identical under the
 * enforce_tier_identity trigger from migration 009) plus the config row
 * for the campaign label.
 */
export async function getCurrentProgram(): Promise<CurrentProgram | null> {
  try {
    const supabase = getServerSupabase();

    const { data: config } = await supabase
      .from("ref_reward_configs")
      .select("id, campaign_label")
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();

    if (!config?.id) return null;

    const { data: tier } = await supabase
      .from("ref_reward_tiers")
      .select("flat_reward_amount, referee_discount_amount, charity_match_flat")
      .eq("reward_config_id", config.id)
      .limit(1)
      .maybeSingle();

    if (!tier) return null;

    return {
      referrer_amount: Number(tier.flat_reward_amount),
      friend_amount: Number(tier.referee_discount_amount),
      charity_amount: Number(tier.charity_match_flat),
      campaign_label: config.campaign_label,
    };
  } catch (err) {
    // Supabase outage, invalid credentials, etc. → fall through to null so
    // callers render BASELINE_PROGRAM rather than 500ing.
    console.error("getCurrentProgram() failed:", err);
    return null;
  }
}

/** Baseline fallback for pages when the config fetch fails. Keeps copy on the
 *  page rather than showing empty $ strings. */
export const BASELINE_PROGRAM: CurrentProgram = {
  referrer_amount: 50,
  friend_amount: 50,
  charity_amount: 50,
  campaign_label: null,
};
