import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/referrals/[id]/link-st-customer
 *
 * Links (or re-links) a ServiceTitan customer to a referral by setting
 * service_titan_customer_id. Used by the admin "Link ST Customer" inline
 * search so CSRs can manually associate the friend's ST account without
 * waiting for the invoice webhook to auto-match.
 *
 * Once linked, the "pull from ST & mark complete" button becomes available,
 * and the TagInST button can write the referral code to the ST customer field.
 */
const Schema = z.object({
  stCustomerId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireReferralsAdmin("can_view_admin");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();

  const { data: existing } = await supabase
    .from("ref_referrals")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Referral not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("ref_referrals")
    .update({ service_titan_customer_id: parsed.data.stCustomerId })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: `Database error: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, stCustomerId: parsed.data.stCustomerId });
}
