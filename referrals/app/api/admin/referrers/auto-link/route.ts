import { NextRequest, NextResponse } from "next/server";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import { getServiceTitanClient } from "@/lib/servicetitan";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/referrers/auto-link
 *
 * Backfill ST customer IDs for referrers that don't have one yet.
 * Uses phone + email cross-validation to avoid false matches.
 * Safe to run multiple times — skips already-linked referrers.
 */
export async function POST(req: NextRequest) {
  const admin = await requireReferralsAdmin("can_view_admin");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const st = getServiceTitanClient();
  if (!st.isConfigured()) {
    return NextResponse.json(
      { error: "ServiceTitan is not configured on this environment." },
      { status: 503 }
    );
  }

  const supabase = getServerSupabase();

  // Fetch all referrers with no ST customer link
  const { data: unlinked, error } = await supabase
    .from("ref_referrers")
    .select("id, email, phone, first_name, last_name")
    .is("service_titan_id", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let linked = 0;
  let skippedNoMatch = 0;
  const errors: string[] = [];

  for (const referrer of unlinked || []) {
    try {
      // Require both phone AND email to agree — ST's email-filter endpoint is
      // unreliable (may return wrong records). Cross-validating with phone gives
      // us high confidence we have the right customer. Referrers without a phone
      // on file are skipped; an admin can link them manually.
      if (!referrer.phone) {
        skippedNoMatch++;
        continue;
      }

      const stCustomer = await st.findCustomerByPhoneAndEmail(
        referrer.phone,
        referrer.email,
        referrer.first_name ?? undefined,
        referrer.last_name ?? undefined
      );

      if (!stCustomer) {
        skippedNoMatch++;
        continue;
      }

      const { error: updateErr } = await supabase
        .from("ref_referrers")
        .update({ service_titan_id: String(stCustomer.id) })
        .eq("id", referrer.id)
        .is("service_titan_id", null); // safety: don't overwrite if already set

      if (updateErr) {
        errors.push(`${referrer.email}: ${updateErr.message}`);
      } else {
        linked++;
      }
    } catch (err) {
      errors.push(`${referrer.email}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    total_checked: (unlinked || []).length,
    linked,
    skipped_no_match: skippedNoMatch,
    errors,
  });
}
