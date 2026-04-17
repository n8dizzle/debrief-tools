import { getResend, getFromAddress } from "./resend";
import { renderEmailLayout, escapeHtml } from "./layout";

interface Opts {
  to: string;
  referrerFirstName: string;
  friendFirstName: string;
  rewardAmount: number;
  rewardLabel: string;
  pendingApproval: boolean;
  dashboardUrl: string;
  tripleWinCharityName?: string | null;
  charityAmount?: number | null;
}

export async function sendReferralCompletedEmail(opts: Opts): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping completed email");
    return;
  }

  const amountDisplay = `$${opts.rewardAmount.toFixed(0)}`;
  const heading = opts.pendingApproval
    ? "Your referral is in. Reward pending approval."
    : `Your ${amountDisplay} reward is on the way.`;

  const statusBlock = opts.pendingApproval
    ? `<p style="margin:24px 0;padding:16px;background:rgba(184,149,107,0.12);border-left:3px solid #8a6a3a;border-radius:4px;">
         This job requires a quick manual review before the reward is issued.
         We&apos;ll email you again the moment it&apos;s approved — usually within a business day.
       </p>`
    : `<p style="margin:24px 0;padding:16px;background:rgba(97,139,96,0.1);border-left:3px solid #618B60;border-radius:4px;">
         We&apos;re issuing your <strong>${amountDisplay} ${escapeHtml(opts.rewardLabel)}</strong> now. Expect it in your inbox within 24 hours.
       </p>`;

  const tripleWinBlock =
    opts.tripleWinCharityName && opts.charityAmount && opts.charityAmount > 0
      ? `<p style="margin:24px 0;padding:16px;background:#F5F2DC;border-radius:8px;">
           <strong>Triple Win:</strong> we&apos;re also donating
           <strong>$${opts.charityAmount.toFixed(0)}</strong> to
           <strong>${escapeHtml(opts.tripleWinCharityName)}</strong> in your honor.
           Thanks for making this a neighborhood effort.
         </p>`
      : "";

  const bodyHtml = `
    <h1 style="margin:0 0 16px;color:#415440;font-family:Georgia,serif;font-style:italic;font-size:32px;line-height:1.15;">
      ${escapeHtml(heading)}
    </h1>
    <p>Great news, ${escapeHtml(opts.referrerFirstName)} — <strong>${escapeHtml(opts.friendFirstName)}</strong>&apos;s job is complete. Because you sent them our way, they&apos;re taken care of and you&apos;re getting a thank-you.</p>
    ${statusBlock}
    ${tripleWinBlock}
    <p style="text-align:center;margin:32px 0;">
      <a href="${escapeHtml(opts.dashboardUrl)}"
         style="display:inline-block;padding:12px 28px;background:#618B60;color:#F5F2DC;text-decoration:none;border-radius:8px;font-weight:600;">
        See your dashboard
      </a>
    </p>
    <p style="color:#415440;opacity:0.8;font-size:14px;">Got more neighbors in mind? Your link never expires.</p>
  `;

  await getResend().emails.send({
    from: getFromAddress(),
    to: opts.to,
    subject: opts.pendingApproval
      ? "Referral complete — reward pending approval"
      : `You earned ${amountDisplay} — ${opts.friendFirstName}'s job is done`,
    html: renderEmailLayout({
      preheader: opts.pendingApproval
        ? "Your referral converted. Quick approval review, then the reward is on the way."
        : `Your ${amountDisplay} reward is being issued now.`,
      bodyHtml,
    }),
  });
}
