import { getResend, getFromAddress } from "./resend";
import { renderEmailLayout, escapeHtml } from "./layout";
import type { Referrer } from "@/lib/supabase";

interface AnnouncementEmailOpts {
  referrer: Referrer;
  dashboardUrl: string;
}

/**
 * One-time announcement email sent to referrers who haven't picked a charity
 * since the Triple Win restructure (global admin toggle instead of per-user
 * opt-in). Batched from /admin/settings and gated on
 * ref_referrers.triple_win_announcement_sent_at so accidental re-sends
 * skip already-notified users.
 */
export async function sendTripleWinAnnouncementEmail(
  opts: AnnouncementEmailOpts
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not set");
  }

  const { referrer, dashboardUrl } = opts;
  const bodyHtml = `
    <h1 style="margin:0 0 16px;color:#415440;font-family:Georgia,serif;font-style:italic;font-size:28px;line-height:1.2;">
      Pick a charity, and every referral gives back.
    </h1>
    <p>Hi ${escapeHtml(referrer.first_name)},</p>
    <p>
      A quick update on the Neighbors Helping Neighbors program: <strong>Triple Win is now
      automatic</strong>. Every successful referral triggers a donation from
      Christmas Air to a charity you pick — at no cost to your gift card.
    </p>
    <p>
      You haven&apos;t picked a charity yet. Take 30 seconds to choose one, and your
      next referral will also send a donation to the cause you care about.
      Your full gift card stays yours. The donation is on us.
    </p>
    <p style="text-align:center;margin:32px 0;">
      <a href="${escapeHtml(dashboardUrl)}"
         style="display:inline-block;padding:14px 32px;background:#618B60;color:#F5F2DC;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">
        Pick your charity
      </a>
    </p>
    <p style="color:#415440;opacity:0.85;font-size:14px;">
      You can change your pick any time from your dashboard. The charity is locked in
      for each referral at submission, so changing your choice doesn&apos;t disturb
      referrals already in flight.
    </p>
    <p style="color:#415440;opacity:0.75;font-size:13px;margin-top:24px;">
      Questions? Just reply to this email — or call us at (469) 214-2013.
    </p>
  `;

  await getResend().emails.send({
    from: getFromAddress(),
    to: referrer.email,
    subject: "Triple Win is now automatic — pick your charity",
    html: renderEmailLayout({
      preheader: `Pick a charity so your referrals also send a donation, ${referrer.first_name}.`,
      bodyHtml,
    }),
  });
}
