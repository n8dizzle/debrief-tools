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

  const { data, error } = await supabase
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "tutor")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentId } = await params;
  const body = await req.json();
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("gt_student_positions")
    .upsert(
      {
        student_id: studentId,
        subject_id: body.subject_id,
        current_booklet_id: body.current_booklet_id,
      },
      { onConflict: "student_id,subject_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
