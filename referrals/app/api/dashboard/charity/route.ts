import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentReferrer } from "@/lib/customer-auth";
import { getServerSupabase } from "@/lib/supabase";

const UpdateSchema = z.object({
  selectedCharityId: z.string().uuid().nullable(),
});

export async function POST(req: NextRequest) {
  const referrer = await getCurrentReferrer();
  if (!referrer) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();

  if (parsed.data.selectedCharityId) {
    const { data: charity } = await supabase
      .from("ref_charities")
      .select("id")
      .eq("id", parsed.data.selectedCharityId)
      .eq("is_active", true)
      .single();
    if (!charity) {
      return NextResponse.json(
        { error: "Selected charity is not available" },
        { status: 400 }
      );
    }
  }

  // triple_win_enabled column is legacy (admin-controlled globally now) but
  // we keep it aligned with whether the referrer has picked a charity so any
  // lingering reader sees a consistent value.
  await supabase
    .from("ref_referrers")
    .update({
      selected_charity_id: parsed.data.selectedCharityId,
      triple_win_enabled: !!parsed.data.selectedCharityId,
    })
    .eq("id", referrer.id);

  return NextResponse.json({ success: true });
}
