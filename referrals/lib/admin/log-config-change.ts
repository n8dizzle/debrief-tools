import { getServerSupabase } from "@/lib/supabase";

/**
 * Append an entry to ref_reward_config_change_log.
 * Captures the admin who made the change, the before/after state, and the
 * change type. Used by every config-mutating route handler.
 */
export async function logConfigChange(opts: {
  rewardConfigId: string | null;
  changedByAdminId: string;
  changeType: string;
  beforeJson?: unknown;
  afterJson?: unknown;
}): Promise<void> {
  const supabase = getServerSupabase();
  await supabase.from("ref_reward_config_change_log").insert({
    reward_config_id: opts.rewardConfigId,
    changed_by_admin_id: opts.changedByAdminId,
    change_type: opts.changeType,
    before_json: opts.beforeJson ?? null,
    after_json: opts.afterJson ?? null,
  });
}
