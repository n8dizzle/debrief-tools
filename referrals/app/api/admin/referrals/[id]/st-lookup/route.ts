import { NextRequest, NextResponse } from "next/server";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import { getServiceTitanClient } from "@/lib/servicetitan";
import { classifyActualCategory } from "@/lib/rewards/classify-actual";
import type { Referral } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/referrals/[id]/st-lookup
 *
 * Fetches the most recent invoice from ServiceTitan for the referral's linked
 * ST customer. Returns invoice total + auto-classified service category so the
 * admin mark-complete flow can pre-fill from real ST data instead of manual entry.
 *
 * Returns:
 *   { found: true,  customerId, jobId, jobNumber, invoiceId, invoiceTotal,
 *                   jobTypeName, autoCategory, completedOn }
 *   { found: false, reason }
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireReferralsAdmin("can_view_admin");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const supabase = getServerSupabase();

  const { data: referralRow } = await supabase
    .from("ref_referrals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!referralRow) {
    return NextResponse.json({ error: "Referral not found" }, { status: 404 });
  }

  const referral = referralRow as Referral;

  if (!referral.service_titan_customer_id) {
    return NextResponse.json({
      found: false,
      reason: "No ServiceTitan customer linked to this referral",
    });
  }

  const customerId = Number(referral.service_titan_customer_id);
  if (!Number.isFinite(customerId) || customerId <= 0) {
    return NextResponse.json({
      found: false,
      reason: "Invalid ServiceTitan customer ID",
    });
  }

  const st = getServiceTitanClient();
  if (!st.isConfigured()) {
    return NextResponse.json({
      found: false,
      reason: "ServiceTitan not configured on this environment",
    });
  }

  // Fetch the most recent invoices for this customer
  const invoices = await st.getInvoicesForCustomer(customerId, 10);
  if (!invoices.length) {
    return NextResponse.json({
      found: false,
      reason: "No invoices found for this customer in ServiceTitan",
    });
  }

  // Pick the most recent invoice that has a positive total
  const invoice = invoices.find((inv) => inv.total > 0) ?? invoices[0];

  // Fetch the associated job (for type/BU classification)
  let job = null;
  const jobId = invoice.job?.id ?? null;
  if (jobId) {
    job = await st.getJob(jobId);
  }

  const autoCategory = classifyActualCategory(job, invoice);

  return NextResponse.json({
    found: true,
    customerId,
    jobId: job?.id ?? jobId ?? null,
    jobNumber: job?.jobNumber ?? invoice.job?.number ?? null,
    invoiceId: invoice.id,
    invoiceTotal: invoice.total,
    jobTypeName: job?.jobTypeName ?? invoice.job?.type?.name ?? null,
    businessUnit: job?.businessUnitName ?? invoice.businessUnit?.name ?? null,
    autoCategory,
    completedOn: job?.completedOn ?? invoice.createdOn ?? null,
  });
}
