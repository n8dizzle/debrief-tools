import { NextRequest, NextResponse } from "next/server";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import { getServiceTitanClient } from "@/lib/servicetitan";
import { generateReferralCode } from "@/lib/referral-codes";
import { assignRewardConfig } from "@/lib/assign-reward-config";

function getAppUrl(): string {
  return process.env.NEXTAUTH_URL || "https://refer.christmasair.com";
}

/** Split "First Last Name" → { firstName, lastName }.
 *  Everything after the first space becomes lastName.
 *  Single-word names get lastName = "". */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const idx = trimmed.indexOf(" ");
  if (idx === -1) return { firstName: trimmed, lastName: "" };
  return {
    firstName: trimmed.slice(0, idx),
    lastName: trimmed.slice(idx + 1),
  };
}

export async function POST(req: NextRequest) {
  const admin = await requireReferralsAdmin("can_view_admin");
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const st = getServiceTitanClient();
  if (!st.isConfigured()) {
    return NextResponse.json(
      { error: "ServiceTitan is not configured on this environment." },
      { status: 503 }
    );
  }

  // Fetch all active technicians from ST
  let technicians;
  try {
    technicians = await st.getTechnicians(true);
  } catch (err) {
    console.error("Failed to fetch ST technicians:", err);
    return NextResponse.json(
      { error: "Failed to fetch technicians from ServiceTitan." },
      { status: 502 }
    );
  }

  const supabase = getServerSupabase();
  const appUrl = getAppUrl();

  // Get first active charity to assign as default
  const { data: charities } = await supabase
    .from("ref_charities")
    .select("id")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .limit(1);
  const defaultCharityId = charities?.[0]?.id ?? null;

  // Get existing referrers by email and ST ID to detect duplicates
  const { data: existing } = await supabase
    .from("ref_referrers")
    .select("email, service_titan_id");
  const existingEmails = new Set(
    (existing || []).map((r) => r.email?.toLowerCase())
  );
  const existingStIds = new Set(
    (existing || [])
      .filter((r) => r.service_titan_id)
      .map((r) => r.service_titan_id)
  );

  let created = 0;
  let skippedExisting = 0;
  let skippedNoEmail = 0;
  const errors: string[] = [];

  for (const tech of technicians) {
    // Skip techs already enrolled by ST ID
    if (existingStIds.has(String(tech.id))) {
      skippedExisting++;
      continue;
    }

    // Skip techs without an email
    if (!tech.email) {
      skippedNoEmail++;
      continue;
    }

    const emailLower = tech.email.toLowerCase();

    // Skip techs whose email is already enrolled
    if (existingEmails.has(emailLower)) {
      skippedExisting++;
      continue;
    }

    const { firstName, lastName } = splitName(tech.name);

    try {
      const [referralCode, rewardConfigId] = await Promise.all([
        generateReferralCode(firstName),
        assignRewardConfig(),
      ]);

      const referralLink = `${appUrl}/refer/${referralCode}`;

      const { error } = await supabase.from("ref_referrers").insert({
        email: emailLower,
        phone: tech.phoneNumber ?? null,
        first_name: firstName,
        last_name: lastName,
        service_titan_id: String(tech.id),
        referral_code: referralCode,
        referral_link: referralLink,
        reward_preference: "VISA_GIFT_CARD",
        assigned_reward_config_id: rewardConfigId,
        selected_charity_id: defaultCharityId,
        triple_win_enabled: true,
        is_active: true,
      });

      if (error) {
        // Race condition — another request created this email/code first
        if (error.code === "23505") {
          skippedExisting++;
        } else {
          errors.push(`${tech.name} (${emailLower}): ${error.message}`);
        }
        continue;
      }

      // Track to avoid duplicates within this batch
      existingEmails.add(emailLower);
      existingStIds.add(String(tech.id));
      created++;
    } catch (err) {
      errors.push(`${tech.name}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    total: technicians.length,
    created,
    skipped_existing: skippedExisting,
    skipped_no_email: skippedNoEmail,
    errors,
  });
}
