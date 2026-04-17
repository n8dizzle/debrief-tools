import { NextRequest, NextResponse } from "next/server";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import { logConfigChange } from "@/lib/admin/log-config-change";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireReferralsAdmin("can_manage_config");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const supabase = getServerSupabase();

  const { data: before } = await supabase
    .from("ref_reward_configs")
    .select("*")
    .eq("id", id)
    .single();

  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (before.is_active) {
    return NextResponse.json({ ok: true, alreadyActive: true });
  }

  const { data: after, error } = await supabase
    .from("ref_reward_configs")
    .update({ is_active: true })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logConfigChange({
    rewardConfigId: id,
    changedByAdminId: admin.userId,
    changeType: "CONFIG_ACTIVATED",
    beforeJson: before,
    afterJson: after,
  });

  return NextResponse.json({ ok: true, config: after });
}
