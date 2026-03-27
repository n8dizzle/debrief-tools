import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";
import { formatLocalDate } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServerSupabase();
  const studentId = req.nextUrl.searchParams.get("studentId");
  const bookletId = req.nextUrl.searchParams.get("bookletId");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");

  let query = supabase
    .from("gt_session_logs")
    .select(`
      *,
      student:gt_students(name),
      booklet:gt_booklets(name, series:gt_series(name, level:gt_curriculum_levels(name, subject:gt_subjects(name, slug)))),
      tutor:gt_users!tutor_id(name)
    `)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (studentId) query = query.eq("student_id", studentId);
  if (bookletId) query = query.eq("booklet_id", bookletId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "tutor")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const supabase = getServerSupabase();

  // Get the booklet with its threshold info
  const { data: booklet } = await supabase
    .from("gt_booklets")
    .select("*, series:gt_series(*, level:gt_curriculum_levels(*))")
    .eq("id", body.booklet_id)
    .single();

  if (!booklet) return NextResponse.json({ error: "Booklet not found" }, { status: 404 });

  const threshold =
    booklet.passing_threshold_override ??
    booklet.series?.passing_threshold_override ??
    booklet.series?.level?.passing_threshold ??
    3;

  const passed = body.mistakes <= threshold;
  const today = formatLocalDate(new Date());

  // Create session log
  const { data: sessionLog, error: logError } = await supabase
    .from("gt_session_logs")
    .insert({
      student_id: body.student_id,
      booklet_id: body.booklet_id,
      tutor_id: session.user.id,
      session_date: body.session_date || today,
      rep_number: body.rep_number,
      mistakes: body.mistakes,
      passed,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 });

  // Update student_booklet_progress
  const { data: existingProgress } = await supabase
    .from("gt_student_booklet_progress")
    .select("*")
    .eq("student_id", body.student_id)
    .eq("booklet_id", body.booklet_id)
    .single();

  if (existingProgress) {
    await supabase
      .from("gt_student_booklet_progress")
      .update({
        total_reps: existingProgress.total_reps + 1,
        best_score: existingProgress.best_score === null
          ? body.mistakes
          : Math.min(existingProgress.best_score, body.mistakes),
        status: passed ? "passed" : "in_progress",
        date_passed: passed ? today : existingProgress.date_passed,
      })
      .eq("id", existingProgress.id);
  } else {
    await supabase
      .from("gt_student_booklet_progress")
      .insert({
        student_id: body.student_id,
        booklet_id: body.booklet_id,
        status: passed ? "passed" : "in_progress",
        date_pulled: today,
        date_passed: passed ? today : null,
        total_reps: 1,
        best_score: body.mistakes,
      });
  }

  // If passed and auto_advance requested, find and set next booklet
  let nextBooklet = null;
  if (passed && body.auto_advance !== false) {
    nextBooklet = await findNextBooklet(supabase, booklet);

    if (nextBooklet) {
      // Update student position
      const subjectId = booklet.series?.level?.subject_id;
      if (subjectId) {
        await supabase
          .from("gt_student_positions")
          .upsert(
            {
              student_id: body.student_id,
              subject_id: subjectId,
              current_booklet_id: nextBooklet.id,
            },
            { onConflict: "student_id,subject_id" }
          );

        // Create progress entry for new booklet
        await supabase
          .from("gt_student_booklet_progress")
          .upsert(
            {
              student_id: body.student_id,
              booklet_id: nextBooklet.id,
              status: "in_progress",
              date_pulled: today,
              total_reps: 0,
            },
            { onConflict: "student_id,booklet_id" }
          );
      }
    }
  }

  return NextResponse.json({
    session: sessionLog,
    passed,
    threshold,
    nextBooklet,
  }, { status: 201 });
}

async function findNextBooklet(supabase: ReturnType<typeof getServerSupabase>, currentBooklet: any) {
  const currentSeries = currentBooklet.series;
  const currentLevel = currentSeries?.level;

  // 1. Next booklet in same series
  const { data: nextInSeries } = await supabase
    .from("gt_booklets")
    .select("*")
    .eq("series_id", currentBooklet.series_id)
    .gt("sort_order", currentBooklet.sort_order)
    .order("sort_order")
    .limit(1)
    .single();

  if (nextInSeries) return nextInSeries;

  // 2. First booklet of next series in same level
  const { data: nextSeries } = await supabase
    .from("gt_series")
    .select("id")
    .eq("level_id", currentSeries.level_id)
    .gt("sort_order", currentSeries.sort_order)
    .order("sort_order")
    .limit(1)
    .single();

  if (nextSeries) {
    const { data: firstBooklet } = await supabase
      .from("gt_booklets")
      .select("*")
      .eq("series_id", nextSeries.id)
      .order("sort_order")
      .limit(1)
      .single();

    if (firstBooklet) return firstBooklet;
  }

  // 3. First booklet of first series of next level
  const { data: nextLevel } = await supabase
    .from("gt_curriculum_levels")
    .select("id")
    .eq("subject_id", currentLevel.subject_id)
    .gt("sort_order", currentLevel.sort_order)
    .order("sort_order")
    .limit(1)
    .single();

  if (nextLevel) {
    const { data: firstSeriesInLevel } = await supabase
      .from("gt_series")
      .select("id")
      .eq("level_id", nextLevel.id)
      .order("sort_order")
      .limit(1)
      .single();

    if (firstSeriesInLevel) {
      const { data: firstBooklet } = await supabase
        .from("gt_booklets")
        .select("*")
        .eq("series_id", firstSeriesInLevel.id)
        .order("sort_order")
        .limit(1)
        .single();

      if (firstBooklet) return firstBooklet;
    }
  }

  // 4. No next booklet - student graduated this subject
  return null;
}
