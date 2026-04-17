import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase";
import type { RewardConfig, RewardTier } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ConfigWithTiers = RewardConfig & { tiers: RewardTier[] };

async function getConfigs(): Promise<ConfigWithTiers[]> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("ref_reward_configs")
    .select("*, tiers:ref_reward_tiers(*)")
    .order("is_default", { ascending: false })
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]) || [];
}

export default async function ConfigPage() {
  const configs = await getConfigs();

  return (
    <div>
      <h1 className="text-4xl mb-2">Reward configs</h1>
      <p className="opacity-70 mb-6">
        {configs.length} config{configs.length === 1 ? "" : "s"}. Click a config
        to edit tiers, change traffic allocation, activate, deactivate, or
        duplicate.
      </p>

      <div className="grid gap-5">
        {configs.map((c) => (
          <ConfigCard key={c.id} config={c} />
        ))}
        {configs.length === 0 && (
          <div className="card text-center opacity-70">No configs.</div>
        )}
      </div>
    </div>
  );
}

function ConfigCard({ config }: { config: ConfigWithTiers }) {
  const tiers = (config.tiers || []).sort((a, b) =>
    a.service_category.localeCompare(b.service_category)
  );

  return (
    <Link
      href={`/admin/config/${config.id}`}
      className="card block transition-transform hover:-translate-y-0.5"
      style={{
        borderLeftWidth: "4px",
        borderLeftColor: config.is_active
          ? config.is_default
            ? "var(--ca-green)"
            : "var(--ca-light-green)"
          : "var(--border-default)",
        color: "inherit",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-xl mb-1">
            {config.name}
            {config.is_default && (
              <span
                className="ml-2 text-xs uppercase tracking-wide font-semibold"
                style={{ color: "var(--ca-green)" }}
              >
                default
              </span>
            )}
            {!config.is_active && (
              <span className="ml-2 text-xs opacity-60">(inactive)</span>
            )}
          </h3>
          {config.description && (
            <p className="opacity-70 text-sm">{config.description}</p>
          )}
        </div>
        <div className="text-right text-xs opacity-70">
          <p>Traffic: {Number(config.traffic_allocation).toFixed(0)}%</p>
          <p>Effective: {new Date(config.effective_from).toLocaleDateString()}</p>
          {config.effective_until && (
            <p>Until: {new Date(config.effective_until).toLocaleDateString()}</p>
          )}
          {config.experiment_group && (
            <p>Experiment: {config.experiment_group}</p>
          )}
        </div>
      </div>

      <div className="grid gap-2 mt-4">
        {tiers.map((t) => (
          <TierRow key={t.id} tier={t} />
        ))}
      </div>
    </Link>
  );
}

function TierRow({ tier }: { tier: RewardTier }) {
  let rewardSummary = "—";
  if (tier.reward_mode === "FLAT") {
    rewardSummary = `$${Number(tier.flat_reward_amount || 0).toFixed(0)} flat`;
  } else if (tier.reward_mode === "PERCENTAGE_OF_INVOICE") {
    const cap = tier.percentage_reward_cap
      ? `, cap $${Number(tier.percentage_reward_cap).toFixed(0)}`
      : "";
    rewardSummary = `${Number(tier.percentage_of_invoice || 0)}% of invoice${cap}`;
  } else if (tier.reward_mode === "TIERED_BY_INVOICE") {
    const brackets = (tier.invoice_tier_json || []).length;
    rewardSummary = `Tiered by invoice (${brackets} brackets)`;
  }

  return (
    <div
      className="p-3 rounded-lg text-sm grid gap-1"
      style={{
        background: "var(--bg-muted)",
        gridTemplateColumns: "180px 1fr 1fr 1fr",
      }}
    >
      <div className="font-semibold">{tier.service_category_label}</div>
      <div>
        <span className="opacity-60 text-xs uppercase tracking-wide">Referrer:</span>{" "}
        {rewardSummary}
      </div>
      <div>
        <span className="opacity-60 text-xs uppercase tracking-wide">Referee:</span>{" "}
        {tier.referee_discount_label}
      </div>
      <div>
        <span className="opacity-60 text-xs uppercase tracking-wide">Charity:</span>{" "}
        {tier.charity_match_mode === "DISABLED"
          ? "—"
          : tier.charity_match_mode === "PERCENTAGE"
            ? `${Number(tier.charity_match_percent || 0)}% match`
            : `$${Number(tier.charity_match_flat || 0).toFixed(0)} flat`}
        {tier.requires_admin_approval && (
          <span
            className="ml-2 text-xs"
            style={{ color: "#8a6a3a" }}
          >
            (requires approval)
          </span>
        )}
      </div>
    </div>
  );
}
