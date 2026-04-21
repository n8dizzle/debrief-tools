import { NextRequest, NextResponse } from "next/server";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServiceTitanClient } from "@/lib/servicetitan";

export const dynamic = "force-dynamic";

/**
 * Proxy to ST's /customers/{id} endpoint. Used by the admin Referrers page
 * to show "→ {name}" preview when an admin is typing or pasting a ST
 * customer ID, so they can verify it's the right person before saving the
 * linkage. Keeps the ST credentials server-side.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireReferralsAdmin("can_view_admin");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Must be numeric" }, { status: 400 });
  }

  const st = getServiceTitanClient();
  if (!st.isConfigured()) {
    return NextResponse.json(
      { error: "ServiceTitan not configured" },
      { status: 503 }
    );
  }

  const customer = await st.getCustomer(Number(id));
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: customer.id,
    name: customer.name,
    active: customer.active,
  });
}
