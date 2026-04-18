import { NextRequest, NextResponse } from "next/server";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import { fulfillCharityDonation } from "@/lib/charities/fulfill";
import type { CharityDonation } from "@/lib/supabase";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireReferralsAdmin("can_approve_donations");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const supabase = getServerSupabase();

  const { data: donation } = await supabase
    .from("ref_charity_donations")
    .select("status")
    .eq("id", id)
    .single();

  if (!donation) return NextResponse.json({ error: "Donation not found" }, { status: 404 });
  const d = donation as Pick<CharityDonation, "status">;

  if (d.status !== "PENDING") {
    return NextResponse.json(
      { error: `Donation not PENDING (got ${d.status})` },
      { status: 409 }
    );
  }

  await supabase
    .from("ref_charity_donations")
    .update({ status: "APPROVED" })
    .eq("id", id);

  const result = await fulfillCharityDonation(id);

  return NextResponse.json({
    success: true,
    fulfilled: result.ok,
    fulfillmentReason: result.reason,
  });
}
