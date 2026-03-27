import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "parent") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentId } = await params;
  const supabase = getServerSupabase();

  // Verify parent is linked to this student
  const { data: link } = await supabase
    .from("gt_parent_students")
    .select("id")
    .eq("parent_id", session.user.id)
    .eq("student_id", studentId)
    .single();

  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get student
  const { data: student } = await supabase
    .from("gt_students")
    .select("*")
    .eq("id", studentId)
    .single();

  // Get positions
  const { data: positions } = await supabase
    .from("gt_student_positions")
    .select(`
      *,
      subject:gt_subjects(*),
      current_booklet:gt_booklets(
        *,
        series:gt_series(
          *,
          level:gt_curriculum_levels(*)
        )
      )
    `)
    .eq("student_id", studentId);

  // Get recent sessions (last 30)
  const { data: sessions } = await supabase
    .from("gt_session_logs")
    .select(`
      *,
      booklet:gt_booklets(name, series:gt_series(name, level:gt_curriculum_levels(name, subject:gt_subjects(name, slug))))
    `)
    .eq("student_id", studentId)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  // Get booklet progress
  const { data: progress } = await supabase
    .from("gt_student_booklet_progress")
    .select(`
      *,
      booklet:gt_booklets(name, sort_order, series:gt_series(name, sort_order, level:gt_curriculum_levels(name, sort_order, subject:gt_subjects(name, slug))))
    `)
    .eq("student_id", studentId)
    .order("date_pulled", { ascending: true });

  return NextResponse.json({
    student,
    positions: positions || [],
    sessions: sessions || [],
    progress: progress || [],
  });
}
