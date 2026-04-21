import { getServerSupabase } from "@/lib/supabase";
import { getServiceTitanClient } from "@/lib/servicetitan";
import { getBooleanSetting, getSetting } from "@/lib/settings";
import { classifyExpectedCategory, type ServiceType, SERVICE_TYPE_LABELS } from "./classify";
import { serializeTierSnapshot } from "./snapshot";
import { normalizePhone } from "./phone";
import type { Referrer, Referral, RewardTier } from "@/lib/supabase";

export interface ReferralInput {
  referredName: string;
  referredEmail: string | null;
  referredPhone: string;
  referredAddress: string | null;
  serviceType: ServiceType;
  notes: string | null;
}

export type SubmitResult =
  | { ok: true; referral: Referral; refereeDiscountLabel: string }
  | { ok: false; code: "SELF_REFERRAL" | "DUPLICATE" | "NO_CONFIG" | "ERROR"; message: string };

/**
 * Submit a referral:
 * 1. Anti-fraud: block self-referral, flag duplicate (same phone referred by someone else).
 * 2. Snapshot the reward tier that was active at submission.
 * 3. Create a Lead in ServiceTitan (best-effort; a failure does not block the submission).
 * 4. Insert into ref_referrals.
 *
 * The caller handles emails.
 */
export async function submitReferral(
  referrer: Referrer,
  input: ReferralInput
): Promise<SubmitResult> {
  const supabase = getServerSupabase();
  const phone = normalizePhone(input.referredPhone);
  const email = input.referredEmail?.toLowerCase() || null;

  // 1. Self-referral guard
  if (email && email === referrer.email) {
    return { ok: false, code: "SELF_REFERRAL", message: "You can't refer yourself." };
  }
  if (phone === normalizePhone(referrer.phone || "")) {
    return { ok: false, code: "SELF_REFERRAL", message: "You can't refer yourself." };
  }

  // 2. Duplicate detection — same phone actively in-flight from a DIFFERENT referrer
  const { data: existingDupes } = await supabase
    .from("ref_referrals")
    .select("id, referrer_id, status")
    .eq("referred_phone", input.referredPhone)
    .in("status", ["SUBMITTED", "BOOKED", "COMPLETED", "REWARD_ISSUED"]);

  const conflictingRef = (existingDupes || []).find(
    (r) => r.referrer_id !== referrer.id
  );
  if (conflictingRef) {
    return {
      ok: false,
      code: "DUPLICATE",
      message:
        "This person has already been referred by someone else. First referral wins — we'll reach out to them through the original referrer.",
    };
  }

  // 3. Resolve the tier snapshot for the expected service category
  if (!referrer.assigned_reward_config_id) {
    return {
      ok: false,
      code: "NO_CONFIG",
      message: "We couldn't match your account to an active program. Contact us for help.",
    };
  }

  const expectedCategory = classifyExpectedCategory(input.serviceType);
  const { data: tierRow } = await supabase
    .from("ref_reward_tiers")
    .select("*")
    .eq("reward_config_id", referrer.assigned_reward_config_id)
    .eq("service_category", expectedCategory)
    .single();

  const tier = tierRow as RewardTier | null;
  const snapshot = tier ? serializeTierSnapshot(tier) : null;
  const refereeDiscountLabel =
    tier?.referee_discount_label || "a neighbor-referral benefit";

  // 4. Create Lead in ServiceTitan (best-effort — don't block submission on failure).
  //    Skipped entirely if the admin hasn't wired up a campaign ID yet.
  let serviceTitanLeadId: string | null = null;
  const st = getServiceTitanClient();
  const campaignIdRaw = await getSetting("st_referral_campaign_id");
  const campaignId = campaignIdRaw ? Number(campaignIdRaw) : NaN;

  if (st.isConfigured() && Number.isFinite(campaignId) && campaignId > 0) {
    try {
      const body = [
        `Referred by: ${referrer.first_name} ${referrer.last_name} (${referrer.referral_code})`,
        `Name: ${input.referredName}`,
        `Phone: ${input.referredPhone}`,
        email ? `Email: ${email}` : "",
        input.referredAddress ? `Address: ${input.referredAddress}` : "",
        `Service: ${SERVICE_TYPE_LABELS[input.serviceType]}`,
        input.notes ? `Notes: ${input.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      // ServiceTitan's v2 Leads API requires either followUpDate OR
      // callReasonId. We don't know a reason here (the referrer just picks a
      // service type), so default to a follow-up date 24 hours out — gives
      // dispatch a natural tomorrow-morning deadline to call the lead back.
      // Without this the API returns 400 "Follow up date or Call Reason ID is required."
      const followUpIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const lead = await st.createLead({
        campaignId,
        body,
        summary: `Referral: ${input.referredName} — ${SERVICE_TYPE_LABELS[input.serviceType]}`,
        priority: "Normal",
        followUpDate: followUpIso,
        contactInfo: {
          type: "Phone",
          value: input.referredPhone,
          memo: input.referredName,
        },
      });
      if (lead?.id) serviceTitanLeadId = String(lead.id);
    } catch (err) {
      console.warn("ServiceTitan lead create failed — continuing:", err);
    }
  } else if (st.isConfigured()) {
    console.warn(
      "Skipping ST lead: st_referral_campaign_id not configured in /admin/settings"
    );
  }

  // 5. Triple Win snapshot. Gate is: global setting ON AND referrer has a
  //    charity picked AND that charity is still active. An inactive charity
  //    at submission time skips TW entirely so the reward never tries to
  //    fulfill against a deactivated charity row. The referrer's selected
  //    charity stays set — they can re-pick from the dashboard — but this
  //    specific referral won't trigger a match.
  const globalTripleWin = await getBooleanSetting("triple_win_enabled", true);
  let charityStillActive = false;
  if (globalTripleWin && referrer.selected_charity_id) {
    const { data: charityRow } = await supabase
      .from("ref_charities")
      .select("is_active")
      .eq("id", referrer.selected_charity_id)
      .maybeSingle();
    charityStillActive = !!charityRow?.is_active;
    if (referrer.selected_charity_id && !charityStillActive) {
      console.warn(
        `Referrer ${referrer.id} has selected_charity_id pointing to ` +
          `inactive/missing charity ${referrer.selected_charity_id} — ` +
          `skipping Triple Win for this referral.`
      );
    }
  }
  const willActivateTripleWin = globalTripleWin && charityStillActive;

  // 6. Insert the referral
  const { data: inserted, error: insertErr } = await supabase
    .from("ref_referrals")
    .insert({
      referrer_id: referrer.id,
      referred_name: input.referredName,
      referred_email: email,
      referred_phone: input.referredPhone,
      referred_address: input.referredAddress,
      service_requested: SERVICE_TYPE_LABELS[input.serviceType],
      notes: input.notes,
      service_titan_lead_id: serviceTitanLeadId,
      reward_config_id: referrer.assigned_reward_config_id,
      snapshot_tier_json: snapshot,
      triple_win_activated: willActivateTripleWin,
      snapshot_charity_id: willActivateTripleWin
        ? referrer.selected_charity_id
        : null,
      status: "SUBMITTED",
    })
    .select("*")
    .single();

  if (insertErr || !inserted) {
    console.error("Referral insert failed:", insertErr);
    return { ok: false, code: "ERROR", message: "Submission failed. Please try again." };
  }

  return {
    ok: true,
    referral: inserted as Referral,
    refereeDiscountLabel,
  };
}
