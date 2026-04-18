import { getResend, getFromAddress } from "./resend";
import { renderEmailLayout, escapeHtml } from "./layout";

interface MagicLinkEmailOpts {
  to: string;
  firstName: string;
  loginUrl: string;
}

export async function sendMagicLinkEmail(opts: MagicLinkEmailOpts): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping magic link email");
    console.log(`[dev] Magic link for ${opts.to}: ${opts.loginUrl}`);
    return;
  }

  const bodyHtml = `
    <h1 style="margin:0 0 16px;color:#415440;font-family:Georgia,serif;font-style:italic;font-size:32px;line-height:1.15;">
      Welcome back, ${escapeHtml(opts.firstName)}.
    </h1>
    <p>Click below to open your dashboard. This link works once and expires in 15 minutes.</p>
    <p style="text-align:center;margin:32px 0;">
      <a href="${escapeHtml(opts.loginUrl)}"
         style="display:inline-block;padding:14px 32px;background:#618B60;color:#F5F2DC;text-decoration:none;border-radius:8px;font-weight:600;">
        Open my dashboard
      </a>
    </p>
    <p style="color:#415440;opacity:0.8;font-size:13px;">
      Didn't request this? You can ignore the email — no action will be taken.
    </p>
  `;

  await getResend().emails.send({
    from: getFromAddress(),
    to: opts.to,
    subject: "Your Christmas Air referral dashboard",
    html: renderEmailLayout({
      preheader: "Sign in to your Christmas Air referral dashboard.",
      bodyHtml,
    }),
  });
}
