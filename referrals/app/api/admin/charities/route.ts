import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const CharityCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(2000),
  website_url: z.string().url().nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  fulfillment_method: z.enum(["TREMENDOUS", "DIRECT_PAYMENT", "POOLED_QUARTERLY"]),
  tremendous_charity_id: z.string().nullable().optional(),
  ein: z.string().nullable().optional(),
  display_order: z.number().int().min(0).max(10000).default(0),
});

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
      { error: "Invalid input", details: parsed.error.issues },
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
