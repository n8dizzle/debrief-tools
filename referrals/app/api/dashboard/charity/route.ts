import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentReferrer } from "@/lib/customer-auth";
import { getServerSupabase } from "@/lib/supabase";

const UpdateSchema = z
  .object({
    tripleWinEnabled: z.boolean(),
    selectedCharityId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (d) => !d.tripleWinEnabled || !!d.selectedCharityId,
    { message: "Charity selection required when Triple Win is enabled" }
  );

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

  // Validate the charity exists + is active when turning Triple Win on
  if (parsed.data.tripleWinEnabled && parsed.data.selectedCharityId) {
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

  await supabase
    .from("ref_referrers")
    .update({
      triple_win_enabled: parsed.data.tripleWinEnabled,
      selected_charity_id: parsed.data.tripleWinEnabled
        ? parsed.data.selectedCharityId
        : null,
    })
    .eq("id", referrer.id);

  return NextResponse.json({ success: true });
}
