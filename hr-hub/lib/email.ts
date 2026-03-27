/**
 * Email utility using Resend API (no SDK, just fetch)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = 'Christmas Air HR <hr@christmasair.com>';

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.message || `Resend error: ${res.status}` };
    }

    return { success: true, id: data.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
