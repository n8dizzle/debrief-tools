import { getResend, getFromAddress } from "./resend";
import { renderEmailLayout, escapeHtml } from "./layout";

interface Opts {
  to: string;
  referrerFirstName: string;
  friendFirstName: string;
  dashboardUrl: string;
  tripleWinCharityName?: string | null;
}

export async function sendReferralSubmittedToReferrer(opts: Opts): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping referrer notification email");
    return;
  }

  const bodyHtml = `
    <h1 style="margin:0 0 16px;color:#415440;font-family:Georgia,serif;font-style:italic;font-size:32px;line-height:1.15;">
      Your referral is in.
    </h1>
    <p>Good news, ${escapeHtml(opts.referrerFirstName)} — <strong>${escapeHtml(opts.friendFirstName)}</strong> just requested a quote through your link. Our team will reach out to confirm the details and get them on the schedule.</p>

    <p style="margin:24px 0;padding:16px;background:rgba(97,139,96,0.08);border-left:3px solid #618B60;border-radius:4px;">
      Once ${escapeHtml(opts.friendFirstName)}&apos;s service is complete and paid, your gift card ships to your inbox. We&apos;ll send another email the moment it&apos;s on the way.
      ${
        opts.tripleWinCharityName
          ? `<br><br><strong>Triple Win:</strong> at the same time, we&apos;ll donate to <strong>${escapeHtml(opts.tripleWinCharityName)}</strong> in your honor.`
          : ""
      }
    </p>

    <p style="text-align:center;margin:32px 0;">
      <a href="${escapeHtml(opts.dashboardUrl)}"
         style="display:inline-block;padding:12px 28px;background:#618B60;color:#F5F2DC;text-decoration:none;border-radius:8px;font-weight:600;">
        See your dashboard
      </a>
    </p>

    <p style="color:#415440;opacity:0.8;font-size:14px;">
      Want to send more? Your link works as many times as you need it to.
    </p>
  `;

  await getResend().emails.send({
    from: getFromAddress(),
    to: opts.to,
    subject: `Thanks! ${opts.friendFirstName} just requested a quote through your link`,
    html: renderEmailLayout({
      preheader: `${opts.friendFirstName} just requested a quote through your referral link. Gift card ships after their service is complete and paid.`,
      bodyHtml,
    }),
  });
}
