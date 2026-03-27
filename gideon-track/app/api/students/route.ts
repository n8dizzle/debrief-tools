import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServerSupabase();
  const status = req.nextUrl.searchParams.get("status");
  const tutorId = req.nextUrl.searchParams.get("tutorId");

  let query = supabase
    .from("gt_students")
    .select("*")
    .order("name");

  if (status) query = query.eq("status", status);

  const { data: students, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If filtering by tutor, get tutor_students links
  if (tutorId && students) {
    const { data: links } = await supabase
      .from("gt_tutor_students")
      .select("student_id")
      .eq("tutor_id", tutorId);

    const studentIds = new Set(links?.map((l) => l.student_id));
    const filtered = students.filter((s) => studentIds.has(s.id));
    return NextResponse.json(filtered);
  }

  return NextResponse.json(students);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("gt_students")
    .insert({
      name: body.name,
      date_of_birth: body.date_of_birth || null,
      enrollment_date: body.enrollment_date || new Date().toISOString().split("T")[0],
      status: body.status || "active",
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
