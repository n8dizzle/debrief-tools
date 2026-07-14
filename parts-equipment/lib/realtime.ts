// Lightweight, server-side realtime signalling for board collaboration.
// We broadcast ONLY a "something changed" ping (no order data) to a public
// Supabase Realtime channel; clients hear it and refetch through the
// authenticated app API. Sensitive data never rides the channel.
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const PE_CHANGES_TOPIC = 'pe-changes';

/**
 * Fire-and-forget broadcast of a change ping. Never throws — a realtime hiccup
 * must not break the write that triggered it.
 * @param payload minimal metadata only (e.g. { source, board, id }) — no PII.
 */
export async function broadcastChange(payload: Record<string, unknown> = {}): Promise<void> {
  if (!URL_BASE || !KEY) return;
  try {
    await fetch(`${URL_BASE}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        messages: [{ topic: PE_CHANGES_TOPIC, event: 'change', payload }],
      }),
    });
  } catch (e) {
    console.error('realtime broadcast failed:', e);
  }
}
