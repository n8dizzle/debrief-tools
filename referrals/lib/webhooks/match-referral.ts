import { getServerSupabase } from "@/lib/supabase";
import { getServiceTitanClient } from "@/lib/servicetitan";
import { normalizePhone } from "@/lib/referrals/phone";
import type { Referral } from "@/lib/supabase";

/**
 * Given a ServiceTitan customer ID, find the Referral this customer came from.
 *
 * Match order:
 * 1. ref_referrals.service_titan_customer_id already set → direct hit
 * 2. Customer's custom field `Referral_Code` → referrer → latest SUBMITTED referral
 * 3. Phone match (normalized) against any in-flight referral
 *
 * Returns null if no match found (which means this customer wasn't referred,
 * or we can't prove it).
 */
export async function findReferralByCustomerId(
  stCustomerId: number
): Promise<Referral | null> {
  const supabase = getServerSupabase();

  // 1. Direct match via service_titan_customer_id
  const { data: direct } = await supabase
    .from("ref_referrals")
    .select("*")
    .eq("service_titan_customer_id", String(stCustomerId))
    .in("status", ["SUBMITTED", "BOOKED"])
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (direct) return direct as Referral;

  // Need to pull the ST customer to try deeper matching
  const st = getServiceTitanClient();
  if (!st.isConfigured()) return null;

  const customer = await st.getCustomer(stCustomerId);
  if (!customer) return null;

  // 2. Custom field: Referral_Code
  const customFields = Array.isArray(customer.customFields) ? customer.customFields : [];
  const codeField = customFields.find(
    (cf: { name?: string }) =>
      cf.name === "Referral_Code" || cf.name === "Referral Code"
  );
  const referralCode = (codeField as { value?: string })?.value?.trim();

  if (referralCode) {
    const { data: referrer } = await supabase
      .from("ref_referrers")
      .select("id")
      .eq("referral_code", referralCode)
      .maybeSingle();

    if (referrer) {
      const { data: byCode } = await supabase
        .from("ref_referrals")
        .select("*")
        .eq("referrer_id", referrer.id)
        .in("status", ["SUBMITTED", "BOOKED"])
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byCode) {
        // Backfill the customer id for future webhooks
        await supabase
          .from("ref_referrals")
          .update({ service_titan_customer_id: String(stCustomerId) })
          .eq("id", byCode.id);
        return byCode as Referral;
      }
    }
  }

  // 3. Phone fallback
  const customerPhone = normalizePhone(customer.phoneNumber || "");
  if (customerPhone.length >= 10) {
    const { data: candidates } = await supabase
      .from("ref_referrals")
      .select("*")
      .in("status", ["SUBMITTED", "BOOKED"])
      .order("submitted_at", { ascending: false })
      .limit(50);

    for (const c of (candidates || []) as Referral[]) {
      if (normalizePhone(c.referred_phone) === customerPhone) {
        // Backfill customer id
        await supabase
          .from("ref_referrals")
          .update({ service_titan_customer_id: String(stCustomerId) })
          .eq("id", c.id);
        return c;
      }
    }
  }

  return null;
}
