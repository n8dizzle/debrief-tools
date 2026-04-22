import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase, getPortalUser } from "@/lib/supabase";

// GET /api/business-unit-groups/available-bus
// Returns the distinct ServiceTitan business-unit *names* seen across AR invoices.
// Keyed on name because ar_invoices.business_unit_id is not populated by sync.
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

    const names = new Set<string>();
    const pageSize = 1000;
    let offset = 0;
    for (let i = 0; i < 50; i++) {
      const { data, error } = await supabase
        .from("ar_invoices")
        .select("business_unit_name")
        .not("business_unit_name", "is", null)
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data) {
        const name = row.business_unit_name as string | null;
        if (name) names.add(name);
      }
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    const businessUnits = Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map((business_unit_name) => ({ business_unit_name }));

    return NextResponse.json({ businessUnits });
  } catch (error) {
    console.error("Error fetching available business units:", error);
    return NextResponse.json(
      { error: "Failed to fetch available business units" },
      { status: 500 },
    );
  }
}
