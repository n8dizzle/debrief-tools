import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getServerSupabase();
  const role = req.nextUrl.searchParams.get("role");

  let query = supabase
    .from("gt_users")
    .select("id, email, name, roles, active_role, is_active, created_at")
    .order("name");

  if (role) query = query.contains("roles", [role]);

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

  // Support both legacy single role and new roles array
  const roles: string[] = body.roles || [body.role];
  const activeRole = roles[0];

  let passwordHash = null;
  if (roles.includes("parent") && body.password) {
    passwordHash = await bcrypt.hash(body.password, 10);
  }

  const { data, error } = await supabase
    .from("gt_users")
    .insert({
      email: body.email.toLowerCase().trim(),
      name: body.name,
      roles,
      active_role: activeRole,
      password_hash: passwordHash,
      is_active: true,
    })
    .select("id, email, name, roles, active_role, is_active, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const supabase = getServerSupabase();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.email !== undefined) updates.email = body.email.toLowerCase().trim();
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.password) updates.password_hash = await bcrypt.hash(body.password, 10);
  if (body.roles !== undefined) {
    updates.roles = body.roles;
    // If active_role is no longer in the new roles array, reset it
    if (body.active_role) {
      updates.active_role = body.active_role;
    }
  }

  const { data, error } = await supabase
    .from("gt_users")
    .update(updates)
    .eq("id", body.id)
    .select("id, email, name, roles, active_role, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
