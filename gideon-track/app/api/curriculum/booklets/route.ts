import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServerSupabase();
  const seriesId = req.nextUrl.searchParams.get("seriesId");

  let query = supabase
    .from("gt_booklets")
    .select("*, series:gt_series(*, level:gt_curriculum_levels(*, subject:gt_subjects(*)))")
    .order("sort_order");

  if (seriesId) query = query.eq("series_id", seriesId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("gt_booklets")
    .insert({
      series_id: body.series_id,
      name: body.name,
      passing_threshold_override: body.passing_threshold_override || null,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
