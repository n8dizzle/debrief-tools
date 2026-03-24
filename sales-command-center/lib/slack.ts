import { SlackBlock } from '@/types';

// ============================================================================
// Slack DM-Based Lead Notification System
//
// NOTIFICATION FLOW:
//   Lead detected → Round robin assigns → DB write + audit log
//                                             ↓
//                         ┌──────────────────────────────────────┐
//                         │  TEST_MODE=true?                     │
//                         │  Y → DM to TEST_DM_EMAILS only      │
//                         │  N → DM to actual advisor            │
//                         └──────────┬───────────────────────────┘
//                                    ↓
//                         sendDMByEmail(email, blocks)
//                                    ↓
//                         success? → log "sent"
//                         fail?    → log "failed", surface in admin
//
// KEY RULES:
// - Advisors only see THEIR OWN leads via DM. Never shared channels.
// - No "NEXT IN LINE" in any notification. Nobody sees the queue.
// - Each lead gets exactly ONE DM to the advisor (dm_sent_at guard).
// - Empty queue → DM Scott once (scott_notified_at guard).
// ============================================================================

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const TEST_MODE = process.env.TEST_MODE === 'true';
const TEST_DM_EMAILS = (process.env.TEST_DM_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

/**
 * Check if Slack DMs are configured (requires bot token)
 */
export function isSlackConfigured(): boolean {
  return Boolean(SLACK_BOT_TOKEN);
}

/**
 * Post a message to a Slack channel or DM by channel ID
 */
export async function postToSlack(payload: {
  channel: string;
  text: string;
  blocks?: SlackBlock[];
}): Promise<{ ok: boolean; error?: string }> {
  if (!SLACK_BOT_TOKEN) {
    console.warn('Slack not configured: SLACK_BOT_TOKEN missing');
    return { ok: false, error: 'Slack not configured' };
  }

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Slack API error:', data.error);
      return { ok: false, error: data.error };
    }

    return { ok: true };
  } catch (error) {
    console.error('Failed to post to Slack:', error);
    return { ok: false, error: String(error) };
  }
}

/**
 * Send a DM to a user by their email address.
 * In TEST_MODE, redirects all DMs to TEST_DM_EMAILS.
 */
export async function sendDMByEmail(
  email: string,
  text: string,
  blocks?: SlackBlock[]
): Promise<{ ok: boolean; error?: string }> {
  if (!SLACK_BOT_TOKEN) {
    console.warn('Slack not configured: SLACK_BOT_TOKEN missing');
    return { ok: false, error: 'Slack not configured' };
  }

  // TEST_MODE safety: redirect all DMs to test recipients
  const targetEmail = TEST_MODE ? (TEST_DM_EMAILS[0] || ADMIN_EMAIL) : email;
  if (!targetEmail) {
    return { ok: false, error: 'No target email for DM' };
  }

  // In test mode, prefix message so testers know who WOULD have received it
  const prefixedText = TEST_MODE
    ? `[TEST MODE - would DM: ${email}]\n\n${text}`
    : text;

  try {
    // Look up user by email
    const userResponse = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(targetEmail)}`,
      {
        headers: { 'Authorization': `Bearer ${SLACK_BOT_TOKEN}` },
      }
    );

    const userData = await userResponse.json();
    if (!userData.ok) {
      console.warn(`Could not find Slack user for email ${targetEmail}:`, userData.error);
      return { ok: false, error: `User not found: ${userData.error}` };
    }

    // Open DM channel
    const imResponse = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ users: userData.user.id }),
    });

    const imData = await imResponse.json();
    if (!imData.ok) {
      console.error('Failed to open DM channel:', imData.error);
      return { ok: false, error: imData.error };
    }

    // Send the message
    return postToSlack({
      channel: imData.channel.id,
      text: prefixedText,
      blocks: TEST_MODE ? undefined : blocks, // Skip fancy blocks in test mode for clarity
    });
  } catch (error) {
    console.error('Failed to send DM:', error);
    return { ok: false, error: String(error) };
  }
}

// Get the Service Titan job URL
function getServiceTitanJobUrl(jobId: string): string {
  const baseUrl = process.env.SERVICE_TITAN_WEB_URL || 'https://go.servicetitan.com';
  return `${baseUrl}/#/Job/${jobId}`;
}

/**
 * Lead notification payload — used for both Marketed and TGL
 */
export interface LeadNotification {
  jobId: string;
  jobNumber: string;
  leadType: 'Marketed' | 'TGL';
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  scheduledDate?: string;
  leadId?: string;
  techName?: string;
  advisor: {
    name: string;
    email: string;
    phone?: string;
  };
}

/**
 * Send a lead assignment DM to the assigned advisor.
 * No "next in line" info — advisors only see their own lead.
 */
export async function sendLeadAssignmentDM(
  lead: LeadNotification
): Promise<{ ok: boolean; error?: string }> {
  const stUrl = getServiceTitanJobUrl(lead.jobId);
  const isMarketedLead = lead.leadType === 'Marketed';

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: isMarketedLead ? 'New Marketed Lead Assigned to You' : 'New TGL Assigned to You',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Customer:*\n${lead.customerName}` },
        { type: 'mrkdwn', text: `*Job #:*\n${lead.jobNumber}` },
      ],
    },
  ];

  // Tech name for TGLs
  if (!isMarketedLead && lead.techName) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Generated by:* ${lead.techName}` },
    });
  }

  // Phone and scheduled date
  const detailFields: { type: 'mrkdwn'; text: string }[] = [];
  if (lead.customerPhone) {
    detailFields.push({ type: 'mrkdwn', text: `*Phone:*\n${lead.customerPhone}` });
  }
  if (lead.scheduledDate) {
    detailFields.push({
      type: 'mrkdwn',
      text: `*Scheduled:*\n${new Date(lead.scheduledDate).toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })}`,
    });
  }
  if (detailFields.length > 0) {
    blocks.push({ type: 'section', fields: detailFields });
  }

  // Address
  if (lead.customerAddress) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Address:*\n${lead.customerAddress}` },
    });
  }

  // Action button — open in Service Titan
  blocks.push({ type: 'divider' } as any);
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Open in Service Titan', emoji: true },
        url: stUrl,
        action_id: 'open_servicetitan',
        style: 'primary',
      },
    ],
  } as any);

  const text = `New ${lead.leadType} lead assigned to you: ${lead.customerName} (Job #${lead.jobNumber})`;

  return sendDMByEmail(lead.advisor.email, text, blocks);
}

/**
 * Send a TGL confirmation DM to the tech who submitted it.
 * "Your TGL was assigned to [Brett]. He'll reach out to the customer."
 */
export async function sendTechConfirmationDM(
  techEmail: string,
  advisorName: string,
  customerName: string,
  jobNumber: string
): Promise<{ ok: boolean; error?: string }> {
  const text = [
    `Your TGL for *${customerName}* (Job #${jobNumber}) has been assigned to *${advisorName}*.`,
    `They'll reach out to the customer.`,
  ].join('\n');

  return sendDMByEmail(techEmail, text);
}

/**
 * Send an admin alert when no advisors are in the queue.
 * Only call this once per lead (check scott_notified_at before calling).
 */
export async function sendEmptyQueueAlert(
  customerName: string,
  jobNumber: string,
  leadType: 'Marketed' | 'TGL'
): Promise<{ ok: boolean; error?: string }> {
  if (!ADMIN_EMAIL) {
    console.warn('ADMIN_EMAIL not configured — cannot send empty queue alert');
    return { ok: false, error: 'ADMIN_EMAIL not configured' };
  }

  const text = [
    `*No comfort advisors in queue!*`,
    ``,
    `A new ${leadType} lead came in but no advisors are available:`,
    `- Customer: ${customerName}`,
    `- Job #: ${jobNumber}`,
    ``,
    `The lead is held as "New Lead" in the pool. Toggle an advisor back into the queue to resume assignments.`,
  ].join('\n');

  return sendDMByEmail(ADMIN_EMAIL, text);
}

/**
 * Verify Slack request signature for webhook security
 */
export async function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string
): Promise<boolean> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!signingSecret) {
    console.warn('SLACK_SIGNING_SECRET not configured');
    return false;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    console.warn('Slack request timestamp too old');
    return false;
  }

  const sigBaseString = `v0:${timestamp}:${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(sigBaseString));
  const computedSignature = 'v0=' + Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedSignature === signature;
}
