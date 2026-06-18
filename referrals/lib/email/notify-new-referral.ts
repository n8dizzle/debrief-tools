import { getResend, getFromAddress } from "./resend";
import { renderEmailLayout, escapeHtml } from "./layout";

const ADMIN_NOTIFY_EMAILS = ["janane@christmasair.com", "marketing@christmasair.com", "ethel@christmasair.com"];

interface NotifyNewReferralOpts {
  referrerName: string;
  friendName: string;
  friendEmail: string | null;
  friendPhone: string | null;
  serviceType: string;
  notes: string | null;
}

export async function notifyNewReferralSubmitted(
  opts: NotifyNewReferralOpts
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const { referrerName, friendName, friendEmail, friendPhone, serviceType, notes } = opts;

  const submittedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const serviceLabel: Record<string, string> = {
    HVAC: "HVAC",
    PLUMBING: "Plumbing",
    WATER_HEATER: "Water Heater",
    COMMERCIAL: "Commercial",
    NOT_SURE: "Not sure yet",
  };

  const bodyHtml = `
    <h1 style="margin:0 0 16px;color:#415440;font-family:Georgia,serif;font-style:italic;font-size:28px;line-height:1.2;">
      New referral submitted 🎉
    </h1>
    <p style="margin:0 0 24px;"><strong>${escapeHtml(referrerName)}</strong> just referred a friend:</p>

    <table cellpadding="0" cellspacing="0" border="0" width="100%"
           style="border-collapse:collapse;font-size:15px;border:1px solid rgba(65,84,64,0.15);border-radius:8px;overflow:hidden;">
      <tr style="background:rgba(97,139,96,0.08);">
        <td style="padding:10px 16px;font-weight:600;width:38%;color:#415440;border-bottom:1px solid rgba(65,84,64,0.1);">Friend's name</td>
        <td style="padding:10px 16px;border-bottom:1px solid rgba(65,84,64,0.1);">${escapeHtml(friendName)}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-weight:600;color:#415440;border-bottom:1px solid rgba(65,84,64,0.1);">Email</td>
        <td style="padding:10px 16px;border-bottom:1px solid rgba(65,84,64,0.1);">
          ${friendEmail
            ? `<a href="mailto:${escapeHtml(friendEmail)}" style="color:#415440;">${escapeHtml(friendEmail)}</a>`
            : `<em style="opacity:0.6">—</em>`}
        </td>
      </tr>
      <tr style="background:rgba(97,139,96,0.08);">
        <td style="padding:10px 16px;font-weight:600;color:#415440;border-bottom:1px solid rgba(65,84,64,0.1);">Phone</td>
        <td style="padding:10px 16px;border-bottom:1px solid rgba(65,84,64,0.1);">
          ${friendPhone ? escapeHtml(friendPhone) : `<em style="opacity:0.6">—</em>`}
        </td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-weight:600;color:#415440;border-bottom:1px solid rgba(65,84,64,0.1);">Service</td>
        <td style="padding:10px 16px;border-bottom:1px solid rgba(65,84,64,0.1);">${escapeHtml(serviceLabel[serviceType] ?? serviceType)}</td>
      </tr>
      <tr style="background:rgba(97,139,96,0.08);">
        <td style="padding:10px 16px;font-weight:600;color:#415440;border-bottom:1px solid rgba(65,84,64,0.1);">Referred by</td>
        <td style="padding:10px 16px;border-bottom:1px solid rgba(65,84,64,0.1);">${escapeHtml(referrerName)}</td>
      </tr>
      ${notes ? `
      <tr>
        <td style="padding:10px 16px;font-weight:600;color:#415440;border-bottom:1px solid rgba(65,84,64,0.1);">Notes</td>
        <td style="padding:10px 16px;border-bottom:1px solid rgba(65,84,64,0.1);">${escapeHtml(notes)}</td>
      </tr>` : ""}
      <tr${notes ? "" : ` style="background:rgba(97,139,96,0.08);"`}>
        <td style="padding:10px 16px;font-weight:600;color:#415440;">Submitted</td>
        <td style="padding:10px 16px;">${escapeHtml(submittedAt)} CT</td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-size:14px;opacity:0.7;">
      View all referrals at
      <a href="https://refer.christmasair.com/admin/referrals" style="color:#415440;">refer.christmasair.com/admin/referrals</a>
    </p>
  `;

  await getResend().emails.send({
    from: getFromAddress(),
    to: ADMIN_NOTIFY_EMAILS,
    subject: `New lead referral: ${friendName} (referred by ${referrerName})`,
    html: renderEmailLayout({
      preheader: `${referrerName} referred ${friendName} for ${serviceLabel[serviceType] ?? serviceType}.`,
      bodyHtml,
    }),
  });
}
