/**
 * Quo (formerly OpenPhone) SMS utility - uses fetch (no SDK).
 * Copied verbatim from ap-payments/lib/quo.ts (send-only).
 * TODO (see repo TODOS.md): promote this into @christmas-air/shared once training is a 3rd+ consumer.
 * Docs: https://www.quo.com/docs/mdx/api-reference/messages/send-a-text-message
 */

const QUO_API_KEY = process.env.QUO_API_KEY || '';
// The Quo phone number to send from: E.164 (e.g. +15125551234) or a Quo phone-number id (PN...).
const QUO_FROM_NUMBER = process.env.QUO_FROM_NUMBER || '';
// Optional: the Quo user id to attribute outgoing messages to (some workspaces require it).
const QUO_USER_ID = process.env.QUO_USER_ID || '';

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
 * Send an SMS via the Quo REST API (from the configured workspace number).
 * Auth is the raw API key in the Authorization header (no "Bearer" prefix).
 */
export async function sendSMS(to: string, message: string): Promise<SendSMSResult> {
  if (!QUO_API_KEY || !QUO_FROM_NUMBER) {
    return { success: false, error: 'Quo not configured' };
  }

  const formattedTo = formatPhoneE164(to);
  if (!formattedTo) {
    return { success: false, error: `Invalid phone number: ${to}` };
  }

  try {
    const res = await fetch('https://api.quo.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': QUO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
        from: QUO_FROM_NUMBER,
        to: [formattedTo],
        ...(QUO_USER_ID ? { userId: QUO_USER_ID } : {}),
      }),
    });

    const data = await res.json().catch(() => ({} as Record<string, unknown>));

    if (!res.ok) {
      const err = data as { message?: string; error?: string };
      return { success: false, error: err.message || err.error || `Quo API error ${res.status}` };
    }

    const payload = data as { data?: { id?: string }; id?: string };
    return { success: true, messageId: payload.data?.id || payload.id || undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
