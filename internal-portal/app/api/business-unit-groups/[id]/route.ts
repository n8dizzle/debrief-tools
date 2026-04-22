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
// Body may include: label, is_active, sort_order, members (array of BU names)
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
      members?: Array<{ business_unit_name: string } | string>;
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
      // Replace membership set for this group. business_unit_name is PK in the
      // members table (1 BU -> 1 group); upsert moves a BU between groups.
      // Runtime type-check: JSON body is untrusted, filter non-strings.
      const names = members
        .map((m) => {
          const raw = typeof m === "string" ? m : m?.business_unit_name;
          return typeof raw === "string" && raw.trim() ? raw.trim() : null;
        })
        .filter((n): n is string => n !== null);

      if (names.length === 0) {
        const { error: delErr } = await supabase
          .from("shared_business_unit_group_members")
          .delete()
          .eq("group_id", id);
        if (delErr) throw delErr;
      } else {
        // Delete any current members of this group not in the new set.
        // PostgREST "in" filter: quote each name, escape embedded double-quotes.
        const quotedList = names
          .map((n) => `"${n.replace(/"/g, '""')}"`)
          .join(",");
        const { error: delErr } = await supabase
          .from("shared_business_unit_group_members")
          .delete()
          .eq("group_id", id)
          .not("business_unit_name", "in", `(${quotedList})`);
        if (delErr) throw delErr;

        const rows = names.map((business_unit_name) => ({
          business_unit_name,
          group_id: id,
        }));
        const { error: upErr } = await supabase
          .from("shared_business_unit_group_members")
          .upsert(rows, { onConflict: "business_unit_name" });
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
      .select("business_unit_name")
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
