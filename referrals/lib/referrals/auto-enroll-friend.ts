import { getServerSupabase } from "@/lib/supabase";
import { generateReferralCode } from "@/lib/referral-codes";
import { assignRewardConfig } from "@/lib/assign-reward-config";
import { sendWelcomeEmail } from "@/lib/email/welcome";
import { notifyNewReferrerSignup } from "@/lib/email/notify-new-referrer";
import { issueMagicLinkToken } from "@/lib/customer-auth";
import type { Referrer } from "@/lib/supabase";

const APP_URL = process.env.NEXTAUTH_URL || "https://refer.christmasair.com";

/**
 * Auto-enroll a referred friend as a referrer so they get their own
 * unique link and code the moment they're referred.
 *
 * Silently skips if:
 *  - No email on the referral (can't send dashboard link or look up account)
 *  - They're already enrolled (idempotent)
 *  - Any unexpected DB error (never blocks the referral itself)
 *
 * Called fire-and-forget from the referral submission route.
 */
export async function autoEnrollFriend(opts: {
  referredName: string;
  referredEmail: string;
  referredPhone: string | null;
}): Promise<void> {
  const { referredName, referredEmail, referredPhone } = opts;
  const email = referredEmail.toLowerCase();
  const supabase = getServerSupabase();

  // Already enrolled? Nothing to do.
  const { data: existing } = await supabase
    .from("ref_referrers")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) return;

  // Parse first / last name from full name
  const parts = referredName.trim().split(/\s+/);
  const firstName = parts[0] || referredName;
  const lastName = parts.slice(1).join(" ") || "";

  const assignedRewardConfigId = await assignRewardConfig();
  const referralCode = await generateReferralCode(firstName);
  const referralLink = `${APP_URL}/refer/${referralCode}`;

  const { data: inserted, error } = await supabase
    .from("ref_referrers")
    .insert({
      email,
      phone: referredPhone,
      first_name: firstName,
      last_name: lastName,
      referral_code: referralCode,
      referral_link: referralLink,
      reward_preference: "VISA_GIFT_CARD",
      assigned_reward_config_id: assignedRewardConfigId,
      selected_charity_id: null,
      suggested_charity_name: null,
    })
    .select("*")
    .single();

  if (error || !inserted) {
    // Unique violation = already enrolled (race), anything else is unexpected
    if (error?.code !== "23505") {
      console.error("autoEnrollFriend: insert failed", error);
    }
    return;
  }

  const referrer = inserted as Referrer;

  // Generate a magic link so their welcome email has a one-click dashboard link
  try {
    const token = await issueMagicLinkToken(referrer.id);
    const dashboardUrl = `${APP_URL}/api/auth/customer/callback?token=${encodeURIComponent(token)}`;

    await Promise.all([
      sendWelcomeEmail({ referrer, charity: null, dashboardUrl, autoEnrolled: true }).catch((err) =>
        console.error("autoEnrollFriend: welcome email failed", err)
      ),
      notifyNewReferrerSignup({
        referrer,
        charity: null,
        suggestedCharityName: null,
        referralLink,
      }).catch((err) =>
        console.error("autoEnrollFriend: admin notify failed", err)
      ),
    ]);
  } catch (err) {
    console.error("autoEnrollFriend: post-insert steps failed", err);
  }
}
