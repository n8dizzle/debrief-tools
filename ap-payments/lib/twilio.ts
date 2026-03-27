/**
 * Dialpad SMS utility - uses fetch (no SDK)
 */

const DIALPAD_API_KEY = process.env.DIALPAD_API_KEY || '';
const DIALPAD_FROM_NUMBER = process.env.DIALPAD_FROM_NUMBER || '';
const DIALPAD_OFFICE_ID = '5740625455751168';

/**
 * Format a phone number to E.164 format (+1XXXXXXXXXX)
 */
export function formatPhoneE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an SMS via Dialpad REST API (from main office line)
 */
export async function sendSMS(to: string, message: string): Promise<SendSMSResult> {
  if (!DIALPAD_API_KEY || !DIALPAD_FROM_NUMBER) {
    return { success: false, error: 'Dialpad not configured' };
  }

  const formattedTo = formatPhoneE164(to);
  if (!formattedTo) {
    return { success: false, error: `Invalid phone number: ${to}` };
  }

  try {
    const res = await fetch('https://dialpad.com/api/v2/sms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIALPAD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to_numbers: [formattedTo],
        sender_group_id: DIALPAD_OFFICE_ID,
        sender_group_type: 'office',
        infer_country_code: true,
        text: message,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.message || data.error || JSON.stringify(data) };
    }

    return { success: true, messageId: data.request_id || data.id || undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
