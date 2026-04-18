import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import type { CharityDonation } from "@/lib/supabase";

const DenySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireReferralsAdmin("can_approve_donations");
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
    .update({
      status: "FAILED",
      failure_reason: `Denied by admin ${admin.email}: ${parsed.data.reason}`,
    })
    .eq("id", id);

  return NextResponse.json({ success: true });
}
