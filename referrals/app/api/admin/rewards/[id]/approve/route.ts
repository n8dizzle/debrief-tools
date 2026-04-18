import { NextRequest, NextResponse } from "next/server";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import { fulfillReward } from "@/lib/rewards/fulfill";
import type { Reward, Referrer } from "@/lib/supabase";

/**
 * Approve a PENDING reward and immediately attempt fulfillment via Tremendous.
 * Updates the referrer's lifetime counters once approved (matches
 * auto-approval behavior in handle-invoice.ts).
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireReferralsAdmin("can_approve_rewards");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const supabase = getServerSupabase();

  const { data: reward } = await supabase
    .from("ref_rewards")
    .select("*")
    .eq("id", id)
    .single();

  if (!reward) return NextResponse.json({ error: "Reward not found" }, { status: 404 });

  const r = reward as Reward;
  if (r.status !== "PENDING") {
    return NextResponse.json(
      { error: `Reward not in PENDING state (got ${r.status})` },
      { status: 409 }
    );
  }

  // Move PENDING → APPROVED, bump referrer lifetime counters
  await supabase.from("ref_rewards").update({ status: "APPROVED" }).eq("id", id);

  const { data: referrerRow } = await supabase
    .from("ref_referrers")
    .select("*")
    .eq("id", r.referrer_id)
    .single();

  if (referrerRow) {
    const ref = referrerRow as Referrer;
    await supabase
      .from("ref_referrers")
      .update({
        total_earned: Number(ref.total_earned) + Number(r.amount),
        lifetime_referrals: ref.lifetime_referrals + 1,
      })
      .eq("id", ref.id);
  }

  // Try fulfillment immediately
  const result = await fulfillReward(id);

  return NextResponse.json({
    success: true,
    fulfilled: result.ok,
    fulfillmentReason: result.reason,
  });
}
