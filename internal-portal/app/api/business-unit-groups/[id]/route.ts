import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase, getPortalUser } from "@/lib/supabase";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const portalUser = await getPortalUser(session.user.email);
  if (!portalUser || portalUser.role !== "owner") {
    return {
      error: NextResponse.json(
        { error: "Only owners can manage business unit groups" },
        { status: 403 },
      ),
    };
  }
  return { portalUser };
}

// PATCH /api/business-unit-groups/[id]
// Body may include: label, is_active, sort_order, members (array of BU IDs or {id,name} objects)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const gate = await requireOwner();
    if ("error" in gate) return gate.error;

    const { id } = params;
    const body = await request.json();
    const { label, is_active, sort_order, members } = body as {
      label?: string;
      is_active?: boolean;
      sort_order?: number;
      members?: Array<{ business_unit_id: number; business_unit_name?: string | null } | number>;
    };

    const supabase = getServerSupabase();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (label !== undefined && label.trim()) updates.label = label.trim();
    if (is_active !== undefined) updates.is_active = is_active;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    if (Object.keys(updates).length > 1) {
      const { error } = await supabase
        .from("shared_business_unit_groups")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    }

    if (members !== undefined) {
      // Replace membership set for this group. Because business_unit_id is PK in the
      // members table (1 BU → 1 group), upsert here will move a BU from any other
      // group into this one.
      // First, remove any current members of this group that aren't in the new set.
      // Runtime type-check: JSON body is untrusted, coerce IDs to integers and drop NaN.
      const normalized = members
        .map((m) => {
          const rawId = typeof m === "number" ? m : m?.business_unit_id;
          const id = Number(rawId);
          if (!Number.isInteger(id)) return null;
          const name =
            typeof m === "number" ? null : (m?.business_unit_name ?? null);
          return { business_unit_id: id, business_unit_name: name };
        })
        .filter((m): m is { business_unit_id: number; business_unit_name: string | null } => m !== null);
      const newIds = normalized.map((m) => m.business_unit_id);

      if (newIds.length === 0) {
        const { error: delErr } = await supabase
          .from("shared_business_unit_group_members")
          .delete()
          .eq("group_id", id);
        if (delErr) throw delErr;
      } else {
        const { error: delErr } = await supabase
          .from("shared_business_unit_group_members")
          .delete()
          .eq("group_id", id)
          .not("business_unit_id", "in", `(${newIds.join(",")})`);
        if (delErr) throw delErr;

        const rows = normalized.map((m) => ({
          business_unit_id: m.business_unit_id,
          business_unit_name: m.business_unit_name,
          group_id: id,
        }));
        const { error: upErr } = await supabase
          .from("shared_business_unit_group_members")
          .upsert(rows, { onConflict: "business_unit_id" });
        if (upErr) throw upErr;
      }
    }

    const { data: group, error: getErr } = await supabase
      .from("shared_business_unit_groups")
      .select("*")
      .eq("id", id)
      .single();
    if (getErr) throw getErr;

    const { data: memberRows, error: memErr } = await supabase
      .from("shared_business_unit_group_members")
      .select("business_unit_id, business_unit_name")
      .eq("group_id", id);
    if (memErr) throw memErr;

    return NextResponse.json({
      group: { ...group, members: memberRows || [] },
    });
  } catch (error) {
    console.error("Error updating business unit group:", error);
    return NextResponse.json(
      { error: "Failed to update business unit group" },
      { status: 500 },
    );
  }
}

// DELETE /api/business-unit-groups/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const gate = await requireOwner();
    if ("error" in gate) return gate.error;

    const { id } = params;
    const supabase = getServerSupabase();

    // ON DELETE CASCADE on members table handles member cleanup.
    const { error } = await supabase
      .from("shared_business_unit_groups")
      .delete()
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting business unit group:", error);
    return NextResponse.json(
      { error: "Failed to delete business unit group" },
      { status: 500 },
    );
  }
}
