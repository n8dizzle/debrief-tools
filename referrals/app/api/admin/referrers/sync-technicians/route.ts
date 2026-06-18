import { NextRequest, NextResponse } from "next/server";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import { getServiceTitanClient } from "@/lib/servicetitan";
import { generateReferralCode } from "@/lib/referral-codes";
import { assignRewardConfig } from "@/lib/assign-reward-config";
import { sendWelcomeEmail } from "@/lib/email/welcome";
import type { Charity } from "@/lib/supabase";

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

/** Specific emails that should never be enrolled (shared/team/vendor accounts). */
const BLOCKED_EMAILS = new Set([
  "jordans@christmasair.com", // Install Team shared account
  "ar@christmasair.com",      // AR shared account
  "admin@christmasair.com",   // Admin shared account
]);

/** Name substrings (case-insensitive) that should never be enrolled. */
const BLOCKED_NAME_FRAGMENTS = [
  "install team",
  "best postcards",
  "after hours",
  "cxr team",
];

/** Filter out shared/team/system emails that shouldn't be enrolled. */
function isPersonalEmail(email: string): boolean {
  const lower = email.toLowerCase();
  if (BLOCKED_EMAILS.has(lower)) return false;
  const blockedDomains = ["slack.com"];
  const blockedPrefixes = ["approved-", "noreply", "no-reply", "donotreply", "notifications@", "alerts@"];
  if (blockedDomains.some((d) => lower.includes(`@${d}`))) return false;
  if (blockedPrefixes.some((p) => lower.startsWith(p))) return false;
  return true;
}

/** Filter out non-person ST accounts by name. */
function isPersonName(name: string): boolean {
  const lower = name.toLowerCase();
  return !BLOCKED_NAME_FRAGMENTS.some((frag) => lower.includes(frag));
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

  // Get first active charity to assign as default (full object needed for welcome email)
  const { data: charities } = await supabase
    .from("ref_charities")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .limit(1);
  const defaultCharity = (charities?.[0] as Charity) ?? null;
  const defaultCharityId = defaultCharity?.id ?? null;

  // Load existing referrers to detect duplicates
  const { data: existing } = await supabase
    .from("ref_referrers")
    .select("email");
  const existingEmails = new Set(
    (existing || []).map((r) => r.email?.toLowerCase())
  );

  let created = 0;
  let skippedExisting = 0;
  let skippedNoEmail = 0;
  let skippedBadEmail = 0;
  let skippedBlocked = 0;
  const errors: string[] = [];

  for (const person of combined) {
    // Blocked by name (team/vendor accounts)
    if (!isPersonName(person.name)) {
      skippedBlocked++;
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
      // Look up this employee's actual ST *customer* record by cross-validating
      // phone + email. Technician/employee IDs are a different ID space from CRM
      // customer IDs — storing the employee ID would link to the wrong record.
      // ST's email-filter alone is unreliable; requiring both fields avoids
      // false matches. Null is fine if they're not a customer yet.
      let stCustomerId: string | null = null;
      if (person.phoneNumber) {
        try {
          const stCustomer = await st.findCustomerByPhoneAndEmail(
            person.phoneNumber,
            emailLower,
            firstName,
            lastName
          );
          if (stCustomer) stCustomerId = String(stCustomer.id);
        } catch {
          // Non-fatal — proceed without the customer link
        }
      }

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
        service_titan_id: stCustomerId,
        referral_code: referralCode,
        referral_link: referralLink,
        reward_preference: "VISA_GIFT_CARD",
        assigned_reward_config_id: rewardConfigId,
        selected_charity_id: defaultCharityId,
        referrer_type: "EMPLOYEE",
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
      created++;

      // Send welcome email fire-and-forget — don't let failures block the batch
      const newReferrer = {
        id: "",
        email: emailLower,
        phone: person.phoneNumber ?? null,
        first_name: firstName,
        last_name: lastName,
        referral_code: referralCode,
        referral_link: referralLink,
        reward_preference: "VISA_GIFT_CARD" as const,
        selected_charity_id: defaultCharityId,
        suggested_charity_name: null,
        service_titan_id: stCustomerId,
        assigned_reward_config_id: rewardConfigId,
        total_earned: 0,
        total_donated_on_their_behalf: 0,
        lifetime_referrals: 0,
        referrer_type: "EMPLOYEE" as const,
        is_active: true,
        enrolled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      sendWelcomeEmail({
        referrer: newReferrer,
        charity: defaultCharity,
        dashboardUrl: `${appUrl}/dashboard`,
      }).catch((e) => console.error(`Welcome email failed for ${emailLower}:`, e));
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
    skipped_blocked: skippedBlocked,
    errors,
  });
}
