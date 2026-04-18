import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import { logConfigChange } from "@/lib/admin/log-config-change";

const InvoiceBracketSchema = z.object({
  minInvoice: z.number().min(0),
  maxInvoice: z.number().nullable(),
  rewardAmount: z.number().min(0),
});

const TierUpdateSchema = z
  .object({
    service_category_label: z.string().trim().min(1).max(100).optional(),
    reward_mode: z.enum(["FLAT", "PERCENTAGE_OF_INVOICE", "TIERED_BY_INVOICE"]).optional(),
    flat_reward_amount: z.number().min(0).nullable().optional(),
    percentage_of_invoice: z.number().min(0).max(100).nullable().optional(),
    percentage_reward_cap: z.number().min(0).nullable().optional(),
    invoice_tier_json: z.array(InvoiceBracketSchema).nullable().optional(),
    min_invoice_total: z.number().min(0).optional(),
    max_invoice_total: z.number().min(0).nullable().optional(),
    referee_discount_amount: z.number().min(0).optional(),
    referee_discount_type: z.enum(["FLAT_OFF", "PERCENT_OFF", "FREE_MONTH", "CUSTOM"]).optional(),
    referee_discount_label: z.string().trim().min(1).max(100).optional(),
    charity_match_mode: z.enum(["PERCENTAGE", "FLAT", "DISABLED"]).optional(),
    charity_match_percent: z.number().min(0).max(100).nullable().optional(),
    charity_match_flat: z.number().min(0).nullable().optional(),
    charity_match_floor: z.number().min(0).optional(),
    charity_match_cap: z.number().min(0).nullable().optional(),
    requires_admin_approval: z.boolean().optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; tierId: string }> }
) {
  const admin = await requireReferralsAdmin("can_manage_config");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = TierUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { id, tierId } = await ctx.params;
  const supabase = getServerSupabase();

  // Verify tier belongs to this config (defense against URL tampering)
  const { data: before } = await supabase
    .from("ref_reward_tiers")
    .select("*")
    .eq("id", tierId)
    .eq("reward_config_id", id)
    .single();

  if (!before) return NextResponse.json({ error: "Tier not found" }, { status: 404 });

  const { data: after, error } = await supabase
    .from("ref_reward_tiers")
    .update(parsed.data)
    .eq("id", tierId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logConfigChange({
    rewardConfigId: id,
    changedByAdminId: admin.userId,
    changeType: `TIER_UPDATED:${before.service_category}`,
    beforeJson: before,
    afterJson: after,
  });

  return NextResponse.json({ tier: after });
}
