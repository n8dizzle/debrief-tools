import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase";
import { getServiceTitanClient } from "@/lib/servicetitan";
import { generateReferralCode } from "@/lib/referral-codes";
import { assignRewardConfig } from "@/lib/assign-reward-config";
import { sendWelcomeEmail } from "@/lib/email/welcome";
import { issueMagicLinkToken } from "@/lib/customer-auth";
import { sendMagicLinkEmail } from "@/lib/email/magic-link";
import type { Charity, Referrer } from "@/lib/supabase";

const EnrollSchema = z
  .object({
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
    tripleWinEnabled: z.boolean().default(false),
    selectedCharityId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (d) => !d.tripleWinEnabled || !!d.selectedCharityId,
    { message: "Charity selection required when Triple Win is enabled" }
  );

function getAppUrl(req: NextRequest): string {
  return process.env.NEXTAUTH_URL || req.nextUrl.origin;
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

  // Validate Triple Win charity if opted in
  let charity: Charity | null = null;
  if (data.tripleWinEnabled && data.selectedCharityId) {
    const { data: c } = await supabase
      .from("ref_charities")
      .select("*")
      .eq("id", data.selectedCharityId)
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

  // Best-effort ServiceTitan customer match by phone, then email
  let serviceTitanId: string | null = null;
  const st = getServiceTitanClient();
  if (st.isConfigured()) {
    try {
      const byPhone = await st.findCustomerByPhone(data.phone);
      if (byPhone) serviceTitanId = String(byPhone.id);
      else {
        const byEmail = await st.findCustomerByEmail(email);
        if (byEmail) serviceTitanId = String(byEmail.id);
      }
    } catch (err) {
      console.warn("ServiceTitan lookup failed — continuing without match:", err);
    }
  }

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
        triple_win_enabled: data.tripleWinEnabled,
        selected_charity_id: data.tripleWinEnabled ? data.selectedCharityId : null,
      })
      .select("*")
      .single();
  }

  let { data: inserted, error: insertErr } = await insertReferrer(serviceTitanId);

  if (
    insertErr &&
    serviceTitanId &&
    (insertErr as { code?: string }).code === "23505" &&
    String((insertErr as { details?: string }).details || "").includes("service_titan_id")
  ) {
    console.warn(
      `ST customer ${serviceTitanId} already linked to another referrer — inserting without ST linkage`
    );
    ({ data: inserted, error: insertErr } = await insertReferrer(null));
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
    tripleWinEnabled: referrer.triple_win_enabled,
  });
}
