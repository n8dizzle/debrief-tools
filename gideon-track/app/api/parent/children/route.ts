import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "parent") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getServerSupabase();

  // Get children linked to this parent
  const { data: links, error: linkError } = await supabase
    .from("gt_parent_students")
    .select("student_id, relationship")
    .eq("parent_id", session.user.id);

  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
  if (!links?.length) return NextResponse.json([]);

  const studentIds = links.map((l) => l.student_id);

  // Get students with their current positions
  const { data: students, error: studError } = await supabase
    .from("gt_students")
    .select("*")
    .in("id", studentIds)
    .order("name");

  if (studError) return NextResponse.json({ error: studError.message }, { status: 500 });

  // Get positions for all children
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
    .in("student_id", studentIds);

  // Get recent sessions for all children
  const { data: recentSessions } = await supabase
    .from("gt_session_logs")
    .select(`
      *,
      booklet:gt_booklets(name, series:gt_series(name, level:gt_curriculum_levels(name)))
    `)
    .in("student_id", studentIds)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  // Combine data
  const enriched = students?.map((student) => ({
    ...student,
    positions: positions?.filter((p) => p.student_id === student.id) || [],
    recentSessions: recentSessions?.filter((s) => s.student_id === student.id) || [],
  }));

  return NextResponse.json(enriched);
}
