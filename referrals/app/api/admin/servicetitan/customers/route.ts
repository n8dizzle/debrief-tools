import { NextRequest, NextResponse } from "next/server";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServiceTitanClient } from "@/lib/servicetitan";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/servicetitan/customers?q=...
 *
 * Search ST customers by name, email, or phone. Used by the ST customer link
 * widget so admins can find the right record without knowing the numeric ID.
 * Auto-detects query type:
 *  - 8+ digits → phone search
 *  - contains @ → email search
 *  - otherwise → name search
 */
export async function GET(req: NextRequest) {
  const admin = await requireReferralsAdmin("can_view_admin");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const st = getServiceTitanClient();
  if (!st.isConfigured()) {
    return NextResponse.json(
      { error: "ServiceTitan not configured" },
      { status: 503 }
    );
  }

  const customers = await st.searchCustomers(q);

  return NextResponse.json({
    results: customers.map((c) => ({
      id: String(c.id),
      name: c.name,
      email: c.email ?? null,
      phone: c.phoneNumber ?? null,
      active: c.active ?? true,
    })),
  });
}
