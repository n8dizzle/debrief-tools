import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase";
import { generateReferralCode } from "@/lib/referral-codes";
import { assignRewardConfig } from "@/lib/assign-reward-config";
import { getBooleanSetting } from "@/lib/settings";
import { sendWelcomeEmail } from "@/lib/email/welcome";
import { issueMagicLinkToken } from "@/lib/customer-auth";
import { sendMagicLinkEmail } from "@/lib/email/magic-link";
import type { Charity, Referrer } from "@/lib/supabase";

const EnrollSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  email: z.string().email().max(254),
  phone: z.string().trim().min(10).max(25),
  rewardPreference: z.enum([
    "VISA_GIFT_CARD",
    "AMAZON_GIFT_CARD",
    "ACCOUNT_CREDIT",
    "CHARITY_DONATION",
  ]),
  selectedCharityId: z.string().uuid().nullable().optional(),
});

function getAppUrl(req: NextRequest): string {
  return process.env.NEXTAUTH_URL || req.nextUrl.origin;
}

// Postgres SQLSTATE for unique_violation.
const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolationOn(
  err: unknown,
  column: string
): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; details?: string };
  return (
    e.code === PG_UNIQUE_VIOLATION &&
    typeof e.details === "string" &&
    e.details.includes(column)
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = EnrollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const email = data.email.toLowerCase();
  const supabase = getServerSupabase();

  // Already enrolled? Return their existing code so they can re-share.
  const { data: existing } = await supabase
    .from("ref_referrers")
    .select("referral_code, referral_link")
    .eq("email", email)
    .single();

  if (existing) {
    return NextResponse.json({
      alreadyEnrolled: true,
      referralCode: existing.referral_code,
      referralLink: existing.referral_link,
    });
  }

  // Triple Win is admin-controlled globally (ref_settings.triple_win_enabled).
  // If global is ON and the enrollment form submitted a charity, validate it.
  // If global is OFF, ignore any incoming charity — we won't honor it until
  // the admin flips the switch back on.
  const globalTripleWin = await getBooleanSetting("triple_win_enabled", true);
  let charity: Charity | null = null;
  const effectiveCharityId =
    globalTripleWin && data.selectedCharityId ? data.selectedCharityId : null;

  if (effectiveCharityId) {
    const { data: c } = await supabase
      .from("ref_charities")
      .select("*")
      .eq("id", effectiveCharityId)
      .eq("is_active", true)
      .single();
    if (!c) {
      return NextResponse.json(
        { error: "Selected charity is not available" },
        { status: 400 }
      );
    }
    charity = c as Charity;
  }

  if (globalTripleWin && !effectiveCharityId) {
    return NextResponse.json(
      { error: "Please pick a charity before finishing enrollment." },
      { status: 400 }
    );
  }

  // ServiceTitan customer linkage is set MANUALLY by admin after enrollment
  // (via /admin/referrers). The enrollment-time auto-lookup was removed
  // because ST's /crm/v2/customers search endpoint silently ignores the
  // email filter (returns the alphabetically-first customer regardless of
  // what you pass), producing confident-looking false matches — e.g. every
  // enrollee whose email wasn't in ST got stamped with the first "I" name
  // in the tenant. See also: phone search returns noise too. Until ST gives
  // us a reliable contact-lookup endpoint, no link is safer than a wrong
  // one, and dispatch can link real customers in seconds from the admin UI.
  const serviceTitanId: string | null = null;

  // Assign A/B config (sticky from this point on)
  const assignedRewardConfigId = await assignRewardConfig();

  // Generate unique referral code
  const referralCode = await generateReferralCode(data.firstName);
  const appUrl = getAppUrl(req);
  const referralLink = `${appUrl}/refer/${referralCode}`;

  // Create referrer. If the ST customer we matched is already linked to another
  // referrer (shared phone, household account, prior test data), drop the ST
  // linkage and insert without it — the referrer can be re-linked later.
  async function insertReferrer(stId: string | null) {
    return supabase
      .from("ref_referrers")
      .insert({
        email,
        phone: data.phone,
        first_name: data.firstName,
        last_name: data.lastName,
        service_titan_id: stId,
        referral_code: referralCode,
        referral_link: referralLink,
        reward_preference: data.rewardPreference,
        assigned_reward_config_id: assignedRewardConfigId,
        // triple_win_enabled column is legacy (now admin-controlled globally).
        // We keep writing true/false in case anything still reads it; real gate
        // is ref_settings.triple_win_enabled + snapshot at referral submission.
        triple_win_enabled: !!effectiveCharityId,
        selected_charity_id: effectiveCharityId,
      })
      .select("*")
      .single();
  }

  let { data: inserted, error: insertErr } = await insertReferrer(serviceTitanId);

  if (serviceTitanId && isUniqueViolationOn(insertErr, "service_titan_id")) {
    console.warn(
      `ST customer ${serviceTitanId} already linked to another referrer — inserting without ST linkage`
    );
    ({ data: inserted, error: insertErr } = await insertReferrer(null));
  }

  // Concurrent enrollment race: two POSTs for the same email arrive at nearly
  // the same time. Both pass the early SELECT, one wins the insert, the other
  // hits 23505 on the email UNIQUE index. Re-read and return the happy path.
  if (isUniqueViolationOn(insertErr, "email")) {
    const { data: raced } = await supabase
      .from("ref_referrers")
      .select("referral_code, referral_link")
      .eq("email", email)
      .maybeSingle();
    if (raced) {
      return NextResponse.json({
        alreadyEnrolled: true,
        referralCode: raced.referral_code,
        referralLink: raced.referral_link,
      });
    }
  }

  if (insertErr || !inserted) {
    console.error("Enrollment insert failed:", insertErr);
    return NextResponse.json({ error: "Enrollment failed" }, { status: 500 });
  }

  const referrer = inserted as Referrer;

  // Fire-and-forget emails: welcome + magic link for first dashboard visit
  const dashboardToken = await issueMagicLinkToken(referrer.id);
  const dashboardUrl = `${appUrl}/api/auth/customer/callback?token=${encodeURIComponent(dashboardToken)}`;

  Promise.all([
    sendWelcomeEmail({ referrer, charity, dashboardUrl }),
    sendMagicLinkEmail({
      to: referrer.email,
      firstName: referrer.first_name,
      loginUrl: dashboardUrl,
    }).catch(() => {}),
  ]).catch((err) => console.error("Welcome email batch failed:", err));

  return NextResponse.json({
    success: true,
    referralCode: referrer.referral_code,
    referralLink: referrer.referral_link,
    tripleWinEnabled: globalTripleWin && !!referrer.selected_charity_id,
  });
}
