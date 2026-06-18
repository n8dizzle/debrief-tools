import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getServerSupabase } from "@/lib/supabase";
import { getTremendousClient } from "@/lib/tremendous";
import { finalizeConversion } from "@/lib/webhooks/finalize-conversion";
import type { Referral, ServiceCategory } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/referrals/[id]/mark-complete
 *
 * Manually mark a referral as job-complete and immediately issue Tremendous
 * gift cards to both the referrer AND the referred friend.
 *
 * Use this when the ServiceTitan invoice webhook didn't fire (or the job was
 * booked/completed outside of ST) and you need to trigger rewards manually.
 *
 * Unlike simulate-completion, this route is NOT sandbox-gated — it issues
 * real gift cards against real Tremendous credentials. A confirmation step in
 * the UI is required before calling this endpoint.
 */
const Schema = z.object({
  invoiceTotal: z.number().positive().max(100_000),
  actualCategory: z.enum([
    "SERVICE_CALL",
    "MAINTENANCE",
    "REPLACEMENT",
    "COMMERCIAL",
  ]),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireReferralsAdmin("can_view_admin");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();

  const { data: referralRow } = await supabase
    .from("ref_referrals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!referralRow) {
    return NextResponse.json({ error: "Referral not found" }, { status: 404 });
  }

  const referral = referralRow as Referral;

  if (referral.status === "COMPLETED" || referral.status === "REWARD_ISSUED") {
    return NextResponse.json(
      { error: `Referral is already ${referral.status} — rewards have already been issued.` },
      { status: 409 }
    );
  }

  // ── Step 1: Finalize conversion (referrer reward) ────────────────────────────
  // Uses the same path as the real ST invoice webhook for status updates,
  // ref_rewards row creation, email, and Tremendous fulfillment — but always
  // issues a flat $50 reward regardless of invoice total or service category.
  const FIXED_REWARD = 50;
  const syntheticInvoiceId = `MANUAL-${Date.now()}`;

  const result = await finalizeConversion({
    referral,
    invoiceTotal: parsed.data.invoiceTotal,
    actualCategory: parsed.data.actualCategory as ServiceCategory,
    serviceTitanJobId: null,
    serviceTitanInvoiceId: syntheticInvoiceId,
    simulated: false,
    overrideRewardAmount: FIXED_REWARD,
  });

  // ── Step 2: Friend reward ($50 flat) ────────────────────────────────────────
  // Issue a flat $50 gift card to the referred friend via Tremendous.
  // Requires the friend's email — skip gracefully if it's missing.
  let friendOrderId: string | null = null;
  let friendRewardAmount: number | null = null;
  let friendRewardNote: string | null = null;

  const hasFriendEmail = !!referral.referred_email;
  const hasFriendPhone = !!referral.referred_phone;

  if (hasFriendEmail || hasFriendPhone) {
    const tremendous = getTremendousClient();

    if (!tremendous.isConfigured()) {
      friendRewardNote = "Tremendous not configured — friend reward skipped";
    } else {
      const campaignId = tremendous.getCampaignId();
      if (!campaignId) {
        friendRewardNote = "TREMENDOUS_CAMPAIGN_ID not set — friend reward skipped";
      } else {
        try {
          const friendFirstName =
            referral.referred_name.split(/\s+/)[0] || referral.referred_name;

          const deliveryMethod = hasFriendEmail ? "EMAIL" : "PHONE";

          const { orderId } = await tremendous.createOrder({
            amount: FIXED_REWARD,
            recipient: {
              name: referral.referred_name,
              ...(hasFriendEmail
                ? { email: referral.referred_email! }
                : { phone: referral.referred_phone! }),
            },
            deliveryMethod,
            campaignId,
          });

          friendOrderId = orderId;
          friendRewardAmount = FIXED_REWARD;

          // Stamp the order on the referral row for audit trail
          await supabase
            .from("ref_referrals")
            .update({
              friend_reward_order_id: orderId,
              friend_reward_amount: FIXED_REWARD,
              friend_reward_issued_at: new Date().toISOString(),
            })
            .eq("id", id);

          const contactInfo = hasFriendEmail
            ? `<${referral.referred_email}>`
            : `SMS:${referral.referred_phone}`;
          console.log(
            `Friend reward issued: referral=${id} friend=${friendFirstName} ` +
            `${contactInfo} amount=${FIXED_REWARD} order=${orderId} via=${deliveryMethod}`
          );
        } catch (err) {
          friendRewardNote = `Friend reward failed: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`Friend reward failed for referral ${id}:`, err);
        }
      }
    }
  } else {
    friendRewardNote = "No email or phone on file for the friend — friend reward skipped";
  }

  return NextResponse.json({
    ok: true,
    syntheticInvoiceId,
    // Referrer reward
    referrerRewardAmount: result.rewardAmount,
    referrerRewardStatus: result.rewardStatus,
    referrerCharityAmount: result.charityAmount,
    // Friend reward
    friendRewardAmount,
    friendOrderId,
    friendRewardNote,
  });
}
