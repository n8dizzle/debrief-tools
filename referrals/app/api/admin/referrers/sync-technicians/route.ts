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

/** Filter out shared/team/system emails that shouldn't be enrolled. */
function isPersonalEmail(email: string): boolean {
  const lower = email.toLowerCase();
  const blockedDomains = ["slack.com"];
  const blockedPrefixes = ["approved-", "noreply", "no-reply", "donotreply", "notifications@", "alerts@"];
  if (blockedDomains.some((d) => lower.includes(`@${d}`))) return false;
  if (blockedPrefixes.some((p) => lower.startsWith(p))) return false;
  return true;
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

  // Fetch technicians and employees in parallel
  let technicians: Awaited<ReturnType<typeof st.getTechnicians>>;
  let employees: Awaited<ReturnType<typeof st.getEmployees>>;
  try {
    [technicians, employees] = await Promise.all([
      st.getTechnicians(true),
      st.getEmployees(true),
    ]);
  } catch (err) {
    console.error("Failed to fetch ST staff:", err);
    return NextResponse.json(
      { error: "Failed to fetch staff from ServiceTitan." },
      { status: 502 }
    );
  }

  // Merge technicians + employees, deduplicate by ST ID (technicians take priority)
  const seenStIds = new Set<string>();
  const combined: Array<{ id: number; name: string; email?: string; phoneNumber?: string }> = [];

  for (const t of technicians) {
    seenStIds.add(String(t.id));
    combined.push(t);
  }
  for (const e of employees) {
    if (!seenStIds.has(String(e.id))) {
      seenStIds.add(String(e.id));
      combined.push(e);
    }
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

  // Load existing referrers to detect duplicates
  const { data: existing } = await supabase
    .from("ref_referrers")
    .select("email, service_titan_id");
  const existingEmails = new Set(
    (existing || []).map((r) => r.email?.toLowerCase())
  );
  const existingStIds = new Set(
    (existing || []).filter((r) => r.service_titan_id).map((r) => r.service_titan_id)
  );

  let created = 0;
  let skippedExisting = 0;
  let skippedNoEmail = 0;
  let skippedBadEmail = 0;
  const errors: string[] = [];

  for (const person of combined) {
    // Already enrolled by ST ID
    if (existingStIds.has(String(person.id))) {
      skippedExisting++;
      continue;
    }

    // No email on file
    if (!person.email) {
      skippedNoEmail++;
      continue;
    }

    const emailLower = person.email.toLowerCase();

    // Filter out shared/system emails
    if (!isPersonalEmail(emailLower)) {
      skippedBadEmail++;
      continue;
    }

    // Already enrolled by email
    if (existingEmails.has(emailLower)) {
      skippedExisting++;
      continue;
    }

    const { firstName, lastName } = splitName(person.name);

    try {
      const [referralCode, rewardConfigId] = await Promise.all([
        generateReferralCode(firstName),
        assignRewardConfig(),
      ]);

      const referralLink = `${appUrl}/refer/${referralCode}`;

      const { error } = await supabase.from("ref_referrers").insert({
        email: emailLower,
        phone: person.phoneNumber ?? null,
        first_name: firstName,
        last_name: lastName,
        service_titan_id: String(person.id),
        referral_code: referralCode,
        referral_link: referralLink,
        reward_preference: "VISA_GIFT_CARD",
        assigned_reward_config_id: rewardConfigId,
        selected_charity_id: defaultCharityId,
        is_active: true,
      });

      if (error) {
        if (error.code === "23505") {
          skippedExisting++;
        } else {
          errors.push(`${person.name} (${emailLower}): ${error.message}`);
        }
        continue;
      }

      // Track within this batch to avoid duplicates
      existingEmails.add(emailLower);
      existingStIds.add(String(person.id));
      created++;
    } catch (err) {
      errors.push(`${person.name}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    total_technicians: technicians.length,
    total_employees: employees.length,
    total_unique: combined.length,
    created,
    skipped_existing: skippedExisting,
    skipped_no_email: skippedNoEmail,
    skipped_bad_email: skippedBadEmail,
    errors,
  });
}
