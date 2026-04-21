import { NextRequest, NextResponse } from "next/server";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import { getServiceTitanClient } from "@/lib/servicetitan";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Tag the ST customer tied to this referral with the referrer's code.
 * Writes to ST's Referral_Code custom field on the Customer entity so
 * future invoice webhooks can match via path 2 (custom-field lookup)
 * instead of the fragile phone fallback (path 3).
 *
 * Preconditions:
 *  - The referral has service_titan_customer_id set (admin has linked
 *    to a specific ST customer, or a prior webhook already matched).
 *  - ref_settings.st_customer_referral_code_field_id is configured with
 *    the numeric typeId of the Referral_Code custom field in ST (one-
 *    time ST admin setup: Settings → Custom Fields → Customer).
 *
 * Idempotent on the ST side — writing the same value is a no-op.
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireReferralsAdmin("can_view_admin");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const supabase = getServerSupabase();

  const { data: referralRow, error: lookupErr } = await supabase
    .from("ref_referrals")
    .select(
      "id, service_titan_customer_id, referrer:ref_referrers(referral_code)"
    )
    .eq("id", id)
    .maybeSingle();

  if (lookupErr || !referralRow) {
    return NextResponse.json({ error: "Referral not found" }, { status: 404 });
  }

  // Supabase's typed select doesn't always resolve the joined shape — cast.
  const referral = referralRow as unknown as {
    id: string;
    service_titan_customer_id: string | null;
    referrer: { referral_code: string } | null;
  };

  if (!referral.service_titan_customer_id) {
    return NextResponse.json(
      {
        error:
          "No ServiceTitan customer linked yet. Set service_titan_customer_id on this referral first (happens automatically after the first matched webhook, or link manually).",
      },
      { status: 400 }
    );
  }

  const referralCode = referral.referrer?.referral_code;
  if (!referralCode) {
    return NextResponse.json(
      { error: "Referrer record missing referral_code" },
      { status: 500 }
    );
  }

  const fieldIdRaw = await getSetting("st_customer_referral_code_field_id");
  const fieldId = fieldIdRaw ? Number(fieldIdRaw) : NaN;
  if (!Number.isFinite(fieldId) || fieldId <= 0) {
    return NextResponse.json(
      {
        error:
          "st_customer_referral_code_field_id not set in /admin/settings. ST admin first creates the Referral_Code custom field in ST Settings → Custom Fields → Customer, then paste its numeric typeId here.",
      },
      { status: 503 }
    );
  }

  const st = getServiceTitanClient();
  if (!st.isConfigured()) {
    return NextResponse.json(
      { error: "ServiceTitan credentials not configured" },
      { status: 503 }
    );
  }

  try {
    await st.setCustomerCustomField(
      Number(referral.service_titan_customer_id),
      fieldId,
      referralCode
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `Tag-in-ST failed for referral ${referral.id} → customer ${referral.service_titan_customer_id}:`,
      message
    );
    return NextResponse.json(
      { error: message.slice(0, 300) },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    customerId: referral.service_titan_customer_id,
    referralCode,
  });
}
