import crypto from 'crypto';

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';

/**
 * Verify Slack request signature (HMAC-SHA256)
 */
export function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  if (!SLACK_SIGNING_SECRET) return false;

  // Prevent replay attacks (5 min window)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', SLACK_SIGNING_SECRET);
  hmac.update(sigBasestring);
  const mySignature = `v0=${hmac.digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature)
  );
}

/**
 * Fetch Slack user info
 */
export async function getSlackUser(userId: string) {
  if (!SLACK_BOT_TOKEN) return null;

  const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data.ok) return null;

  return {
    name: data.user.real_name || data.user.name,
    avatar: data.user.profile?.image_72 || null,
    email: data.user.profile?.email || null,
  };
}

/**
 * Download a file from Slack (requires bot token for auth)
 */
export async function downloadSlackFile(url: string): Promise<Buffer | null> {
  if (!SLACK_BOT_TOKEN) return null;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
  });

  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Post a thread reply in Slack
 */
export async function postSlackReply(channel: string, threadTs: string, text: string) {
  if (!SLACK_BOT_TOKEN) return;

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      thread_ts: threadTs,
      text,
    }),
  });
}
