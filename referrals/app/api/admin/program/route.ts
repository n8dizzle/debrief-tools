import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const SaveSchema = z.object({
  referrer_amount: z.number().int().min(1).max(10000),
  friend_amount: z.number().int().min(1).max(10000),
  charity_amount: z.number().int().min(1).max(10000),
  campaign_label: z.string().trim().max(200).nullable(),
});

export async function POST(req: NextRequest) {
  const admin = await requireReferralsAdmin("can_manage_config");
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase.rpc("update_active_program", {
    p_referrer_amount: parsed.data.referrer_amount,
    p_friend_amount: parsed.data.friend_amount,
    p_charity_amount: parsed.data.charity_amount,
    p_campaign_label: parsed.data.campaign_label,
    p_admin_id: admin.userId,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Save failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, change_log_id: data });
}
