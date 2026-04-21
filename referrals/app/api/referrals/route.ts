import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase";
import { submitReferral } from "@/lib/referrals/submit";
import { sendReferralConfirmedToFriend } from "@/lib/email/referral-confirmed-friend";
import { sendReferralSubmittedToReferrer } from "@/lib/email/referral-submitted-to-referrer";
import type { Charity, Referrer } from "@/lib/supabase";

const SubmitSchema = z
  .object({
    referralCode: z.string().min(3).max(40),
    referredName: z.string().trim().min(1).max(100),
    // Either phone OR email is required — enforced by .refine() below.
    // Empty strings are normalized to null so downstream logic (submit.ts
    // dedup, ST contact array builder) has a single "absent" sentinel.
    referredPhone: z
      .string()
      .trim()
      .max(25)
      .transform((v) => (v.length === 0 ? null : v))
      .nullable()
      .optional(),
    referredEmail: z
      .string()
      .trim()
      .max(254)
      .transform((v) => (v.length === 0 ? null : v))
      .nullable()
      .optional()
      .refine(
        (v) => v === null || v === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        { message: "Invalid email address" }
      ),
    serviceType: z.enum([
      "HVAC",
      "PLUMBING",
      "WATER_HEATER",
      "COMMERCIAL",
      "NOT_SURE",
    ]),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine(
    (data) =>
      (data.referredPhone && data.referredPhone.length >= 10) ||
      (data.referredEmail && data.referredEmail.length > 0),
    {
      message:
        "Please share either a phone number or an email so we can reach out.",
      path: ["referredPhone"],
    }
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

  // Submit. Phone and email are both optional at this layer (the Zod refine
  // above guarantees at least one is present); submit.ts handles the absent
  // case in dedup + ST payload construction.
  const result = await submitReferral(referrer, {
    referredName: data.referredName,
    referredEmail: data.referredEmail || null,
    referredPhone: data.referredPhone || null,
    referredAddress: null,
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
