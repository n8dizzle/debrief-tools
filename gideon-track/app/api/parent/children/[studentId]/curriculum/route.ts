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
  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get("subjectId");

  if (!subjectId) {
    return NextResponse.json({ error: "subjectId required" }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Verify parent-student link
  const { data: link } = await supabase
    .from("gt_parent_students")
    .select("id")
    .eq("parent_id", session.user.id)
    .eq("student_id", studentId)
    .single();

  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get the student's current position for this subject
  const { data: position } = await supabase
    .from("gt_student_positions")
    .select("current_booklet_id")
    .eq("student_id", studentId)
    .eq("subject_id", subjectId)
    .single();

  const currentBookletId = position?.current_booklet_id || null;

  // Get all levels for this subject with nested series and booklets
  const { data: levels } = await supabase
    .from("gt_curriculum_levels")
    .select(`
      id, name, sort_order, passing_threshold,
      series:gt_series(
        id, name, sort_order, passing_threshold_override,
        booklets:gt_booklets(
          id, name, sort_order, passing_threshold_override
        )
      )
    `)
    .eq("subject_id", subjectId)
    .order("sort_order", { ascending: true });

  // Get all booklet progress for this student
  const { data: progress } = await supabase
    .from("gt_student_booklet_progress")
    .select(`
      booklet_id, status, total_reps, best_score,
      date_pulled, date_passed
    `)
    .eq("student_id", studentId);

  // Get ALL session logs for this student in this subject
  // We need to join through booklet -> series -> level to filter by subject
  const { data: allSessions } = await supabase
    .from("gt_session_logs")
    .select(`
      id, booklet_id, rep_number, mistakes, passed, session_date,
      booklet:gt_booklets!inner(
        id,
        series:gt_series!inner(
          level:gt_curriculum_levels!inner(
            subject_id
          )
        )
      )
    `)
    .eq("student_id", studentId)
    .eq("booklet.series.level.subject_id", subjectId)
    .order("session_date", { ascending: true })
    .order("rep_number", { ascending: true });

  // Build progress and session lookup maps
  type ProgressRow = { booklet_id: string; status: string; total_reps: number; best_score: number | null; date_pulled: string; date_passed: string | null };
  const progressMap = new Map<string, ProgressRow>();
  for (const p of (progress || []) as ProgressRow[]) {
    progressMap.set(p.booklet_id, p);
  }

  const sessionsByBooklet = new Map<string, Array<{
    id: string;
    rep_number: number;
    mistakes: number;
    passed: boolean;
    session_date: string;
  }>>();
  for (const s of allSessions || []) {
    const arr = sessionsByBooklet.get(s.booklet_id) || [];
    arr.push({
      id: s.id,
      rep_number: s.rep_number,
      mistakes: s.mistakes,
      passed: s.passed,
      session_date: s.session_date,
    });
    sessionsByBooklet.set(s.booklet_id, arr);
  }

  // Sort series and booklets within each level, annotate with progress
  const annotatedLevels = (levels || []).map((level) => {
    const sortedSeries = [...(level.series || [])]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((series) => {
        const sortedBooklets = [...(series.booklets || [])]
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((booklet) => {
            const prog = progressMap.get(booklet.id);
            const sessions = sessionsByBooklet.get(booklet.id) || [];
            const isCurrent = booklet.id === currentBookletId;

            let status: "passed" | "in_progress" | "upcoming" = "upcoming";
            if (prog?.status === "passed") status = "passed";
            else if (prog || isCurrent) status = "in_progress";

            return {
              id: booklet.id,
              name: booklet.name,
              passing_threshold_override: booklet.passing_threshold_override,
              status,
              is_current: isCurrent,
              total_reps: prog?.total_reps ?? 0,
              best_score: prog?.best_score ?? null,
              date_pulled: prog?.date_pulled ?? null,
              date_passed: prog?.date_passed ?? null,
              sessions,
            };
          });

        return {
          id: series.id,
          name: series.name,
          passing_threshold_override: series.passing_threshold_override,
          booklets: sortedBooklets,
        };
      });

    return {
      id: level.id,
      name: level.name,
      passing_threshold: level.passing_threshold,
      series: sortedSeries,
    };
  });

  // Count totals
  let totalBooklets = 0;
  let completedBooklets = 0;
  for (const level of annotatedLevels) {
    for (const series of level.series) {
      for (const booklet of series.booklets) {
        totalBooklets++;
        if (booklet.status === "passed") completedBooklets++;
      }
    }
  }

  return NextResponse.json({
    levels: annotatedLevels,
    current_booklet_id: currentBookletId,
    total_booklets: totalBooklets,
    completed_booklets: completedBooklets,
  });
}
