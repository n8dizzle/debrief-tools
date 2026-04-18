import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import type { Reward } from "@/lib/supabase";

const DenySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireReferralsAdmin("can_approve_rewards");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = DenySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const supabase = getServerSupabase();

  const { data: reward } = await supabase
    .from("ref_rewards")
    .select("status")
    .eq("id", id)
    .single();

  if (!reward) return NextResponse.json({ error: "Reward not found" }, { status: 404 });

  const r = reward as Pick<Reward, "status">;
  if (r.status !== "PENDING") {
    return NextResponse.json(
      { error: `Reward not in PENDING state (got ${r.status})` },
      { status: 409 }
    );
  }

  await supabase
    .from("ref_rewards")
    .update({
      status: "CANCELLED",
      failure_reason: `Denied by admin ${admin.email}: ${parsed.data.reason}`,
    })
    .eq("id", id);

  return NextResponse.json({ success: true });
}
