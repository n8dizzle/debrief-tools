import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import ProgramEditor from "./ProgramEditor";

export const dynamic = "force-dynamic";

interface CurrentProgram {
  config_id: string;
  referrer_amount: number;
  friend_amount: number;
  charity_amount: number;
  campaign_label: string | null;
}

interface HistoryEntry {
  id: string;
  changed_at: string;
  changed_by_admin_id: string | null;
  admin_email: string | null;
  before_json: {
    referrer_amount?: number;
    friend_amount?: number;
    charity_amount?: number;
    campaign_label?: string | null;
  } | null;
  after_json: {
    referrer_amount?: number;
    friend_amount?: number;
    charity_amount?: number;
    campaign_label?: string | null;
  } | null;
}

async function getCurrentProgram(): Promise<CurrentProgram | null> {
  const supabase = getServerSupabase();
  const { data: config } = await supabase
    .from("ref_reward_configs")
    .select("id, campaign_label")
    .eq("is_active", true)
    .eq("is_default", true)
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
    config_id: config.id,
    referrer_amount: Number(tier.flat_reward_amount),
    friend_amount: Number(tier.referee_discount_amount),
    charity_amount: Number(tier.charity_match_flat),
    campaign_label: config.campaign_label,
  };
}

async function getHistory(configId: string): Promise<HistoryEntry[]> {
  const supabase = getServerSupabase();
  const { data: rows } = await supabase
    .from("ref_reward_config_change_log")
    .select("id, changed_at, changed_by_admin_id, before_json, after_json")
    .eq("reward_config_id", configId)
    .eq("change_type", "active_program_update")
    .order("changed_at", { ascending: false })
    .limit(20);

  if (!rows?.length) return [];

  const adminIds = Array.from(
    new Set(rows.map((r) => r.changed_by_admin_id).filter(Boolean))
  ) as string[];
  const emailByAdmin: Record<string, string> = {};
  if (adminIds.length) {
    const { data: admins } = await supabase
      .from("portal_users")
      .select("id, email")
      .in("id", adminIds);
    for (const a of admins || []) emailByAdmin[a.id] = a.email;
  }

  return rows.map((r) => ({
    id: r.id,
    changed_at: r.changed_at,
    changed_by_admin_id: r.changed_by_admin_id,
    admin_email: r.changed_by_admin_id
      ? emailByAdmin[r.changed_by_admin_id] || null
      : null,
    before_json: r.before_json,
    after_json: r.after_json,
  }));
}

export default async function ConfigPage() {
  const admin = await requireReferralsAdmin("can_manage_config");
  if (!admin) {
    return (
      <div className="card max-w-xl">
        <h1 className="text-3xl mb-2">Rewards program</h1>
        <p className="opacity-80">
          You don&apos;t have permission to view or edit the rewards program.
          Ask an owner to grant you <code>referrals.can_manage_config</code> in
          the portal.
        </p>
      </div>
    );
  }

  const current = await getCurrentProgram();
  if (!current) {
    return (
      <div className="card max-w-xl">
        <h1 className="text-3xl mb-2">Rewards program</h1>
        <p className="opacity-80">
          No active rewards program found. Something has gone wrong with the
          seed data — contact engineering.
        </p>
      </div>
    );
  }

  const history = await getHistory(current.config_id);

  return (
    <div>
      <h1 className="text-3xl mb-2">Rewards program</h1>
      <p className="opacity-70 mb-8 text-sm max-w-xl">
        The flat Triple Win program. Edits take effect immediately for all new
        referrals. History below shows every prior save.
      </p>
      <ProgramEditor initial={current} history={history} />
    </div>
  );
}
