import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import { logConfigChange } from "@/lib/admin/log-config-change";
import type { RewardTier } from "@/lib/supabase";

const DuplicateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  experimentGroup: z.string().trim().max(50).nullable().optional(),
});

/**
 * Duplicate a config + all its tiers as a NEW (inactive) config.
 * Use this to start an A/B variant or seed a future change without
 * touching the live default.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireReferralsAdmin("can_manage_config");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = DuplicateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const supabase = getServerSupabase();

  const { data: source } = await supabase
    .from("ref_reward_configs")
    .select("*, tiers:ref_reward_tiers(*)")
    .eq("id", id)
    .single();

  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  const { data: created, error } = await supabase
    .from("ref_reward_configs")
    .insert({
      name: parsed.data.name,
      description: source.description,
      is_active: false,
      is_default: false,
      traffic_allocation: 0,
      effective_from: new Date().toISOString(),
      experiment_group: parsed.data.experimentGroup,
      created_by_admin_id: admin.userId,
    })
    .select("*")
    .single();

  if (error || !created)
    return NextResponse.json(
      { error: error?.message || "Create failed" },
      { status: 500 }
    );

  // Copy tiers
  const sourceTiers = (source.tiers || []) as RewardTier[];
  if (sourceTiers.length > 0) {
    const tierInserts = sourceTiers.map((t) => ({
      reward_config_id: created.id,
      service_category: t.service_category,
      service_category_label: t.service_category_label,
      reward_mode: t.reward_mode,
      flat_reward_amount: t.flat_reward_amount,
      percentage_of_invoice: t.percentage_of_invoice,
      percentage_reward_cap: t.percentage_reward_cap,
      invoice_tier_json: t.invoice_tier_json,
      min_invoice_total: t.min_invoice_total,
      max_invoice_total: t.max_invoice_total,
      referee_discount_amount: t.referee_discount_amount,
      referee_discount_type: t.referee_discount_type,
      referee_discount_label: t.referee_discount_label,
      charity_match_mode: t.charity_match_mode,
      charity_match_percent: t.charity_match_percent,
      charity_match_flat: t.charity_match_flat,
      charity_match_floor: t.charity_match_floor,
      charity_match_cap: t.charity_match_cap,
      requires_admin_approval: t.requires_admin_approval,
      is_active: t.is_active,
    }));

    await supabase.from("ref_reward_tiers").insert(tierInserts);
  }

  await logConfigChange({
    rewardConfigId: created.id,
    changedByAdminId: admin.userId,
    changeType: "CONFIG_DUPLICATED_FROM",
    beforeJson: { sourceConfigId: id, sourceConfigName: source.name },
    afterJson: created,
  });

  return NextResponse.json({ config: created });
}
