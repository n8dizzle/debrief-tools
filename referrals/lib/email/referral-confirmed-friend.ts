import { getResend, getFromAddress } from "./resend";
import { renderEmailLayout, escapeHtml } from "./layout";

interface Opts {
  to: string;
  friendFirstName: string;
  referrerFirstName: string;
  tripleWinCharityName?: string | null;
  refereeDiscountLabel: string;
}

export async function sendReferralConfirmedToFriend(opts: Opts): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping friend confirmation email");
    return;
  }

  const bodyHtml = `
    <h1 style="margin:0 0 16px;color:#415440;font-family:Georgia,serif;font-style:italic;font-size:32px;line-height:1.15;">
      Got it, ${escapeHtml(opts.friendFirstName)}.
    </h1>
    <p>Thanks for reaching out through ${escapeHtml(opts.referrerFirstName)}. We&apos;ll be in touch shortly to schedule your service.</p>

    <p style="margin:24px 0;padding:16px;background:rgba(97,139,96,0.08);border-left:3px solid #618B60;border-radius:4px;">
      <strong>As a neighbor referral, you&apos;ll get:</strong> ${escapeHtml(opts.refereeDiscountLabel)}. No code needed — it&apos;s already on your account.
    </p>

    ${
      opts.tripleWinCharityName
        ? `<p style="margin:24px 0;padding:16px;background:#F5F2DC;border-radius:8px;">
             When your service is complete, we&apos;ll also make a donation to
             <strong>${escapeHtml(opts.tripleWinCharityName)}</strong> in ${escapeHtml(opts.referrerFirstName)}&apos;s honor.
             You save, ${escapeHtml(opts.referrerFirstName)} gets thanked, and a cause in our community gets help. That&apos;s Triple Win.
           </p>`
        : ""
    }

    <p>A Christmas Air team member will call or text within one business day. If you need us sooner, call <strong>(469) 214-2013</strong>.</p>

    <p style="margin-top:32px;color:#415440;">
      Welcome to the neighborhood,<br>
      <em style="font-family:Georgia,serif;">The Christmas Air team</em>
    </p>
  `;

  await getResend().emails.send({
    from: getFromAddress(),
    to: opts.to,
    subject: `${opts.referrerFirstName} sent us your way — we'll be in touch`,
    html: renderEmailLayout({
      preheader: `Thanks for the referral from ${opts.referrerFirstName}. A Christmas Air team member will reach out within one business day.`,
      bodyHtml,
    }),
  });
}
