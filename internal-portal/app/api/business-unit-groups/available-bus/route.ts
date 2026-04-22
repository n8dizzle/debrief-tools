import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase, getPortalUser } from "@/lib/supabase";

// GET /api/business-unit-groups/available-bus
// Returns the distinct ServiceTitan business units seen across AR invoices.
// Admin-only — the raw list is only needed for the mapping UI.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const portalUser = await getPortalUser(session.user.email);
    if (!portalUser || portalUser.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServerSupabase();

    // Pull distinct BUs from ar_invoices (most comprehensive source today).
    // Paginate to avoid the default 1000-row cap.
    const all: { business_unit_id: number; business_unit_name: string | null }[] = [];
    const seen = new Set<number>();
    const pageSize = 1000;
    let offset = 0;
    for (let i = 0; i < 50; i++) {
      const { data, error } = await supabase
        .from("ar_invoices")
        .select("business_unit_id, business_unit_name")
        .not("business_unit_id", "is", null)
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data) {
        const id = row.business_unit_id as number | null;
        if (id == null || seen.has(id)) continue;
        seen.add(id);
        all.push({
          business_unit_id: id,
          business_unit_name: (row.business_unit_name as string | null) ?? null,
        });
      }
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    all.sort((a, b) => {
      const an = a.business_unit_name || "";
      const bn = b.business_unit_name || "";
      return an.localeCompare(bn);
    });

    return NextResponse.json({ businessUnits: all });
  } catch (error) {
    console.error("Error fetching available business units:", error);
    return NextResponse.json(
      { error: "Failed to fetch available business units" },
      { status: 500 },
    );
  }
}
