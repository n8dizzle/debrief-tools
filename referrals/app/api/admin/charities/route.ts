import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Accepts bare domains ("www.example.com") by prepending https:// so admins
// don't have to type the scheme. Empty strings collapse to null. Anything
// that still doesn't parse as a URL after normalization falls through to .url()
// and returns a 400.
const urlField = z
  .preprocess((v) => {
    if (typeof v !== "string") return v ?? null;
    const trimmed = v.trim();
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
    return trimmed;
  }, z.string().url().nullable())
  .optional();

const CharityCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(2000),
  website_url: urlField,
  logo_url: urlField,
  fulfillment_method: z.enum(["TREMENDOUS", "DIRECT_PAYMENT", "POOLED_QUARTERLY"]),
  tremendous_charity_id: z.string().nullable().optional(),
  ein: z.string().nullable().optional(),
  display_order: z.number().int().min(0).max(10000).default(0),
});

function firstIssueMessage(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid input";
  const field = issue.path.join(".") || "field";
  return `${field}: ${issue.message}`;
}

export async function GET() {
  const admin = await requireReferralsAdmin("can_manage_charities");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("ref_charities")
    .select("*")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ charities: data || [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireReferralsAdmin("can_manage_charities");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CharityCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error), details: parsed.error.issues },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("ref_charities")
    .insert({ ...parsed.data, is_active: true })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ charity: data });
}
