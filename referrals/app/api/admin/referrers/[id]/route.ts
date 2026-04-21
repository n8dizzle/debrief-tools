import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Update editable fields on a referrer. Today the only editable field is
 * service_titan_id (manual linking after the auto-lookup was removed —
 * ST's search API silently false-matched, see /api/enroll route comments).
 * Accepts numeric string or null to unlink.
 */
const PatchSchema = z.object({
  service_titan_id: z
    .union([
      z.string().trim().regex(/^\d+$/, "Must be a numeric ServiceTitan customer ID"),
      z.null(),
    ])
    .optional(),
});

export async function PATCH(
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

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("ref_referrers")
    .update(parsed.data)
    .eq("id", id)
    .select("id, service_titan_id")
    .single();

  if (error) {
    // Most likely a uniqueness conflict — another referrer already linked to
    // the same ST customer ID. Pass the message through so the admin sees it.
    return NextResponse.json(
      { error: error.message || "Update failed" },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    service_titan_id: data.service_titan_id,
  });
}
