import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("ref_charities")
    .select("id, name, description, logo_url, website_url, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load charities" }, { status: 500 });
  }

  return NextResponse.json({ charities: data || [] });
}
