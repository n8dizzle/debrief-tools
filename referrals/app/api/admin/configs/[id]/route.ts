import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import { logConfigChange } from "@/lib/admin/log-config-change";

const ConfigUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    traffic_allocation: z.number().min(0).max(100).optional(),
    effective_from: z.string().datetime().optional(),
    effective_until: z.string().datetime().nullable().optional(),
    experiment_group: z.string().trim().max(50).nullable().optional(),
  })
  .strict();

export async function PATCH(
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

  const parsed = ConfigUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  const supabase = getServerSupabase();

  const { data: before } = await supabase
    .from("ref_reward_configs")
    .select("*")
    .eq("id", id)
    .single();

  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: after, error } = await supabase
    .from("ref_reward_configs")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logConfigChange({
    rewardConfigId: id,
    changedByAdminId: admin.userId,
    changeType: "CONFIG_METADATA_UPDATED",
    beforeJson: before,
    afterJson: after,
  });

  return NextResponse.json({ config: after });
}
