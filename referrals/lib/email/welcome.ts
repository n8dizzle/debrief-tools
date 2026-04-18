import { getResend, getFromAddress } from "./resend";
import { renderEmailLayout, escapeHtml } from "./layout";
import type { Referrer, Charity } from "@/lib/supabase";

interface WelcomeEmailOpts {
  referrer: Referrer;
  charity?: Charity | null;
  dashboardUrl: string;
}

export async function sendWelcomeEmail(opts: WelcomeEmailOpts): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping welcome email");
    return;
  }

  const { referrer, charity, dashboardUrl } = opts;
  const tripleWin = referrer.triple_win_enabled && charity;

  const bodyHtml = `
    <h1 style="margin:0 0 16px;color:#415440;font-family:Georgia,serif;font-style:italic;font-size:32px;line-height:1.15;">
      Welcome to the program, ${escapeHtml(referrer.first_name)}.
    </h1>
    <p>You're in. Here's your personal referral link — share it with anyone who could use a good neighbor:</p>
    <p style="margin:24px 0;padding:16px;background:#F5F2DC;border-radius:8px;font-family:monospace;font-size:15px;word-break:break-all;">
      <a href="${escapeHtml(referrer.referral_link)}" style="color:#415440;">${escapeHtml(referrer.referral_link)}</a>
    </p>
    ${
      tripleWin
        ? `<p style="margin:24px 0;padding:16px;background:rgba(97,139,96,0.1);border-left:3px solid #618B60;border-radius:4px;">
             <strong>Triple Win is on.</strong> Every successful referral also sends a donation to
             <strong>${escapeHtml(charity!.name)}</strong>. You keep your full reward — we match it.
           </p>`
        : `<p style="margin:16px 0;color:#415440;opacity:0.9;">
             Want to make it a Triple Win? Every successful referral could also trigger a donation to a charity you choose —
             at no cost to your reward. You can turn it on any time from your dashboard.
           </p>`
    }
    <p style="text-align:center;margin:32px 0;">
      <a href="${escapeHtml(dashboardUrl)}"
         style="display:inline-block;padding:12px 28px;background:#618B60;color:#F5F2DC;text-decoration:none;border-radius:8px;font-weight:600;">
        Go to your dashboard
      </a>
    </p>
    <p style="color:#415440;opacity:0.8;font-size:14px;">Questions? Just reply to this email.</p>
  `;

  await getResend().emails.send({
    from: getFromAddress(),
    to: referrer.email,
    subject: "You're in — here's your referral link",
    html: renderEmailLayout({
      preheader: `Your referral link is ready, ${referrer.first_name}. Share it any time.`,
      bodyHtml,
    }),
  });
}
