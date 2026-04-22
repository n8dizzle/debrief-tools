import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase, getPortalUser } from "@/lib/supabase";

interface GroupRow {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface MemberRow {
  business_unit_id: number;
  business_unit_name: string | null;
  group_id: string;
}

// GET /api/business-unit-groups — list groups with members. Any authenticated user.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabase();

    const [groupsRes, membersRes] = await Promise.all([
      supabase
        .from("shared_business_unit_groups")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true }),
      supabase
        .from("shared_business_unit_group_members")
        .select("business_unit_id, business_unit_name, group_id"),
    ]);

    if (groupsRes.error) throw groupsRes.error;
    if (membersRes.error) throw membersRes.error;

    const groups = (groupsRes.data as GroupRow[]) || [];
    const members = (membersRes.data as MemberRow[]) || [];

    const byGroup: Record<string, MemberRow[]> = {};
    for (const m of members) {
      (byGroup[m.group_id] ||= []).push(m);
    }

    const result = groups.map((g) => ({
      ...g,
      members: (byGroup[g.id] || []).map((m) => ({
        business_unit_id: m.business_unit_id,
        business_unit_name: m.business_unit_name,
      })),
    }));

    return NextResponse.json({ groups: result });
  } catch (error) {
    console.error("Error fetching business unit groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch business unit groups" },
      { status: 500 },
    );
  }
}

// POST /api/business-unit-groups — create a new group. Owner only.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const portalUser = await getPortalUser(session.user.email);
    if (!portalUser || portalUser.role !== "owner") {
      return NextResponse.json(
        { error: "Only owners can manage business unit groups" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { label } = body as { label?: string };

    if (!label || !label.trim()) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }

    const trimmedLabel = label.trim();
    const key = trimmedLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    const supabase = getServerSupabase();

    const { data: maxOrder } = await supabase
      .from("shared_business_unit_groups")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSortOrder = (maxOrder?.sort_order || 0) + 1;

    const { data, error } = await supabase
      .from("shared_business_unit_groups")
      .insert({ key, label: trimmedLabel, sort_order: nextSortOrder })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A group with this name already exists" },
          { status: 400 },
        );
      }
      throw error;
    }

    return NextResponse.json({ group: { ...data, members: [] } });
  } catch (error) {
    console.error("Error creating business unit group:", error);
    return NextResponse.json(
      { error: "Failed to create business unit group" },
      { status: 500 },
    );
  }
}
