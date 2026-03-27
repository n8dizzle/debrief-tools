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
    .from("gt_parent_students")
    .select("*, parent:gt_users!parent_id(*)")
    .eq("student_id", studentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentId } = await params;
  const body = await req.json();
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("gt_parent_students")
    .insert({
      parent_id: body.parent_id,
      student_id: studentId,
      relationship: body.relationship || "Parent",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentId } = await params;
  const parentId = req.nextUrl.searchParams.get("parentId");
  if (!parentId) return NextResponse.json({ error: "parentId required" }, { status: 400 });

  const supabase = getServerSupabase();

  const { error } = await supabase
    .from("gt_parent_students")
    .delete()
    .eq("student_id", studentId)
    .eq("parent_id", parentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
