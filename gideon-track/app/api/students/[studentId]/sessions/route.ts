import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId } = await params;
  const supabase = getServerSupabase();
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
  const bookletId = req.nextUrl.searchParams.get("bookletId");

  let query = supabase
    .from("gt_session_logs")
    .select(`
      *,
      booklet:gt_booklets(name, series:gt_series(name, level:gt_curriculum_levels(name, subject:gt_subjects(name, slug)))),
      tutor:gt_users!tutor_id(name)
    `)
    .eq("student_id", studentId)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (bookletId) query = query.eq("booklet_id", bookletId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
