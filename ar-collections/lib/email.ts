import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendEmail(to: string | string[], subject: string, html: string) {
  const client = getResend();
  const { data, error } = await client.emails.send({
    from: 'Christmas Air <noreply@christmasair.com>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }

  return data;
}

export function generateOwnerAssignmentEmail(opts: {
  assigneeName: string;
  assignerName: string;
  customerName: string;
  invoiceNumber: string;
  balance: number;
  daysOutstanding: number;
  invoiceUrl: string;
}): string {
  const { assigneeName, assignerName, customerName, invoiceNumber, balance, daysOutstanding, invoiceUrl } = opts;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <!-- Header -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #1C231E; border-radius: 12px 12px 0 0; padding: 24px;">
          <tr>
            <td>
              <h1 style="margin: 0; font-size: 18px; color: #F5F0E1;">Christmas Air</h1>
              <p style="margin: 4px 0 0; font-size: 13px; color: #6B9B75;">AR Collections</p>
            </td>
          </tr>
        </table>

        <!-- Body -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; padding: 24px; border-radius: 0 0 12px 12px;">
          <tr>
            <td>
              <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
                Hi ${assigneeName.split(' ')[0]}, you've been assigned an AR invoice by ${assignerName}.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
                <tr>
                  <td style="padding: 10px 14px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Customer</td>
                  <td style="padding: 10px 14px; font-size: 13px; color: #1f2937; text-align: right; border-bottom: 1px solid #e5e7eb;">${customerName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Invoice #</td>
                  <td style="padding: 10px 14px; font-size: 13px; color: #1f2937; text-align: right; border-bottom: 1px solid #e5e7eb;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Balance</td>
                  <td style="padding: 10px 14px; font-size: 13px; color: #1f2937; text-align: right; font-weight: 600; border-bottom: 1px solid #e5e7eb;">$${Number(balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-size: 13px; color: #6b7280;">Days Outstanding</td>
                  <td style="padding: 10px 14px; font-size: 13px; color: ${daysOutstanding > 90 ? '#ef4444' : daysOutstanding > 60 ? '#eab308' : '#1f2937'}; text-align: right; font-weight: 600;">${daysOutstanding}</td>
                </tr>
              </table>

              <a href="${invoiceUrl}" style="display: inline-block; background: #1C231E; color: #F5F0E1; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">View Invoice</a>

              <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">
                Sent via AR Collections
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
