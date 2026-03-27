import crypto from 'crypto';
import { emojify } from 'node-emoji';

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

  const a = Buffer.from(mySignature);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
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
  if (!SLACK_BOT_TOKEN) {
    console.error('downloadSlackFile: SLACK_BOT_TOKEN is not set');
    return null;
  }

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    });

    if (!res.ok) {
      console.error(`downloadSlackFile: Failed to download ${url} - ${res.status} ${res.statusText}`);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error('downloadSlackFile: Error downloading file:', err);
    return null;
  }
}

/**
 * Fetch reactions on a Slack message
 */
export async function getSlackReactions(
  channel: string,
  timestamp: string
): Promise<{ name: string; count: number }[]> {
  if (!SLACK_BOT_TOKEN) return [];

  const url = new URL('https://slack.com/api/reactions.get');
  url.searchParams.set('channel', channel);
  url.searchParams.set('timestamp', timestamp);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
  });

  if (!res.ok) return [];
  const data = await res.json();
  if (!data.ok) return [];

  return (data.message?.reactions || []).map((r: any) => ({
    name: r.name,
    count: r.count,
  }));
}

/**
 * Check if a Slack message should be imported based on filters.
 * Runs cheap checks first (media, keywords), returns 'needs_reactions'
 * if reaction filter needs to be checked separately (expensive API call).
 */
export function shouldImportMessage(
  msg: { text?: string; files?: any[] },
  filters: { media_only?: boolean; keywords_include?: string[]; keywords_exclude?: string[] }
): boolean | 'needs_reactions' {
  const hasMedia = (msg.files && msg.files.length > 0) ||
    (msg.text && /https:\/\/media\d*\.giphy\.com\/media\/[^\s>]+/.test(msg.text));

  // Media-only filter
  if (filters.media_only && !hasMedia) return false;

  const textLower = (msg.text || '').toLowerCase();

  // Keyword exclude
  if (filters.keywords_exclude?.length) {
    if (filters.keywords_exclude.some((kw) => textLower.includes(kw.toLowerCase()))) return false;
  }

  // Keyword include
  if (filters.keywords_include?.length) {
    if (!filters.keywords_include.some((kw) => textLower.includes(kw.toLowerCase()))) return false;
  }

  return true;
}

/**
 * Check if a message passes the reaction filter (requires API call per message)
 */
export async function passesReactionFilter(
  channel: string,
  timestamp: string,
  filters: { min_reactions?: number; reaction_emojis?: string[] }
): Promise<boolean> {
  if (!filters.min_reactions && !filters.reaction_emojis?.length) return true;

  const reactions = await getSlackReactions(channel, timestamp);
  const totalCount = reactions.reduce((sum, r) => sum + r.count, 0);

  if (filters.min_reactions && totalCount < filters.min_reactions) return false;

  if (filters.reaction_emojis?.length) {
    const hasMatchingEmoji = reactions.some((r) =>
      filters.reaction_emojis!.includes(r.name)
    );
    if (!hasMatchingEmoji) return false;
  }

  return true;
}

// Cache user names during a backfill run to avoid repeated API calls
const userNameCache = new Map<string, string>();

/**
 * Map Slack CLDR emoji names to their unicode characters.
 * node-emoji doesn't recognize many Slack-specific names.
 */
const SLACK_EMOJI_ALIASES: Record<string, string> = {
  // Face emojis (Slack CLDR name → unicode)
  face_vomiting: '🤮',
  partying_face: '🥳',
  face_with_raised_eyebrow: '🤨',
  shushing_face: '🤫',
  zany_face: '🤪',
  face_with_hand_over_mouth: '🤭',
  face_with_monocle: '🧐',
  pleading_face: '🥺',
  face_holding_back_tears: '🥹',
  melting_face: '🫠',
  saluting_face: '🫡',
  smiling_face_with_tear: '🥲',
  disguised_face: '🥸',
  face_in_clouds: '😶‍🌫️',
  face_exhaling: '😮‍💨',
  face_with_spiral_eyes: '😵‍💫',
  face_with_peeking_eye: '🫣',
  // Hand/gesture emojis
  thumbsup: '👍',
  thumbsdown: '👎',
  clapping_hands: '👏',
  raised_hands: '🙌',
  folded_hands: '🙏',
  handshake: '🤝',
  pinching_hand: '🤏',
  pinched_fingers: '🤌',
  // Heart variants
  white_heart: '🤍',
  brown_heart: '🤎',
  mending_heart: '❤️‍🩹',
  heart_on_fire: '❤️‍🔥',
  // Misc
  large_blue_diamond: '🔷',
  large_orange_diamond: '🔶',
  slightly_smiling_face: '🙂',
  upside_down_face: '🙃',
  hot_face: '🥵',
  cold_face: '🥶',
  woozy_face: '🥴',
  yawning_face: '🥱',
  // Common Slack-specific names that map to node-emoji differently
  simple_smile: '🙂',
  // Skin tone variants - just show base emoji
  '+1::skin-tone-2': '👍',
  '+1::skin-tone-3': '👍',
  '+1::skin-tone-4': '👍',
  '+1::skin-tone-5': '👍',
  '+1::skin-tone-6': '👍',
};

/**
 * Format Slack message text for display:
 * - <@U04RGMSE2LF> → @Real Name
 * - :tada: → actual emoji unicode
 * - <#C12345|channel-name> → #channel-name
 * - <https://url|display text> → display text
 * - <!subteam^S123|@team> → @team
 */
export async function formatSlackText(text: string): Promise<string> {
  if (!text) return text;

  let formatted = text;

  // 1. Resolve user mentions: <@U04RGMSE2LF> → @Real Name
  const userMentionRegex = /<@(U[A-Z0-9]+)(?:\|([^>]+))?>/g;
  const userMatches = [...formatted.matchAll(userMentionRegex)];
  for (const match of userMatches) {
    const userId = match[1]!;
    const fallback = match[2];
    let displayName = userNameCache.get(userId);
    if (!displayName) {
      const user = await getSlackUser(userId);
      displayName = user?.name ?? fallback ?? userId;
      userNameCache.set(userId, displayName as string);
    }
    formatted = formatted.replace(match[0], `@${displayName}`);
  }

  // 2. Channel mentions: <#C12345|channel-name> → #channel-name
  formatted = formatted.replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1');
  // Channel mentions without display name
  formatted = formatted.replace(/<#([A-Z0-9]+)>/g, '#channel');

  // 3. Group/special mentions: <!subteam^S123|@team> → @team, <!here>, <!channel>, <!everyone>
  formatted = formatted.replace(/<!subteam\^[A-Z0-9]+\|(@[^>]+)>/g, '$1');
  formatted = formatted.replace(/<!here>/g, '@here');
  formatted = formatted.replace(/<!channel>/g, '@channel');
  formatted = formatted.replace(/<!everyone>/g, '@everyone');

  // 4. URLs: <https://url|display text> → display text, <https://url> → url
  formatted = formatted.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2');
  formatted = formatted.replace(/<(https?:\/\/[^>]+)>/g, '$1');

  // 5. Emoji shortcodes: :tada: → unicode emoji
  // Map Slack CLDR names that node-emoji doesn't recognize
  formatted = formatted.replace(/:([a-z0-9_+-]+):/g, (match, name) => {
    const alias = SLACK_EMOJI_ALIASES[name];
    if (alias) return alias;
    return match;
  });
  formatted = emojify(formatted);

  return formatted;
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
