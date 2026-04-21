import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";

// See POST route for rationale — auto-prepend https:// when an admin types a
// bare domain, collapse empty strings to null.
const urlField = z
  .preprocess((v) => {
    if (typeof v !== "string") return v ?? null;
    const trimmed = v.trim();
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
    return trimmed;
  }, z.string().url().nullable())
  .optional();

const CharityUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().min(1).max(2000).optional(),
    website_url: urlField,
    logo_url: urlField,
    fulfillment_method: z
      .enum(["TREMENDOUS", "DIRECT_PAYMENT", "POOLED_QUARTERLY"])
      .optional(),
    tremendous_charity_id: z.string().nullable().optional(),
    ein: z.string().nullable().optional(),
    display_order: z.number().int().min(0).max(10000).optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

function firstIssueMessage(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid input";
  const field = issue.path.join(".") || "field";
  return `${field}: ${issue.message}`;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireReferralsAdmin("can_manage_charities");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CharityUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error), details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("ref_charities")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ charity: data });
}

/**
 * Soft-delete: set is_active = false. Hard delete blocked because referrals
 * may have foreign-key references via snapshot_charity_id.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireReferralsAdmin("can_manage_charities");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("ref_charities")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
