import { getResend, getFromAddress } from "./resend";
import { renderEmailLayout, escapeHtml } from "./layout";
import type { Referrer, Charity } from "@/lib/supabase";

const ADMIN_NOTIFY_EMAILS = ["janane@christmasair.com", "marketing@christmasair.com", "ethel@christmasair.com"];

interface NotifyNewReferrerOpts {
  referrer: Referrer;
  charity?: Charity | null;
  suggestedCharityName?: string | null;
  referralLink: string;
}

export async function notifyNewReferrerSignup(
  opts: NotifyNewReferrerOpts
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const { referrer, charity, suggestedCharityName, referralLink } = opts;

  const charityLine = charity
    ? `<strong>${escapeHtml(charity.name)}</strong>`
    : suggestedCharityName
    ? `<em>Suggested: ${escapeHtml(suggestedCharityName)}</em>`
    : `<em>None selected</em>`;

  const enrolledAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const bodyHtml = `
    <h1 style="margin:0 0 16px;color:#415440;font-family:Georgia,serif;font-style:italic;font-size:28px;line-height:1.2;">
      New referral sign-up 🎉
    </h1>
    <p style="margin:0 0 24px;">A customer just joined the referral program:</p>

    <table cellpadding="0" cellspacing="0" border="0" width="100%"
           style="border-collapse:collapse;font-size:15px;border:1px solid rgba(65,84,64,0.15);border-radius:8px;overflow:hidden;">
      <tr style="background:rgba(97,139,96,0.08);">
        <td style="padding:10px 16px;font-weight:600;width:38%;color:#415440;border-bottom:1px solid rgba(65,84,64,0.1);">Name</td>
        <td style="padding:10px 16px;border-bottom:1px solid rgba(65,84,64,0.1);">
          ${escapeHtml(referrer.first_name)} ${escapeHtml(referrer.last_name)}
        </td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-weight:600;color:#415440;border-bottom:1px solid rgba(65,84,64,0.1);">Email</td>
        <td style="padding:10px 16px;border-bottom:1px solid rgba(65,84,64,0.1);">
          <a href="mailto:${escapeHtml(referrer.email)}" style="color:#415440;">${escapeHtml(referrer.email)}</a>
        </td>
      </tr>
      <tr style="background:rgba(97,139,96,0.08);">
        <td style="padding:10px 16px;font-weight:600;color:#415440;border-bottom:1px solid rgba(65,84,64,0.1);">Phone</td>
        <td style="padding:10px 16px;border-bottom:1px solid rgba(65,84,64,0.1);">
          ${referrer.phone ? escapeHtml(referrer.phone) : "<em style='opacity:0.6'>—</em>"}
        </td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-weight:600;color:#415440;border-bottom:1px solid rgba(65,84,64,0.1);">Referral link</td>
        <td style="padding:10px 16px;border-bottom:1px solid rgba(65,84,64,0.1);font-family:monospace;font-size:13px;word-break:break-all;">
          <a href="${escapeHtml(referralLink)}" style="color:#415440;">${escapeHtml(referralLink)}</a>
        </td>
      </tr>
      <tr style="background:rgba(97,139,96,0.08);">
        <td style="padding:10px 16px;font-weight:600;color:#415440;border-bottom:1px solid rgba(65,84,64,0.1);">Charity</td>
        <td style="padding:10px 16px;border-bottom:1px solid rgba(65,84,64,0.1);">${charityLine}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-weight:600;color:#415440;">Enrolled</td>
        <td style="padding:10px 16px;">${escapeHtml(enrolledAt)} CT</td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-size:14px;opacity:0.7;">
      View all referrers at
      <a href="https://refer.christmasair.com/admin/referrers" style="color:#415440;">refer.christmasair.com/admin/referrers</a>
    </p>
  `;

  await getResend().emails.send({
    from: getFromAddress(),
    to: ADMIN_NOTIFY_EMAILS,
    subject: `New referral sign-up: ${referrer.first_name} ${referrer.last_name}`,
    html: renderEmailLayout({
      preheader: `${referrer.first_name} ${referrer.last_name} (${referrer.email}) just joined the referral program.`,
      bodyHtml,
    }),
  });
}
