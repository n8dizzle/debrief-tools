import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase";
import { submitReferral } from "@/lib/referrals/submit";
import { sendReferralConfirmedToFriend } from "@/lib/email/referral-confirmed-friend";
import { sendReferralSubmittedToReferrer } from "@/lib/email/referral-submitted-to-referrer";
import type { Charity, Referrer } from "@/lib/supabase";

const SubmitSchema = z.object({
  referralCode: z.string().min(3).max(40),
  referredName: z.string().trim().min(1).max(100),
  referredEmail: z.string().email().max(254).nullable().optional(),
  referredPhone: z.string().trim().min(10).max(25),
  referredAddress: z.string().trim().max(200).nullable().optional(),
  serviceType: z.enum([
    "HVAC_SERVICE_CALL",
    "HVAC_MAINTENANCE",
    "HVAC_INSTALLATION",
    "PLUMBING_SERVICE_CALL",
    "PLUMBING_MAINTENANCE",
    "PLUMBING_INSTALLATION",
    "WATER_HEATER",
    "COMMERCIAL",
    "OTHER",
  ]),
  notes: z.string().trim().max(1000).nullable().optional(),
});

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

  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const supabase = getServerSupabase();

  // Look up referrer by code
  const { data: referrerRow } = await supabase
    .from("ref_referrers")
    .select("*")
    .eq("referral_code", data.referralCode)
    .eq("is_active", true)
    .single();

  if (!referrerRow) {
    return NextResponse.json(
      { error: "This referral link is no longer active." },
      { status: 404 }
    );
  }
  const referrer = referrerRow as Referrer;

  // Submit
  const result = await submitReferral(referrer, {
    referredName: data.referredName,
    referredEmail: data.referredEmail || null,
    referredPhone: data.referredPhone,
    referredAddress: data.referredAddress || null,
    serviceType: data.serviceType,
    notes: data.notes || null,
  });

  if (!result.ok) {
    const status = result.code === "DUPLICATE" || result.code === "SELF_REFERRAL" ? 409 : 500;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }

  // Resolve charity for email copy (if Triple Win)
  let charity: Charity | null = null;
  if (result.referral.triple_win_activated && result.referral.snapshot_charity_id) {
    const { data } = await supabase
      .from("ref_charities")
      .select("*")
      .eq("id", result.referral.snapshot_charity_id)
      .single();
    charity = (data as Charity) || null;
  }

  const friendFirstName = result.referral.referred_name.split(/\s+/)[0] || "friend";
  const appUrl = getAppUrl(req);

  // Fire-and-forget emails (don't block response on email delivery)
  const friendEmail = result.referral.referred_email;
  const emailJobs: Promise<unknown>[] = [];

  if (friendEmail) {
    emailJobs.push(
      sendReferralConfirmedToFriend({
        to: friendEmail,
        friendFirstName,
        referrerFirstName: referrer.first_name,
        tripleWinCharityName: charity?.name || null,
        refereeDiscountLabel: result.refereeDiscountLabel,
      }).catch((err) =>
        console.error("Friend confirmation email failed:", err)
      )
    );
  }

  emailJobs.push(
    sendReferralSubmittedToReferrer({
      to: referrer.email,
      referrerFirstName: referrer.first_name,
      friendFirstName,
      dashboardUrl: `${appUrl}/dashboard`,
      tripleWinCharityName: charity?.name || null,
    }).catch((err) =>
      console.error("Referrer notification email failed:", err)
    )
  );

  Promise.all(emailJobs).catch(() => {});

  return NextResponse.json({
    success: true,
    refereeDiscountLabel: result.refereeDiscountLabel,
    tripleWinCharityName: charity?.name || null,
  });
}
