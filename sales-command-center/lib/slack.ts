import { Lead, ComfortAdvisor, SlackMessage, SlackBlock } from '@/types';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const SLACK_TGL_WEBHOOK_URL = process.env.SLACK_TGL_WEBHOOK_URL;
const SLACK_LEADS_CHANNEL = process.env.SLACK_LEADS_CHANNEL || '#marketed-leads';

/**
 * Check if Slack is configured (via bot token or webhook)
 */
export function isSlackConfigured(): boolean {
  return Boolean(SLACK_BOT_TOKEN) || Boolean(SLACK_WEBHOOK_URL);
}

/**
 * Get the webhook URL
 */
export function getSlackWebhookUrl(): string | null {
  return SLACK_WEBHOOK_URL || null;
}

/**
 * Send a message via a specific Slack Incoming Webhook URL
 */
export async function sendViaWebhookUrl(webhookUrl: string, payload: { text?: string; blocks?: SlackBlock[] }): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Slack webhook error:', errorText);
      return { ok: false, error: errorText };
    }

    return { ok: true };
  } catch (error) {
    console.error('Failed to send via webhook:', error);
    return { ok: false, error: String(error) };
  }
}

/**
 * Send a message via Slack Incoming Webhook (simpler setup than bot)
 */
export async function sendViaWebhook(payload: { text?: string; blocks?: SlackBlock[] }): Promise<{ ok: boolean; error?: string }> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('Slack webhook not configured: SLACK_WEBHOOK_URL missing');
    return { ok: false, error: 'Slack webhook not configured' };
  }

  return sendViaWebhookUrl(SLACK_WEBHOOK_URL, payload);
}

/**
 * Lead notification data (used for both Marketed and TGL)
 */
export interface LeadNotification {
  jobId: string;
  jobNumber: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  scheduledDate?: string;
  leadId?: string; // Our dashboard lead ID
  techName?: string; // For TGL - the tech who generated the lead
  recommendedAdvisor: {
    name: string;
    phone?: string;
    email?: string;
    position: number;
  };
  nextInLine?: {
    name: string;
    phone?: string;
  };
}

// Alias for backwards compatibility
export type MarketedLeadNotification = LeadNotification;

// Get the dashboard base URL for callback links
function getDashboardUrl(): string {
  if (process.env.NEXT_PUBLIC_DASHBOARD_URL) {
    return process.env.NEXT_PUBLIC_DASHBOARD_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

// Get the Service Titan base URL
function getServiceTitanJobUrl(jobId: string): string {
  // Default ST URL format - can be customized via env var
  const baseUrl = process.env.SERVICE_TITAN_WEB_URL || 'https://go.servicetitan.com';
  return `${baseUrl}/#/Job/${jobId}`;
}

/**
 * Send notification for a new marketed lead
 */
export async function sendMarketedLeadNotification(lead: MarketedLeadNotification): Promise<{ ok: boolean; error?: string }> {
  const stUrl = getServiceTitanJobUrl(lead.jobId);

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📣 New Marketed Lead',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Customer:*\n${lead.customerName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Job #:*\n${lead.jobNumber}`,
        },
      ],
    },
  ];

  // Add phone and scheduled date if available
  const detailFields: { type: 'plain_text' | 'mrkdwn'; text: string }[] = [];
  if (lead.customerPhone) {
    detailFields.push({
      type: 'mrkdwn',
      text: `*Phone:*\n${lead.customerPhone}`,
    });
  }
  if (lead.scheduledDate) {
    detailFields.push({
      type: 'mrkdwn',
      text: `*Scheduled:*\n${new Date(lead.scheduledDate).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })}`,
    });
  }

  if (detailFields.length > 0) {
    blocks.push({
      type: 'section',
      fields: detailFields,
    });
  }

  if (lead.customerAddress) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Address:*\n${lead.customerAddress}`,
      },
    });
  }

  // Divider
  blocks.push({ type: 'divider' } as any);

  // Recommended advisor section with emphasis
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `🎯 *Assign to: ${lead.recommendedAdvisor.name}*\n_Queue Position #${lead.recommendedAdvisor.position}_`,
    },
  });

  // Advisor contact info
  if (lead.recommendedAdvisor.phone || lead.recommendedAdvisor.email) {
    const contactParts = [];
    if (lead.recommendedAdvisor.phone) contactParts.push(`📞 ${lead.recommendedAdvisor.phone}`);
    if (lead.recommendedAdvisor.email) contactParts.push(`✉️ ${lead.recommendedAdvisor.email}`);

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: contactParts.join('  •  '),
        },
      ],
    } as any);
  }

  // Action buttons
  const dashboardUrl = getDashboardUrl();
  const markAssignedUrl = `${dashboardUrl}/api/leads/mark-assigned?stId=${lead.jobId}`;

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '📋 Open in Service Titan',
          emoji: true,
        },
        url: stUrl,
        action_id: 'open_servicetitan',
        style: 'primary',
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '✅ Mark Assigned',
          emoji: true,
        },
        url: markAssignedUrl,
        action_id: 'mark_assigned',
      },
    ],
  } as any);

  // Add prominent "NEXT IN LINE" section at the end (shows who gets the NEXT lead)
  if (lead.nextInLine) {
    blocks.push({ type: 'divider' } as any);

    const phoneLink = lead.nextInLine.phone
      ? `<tel:${lead.nextInLine.phone.replace(/\D/g, '')}|📞 ${lead.nextInLine.phone}>`
      : '_No phone on file_';

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*📱 NEXT IN LINE FOR UPCOMING LEADS:*\n\n*${lead.nextInLine.name.toUpperCase()}*\n${phoneLink}`,
      },
    });
  }

  // Try webhook first, then bot token
  if (SLACK_WEBHOOK_URL) {
    return sendViaWebhook({ blocks, text: `New Marketed Lead: ${lead.customerName} - Assign to ${lead.recommendedAdvisor.name}` });
  } else {
    return postToSlack({
      channel: SLACK_LEADS_CHANNEL,
      blocks,
      text: `New Marketed Lead: ${lead.customerName} - Assign to ${lead.recommendedAdvisor.name}`
    });
  }
}

/**
 * Send notification for a new TGL (Tech Generated Lead)
 */
export async function sendTGLNotification(lead: LeadNotification): Promise<{ ok: boolean; error?: string }> {
  const stUrl = getServiceTitanJobUrl(lead.jobId);

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🔧 New Tech Generated Lead',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Customer:*\n${lead.customerName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Job #:*\n${lead.jobNumber}`,
        },
      ],
    },
  ];

  // Add tech name if available
  if (lead.techName) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Generated by:* ${lead.techName}`,
      },
    });
  }

  // Add phone and scheduled date if available
  const detailFields: { type: 'plain_text' | 'mrkdwn'; text: string }[] = [];
  if (lead.customerPhone) {
    detailFields.push({
      type: 'mrkdwn',
      text: `*Phone:*\n${lead.customerPhone}`,
    });
  }
  if (lead.scheduledDate) {
    detailFields.push({
      type: 'mrkdwn',
      text: `*Scheduled:*\n${new Date(lead.scheduledDate).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })}`,
    });
  }

  if (detailFields.length > 0) {
    blocks.push({
      type: 'section',
      fields: detailFields,
    });
  }

  if (lead.customerAddress) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Address:*\n${lead.customerAddress}`,
      },
    });
  }

  // Divider
  blocks.push({ type: 'divider' } as any);

  // Recommended advisor section with emphasis
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `🎯 *Assign to: ${lead.recommendedAdvisor.name}*\n_TGL Queue Position #${lead.recommendedAdvisor.position}_`,
    },
  });

  // Advisor contact info
  if (lead.recommendedAdvisor.phone || lead.recommendedAdvisor.email) {
    const contactParts = [];
    if (lead.recommendedAdvisor.phone) contactParts.push(`📞 ${lead.recommendedAdvisor.phone}`);
    if (lead.recommendedAdvisor.email) contactParts.push(`✉️ ${lead.recommendedAdvisor.email}`);

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: contactParts.join('  •  '),
        },
      ],
    } as any);
  }

  // Action buttons
  const dashboardUrl = getDashboardUrl();
  const markAssignedUrl = `${dashboardUrl}/api/leads/mark-assigned?stId=${lead.jobId}`;

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '📋 Open in Service Titan',
          emoji: true,
        },
        url: stUrl,
        action_id: 'open_servicetitan',
        style: 'primary',
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '✅ Mark Assigned',
          emoji: true,
        },
        url: markAssignedUrl,
        action_id: 'mark_assigned',
      },
    ],
  } as any);

  // Add prominent "NEXT IN LINE" section at the end (shows who gets the NEXT lead)
  if (lead.nextInLine) {
    blocks.push({ type: 'divider' } as any);

    const tglPhoneLink = lead.nextInLine.phone
      ? `<tel:${lead.nextInLine.phone.replace(/\D/g, '')}|📞 ${lead.nextInLine.phone}>`
      : '_No phone on file_';

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*📱 NEXT IN LINE FOR UPCOMING LEADS:*\n\n*${lead.nextInLine.name.toUpperCase()}*\n${tglPhoneLink}`,
      },
    });
  }

  // Use TGL-specific webhook, fall back to main webhook, then bot token
  const tglWebhook = SLACK_TGL_WEBHOOK_URL || SLACK_WEBHOOK_URL;
  if (tglWebhook) {
    return sendViaWebhookUrl(tglWebhook, { blocks, text: `New TGL: ${lead.customerName} - Assign to ${lead.recommendedAdvisor.name}` });
  } else {
    return postToSlack({
      channel: SLACK_LEADS_CHANNEL,
      blocks,
      text: `New TGL: ${lead.customerName} - Assign to ${lead.recommendedAdvisor.name}`
    });
  }
}

/**
 * Post a message to a Slack channel
 */
export async function postToSlack(payload: SlackMessage): Promise<{ ok: boolean; error?: string }> {
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
 * Send a direct message to an advisor by their email
 */
export async function sendAdvisorDM(
  email: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  if (!SLACK_BOT_TOKEN) {
    console.warn('Slack not configured: SLACK_BOT_TOKEN missing');
    return { ok: false, error: 'Slack not configured' };
  }

  try {
    // First, look up the user by email
    const userResponse = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        },
      }
    );

    const userData = await userResponse.json();

    if (!userData.ok) {
      console.warn(`Could not find Slack user for email ${email}:`, userData.error);
      return { ok: false, error: userData.error };
    }

    const userId = userData.user.id;

    // Open a DM channel with the user
    const imResponse = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ users: userId }),
    });

    const imData = await imResponse.json();

    if (!imData.ok) {
      console.error('Failed to open DM channel:', imData.error);
      return { ok: false, error: imData.error };
    }

    // Send the message
    return postToSlack({
      channel: imData.channel.id,
      text: message,
    });
  } catch (error) {
    console.error('Failed to send DM:', error);
    return { ok: false, error: String(error) };
  }
}

/**
 * Format a rich Slack message for lead assignment
 */
export function formatLeadAssignmentMessage(
  lead: Lead,
  advisor: ComfortAdvisor
): SlackMessage {
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'New Lead Assigned',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Customer:*\n${lead.clientName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Assigned To:*\n${advisor.name}`,
        },
        {
          type: 'mrkdwn',
          text: `*Phone:*\n${lead.phone || 'N/A'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Source:*\n${lead.source}`,
        },
        {
          type: 'mrkdwn',
          text: `*System Type:*\n${lead.systemType || 'Unknown'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Unit Age:*\n${lead.unitAge ? `${lead.unitAge} years` : 'N/A'}`,
        },
      ],
    },
  ];

  if (lead.address) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Address:* ${lead.address}`,
      },
    });
  }

  if (lead.notes) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Notes:* ${lead.notes}`,
      },
    });
  }

  return {
    channel: SLACK_LEADS_CHANNEL,
    text: `New lead assigned: ${lead.clientName} -> ${advisor.name}`,
    blocks,
  };
}

/**
 * Format a DM message for the assigned advisor
 */
export function formatAdvisorDMMessage(lead: Lead): string {
  return [
    `You've been assigned a new lead!`,
    ``,
    `*Customer:* ${lead.clientName}`,
    `*Phone:* ${lead.phone || 'N/A'}`,
    `*Source:* ${lead.source}`,
    `*System Type:* ${lead.systemType || 'Unknown'}`,
    lead.unitAge ? `*Unit Age:* ${lead.unitAge} years` : '',
    lead.address ? `*Address:* ${lead.address}` : '',
    lead.notes ? `*Notes:* ${lead.notes}` : '',
  ].filter(Boolean).join('\n');
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

  // Verify the timestamp is recent (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    console.warn('Slack request timestamp too old');
    return false;
  }

  // Create the signature base string
  const sigBaseString = `v0:${timestamp}:${body}`;

  // Create the HMAC signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(sigBaseString)
  );

  // Convert to hex
  const computedSignature = 'v0=' + Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedSignature === signature;
}

/**
 * Parse a lead from a Slack message text
 * Expected format (flexible):
 * Customer: John Doe
 * Phone: 555-1234
 * Source: Google Ads
 * Value: $15000
 * Margin: 40%
 * Address: 123 Main St (optional)
 * Notes: Interested in new AC (optional)
 */
export function parseLeadFromSlackMessage(text: string): {
  customerName?: string;
  phone?: string;
  source?: string;
  estimatedValue?: number;
  grossMarginPercent?: number;
  address?: string;
  notes?: string;
} | null {
  const lines = text.split('\n');
  const result: Record<string, string> = {};

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    if (key.includes('customer') || key.includes('name')) {
      result.customerName = value;
    } else if (key.includes('phone')) {
      result.phone = value;
    } else if (key.includes('source')) {
      result.source = value;
    } else if (key.includes('value') || key.includes('amount')) {
      result.estimatedValue = value.replace(/[$,]/g, '');
    } else if (key.includes('margin')) {
      result.grossMarginPercent = value.replace(/%/g, '');
    } else if (key.includes('address')) {
      result.address = value;
    } else if (key.includes('notes') || key.includes('note')) {
      result.notes = value;
    }
  }

  // Validate required fields
  if (!result.customerName || !result.phone) {
    return null;
  }

  return {
    customerName: result.customerName,
    phone: result.phone,
    source: result.source || 'Other',
    estimatedValue: result.estimatedValue ? parseFloat(result.estimatedValue) : undefined,
    grossMarginPercent: result.grossMarginPercent ? parseFloat(result.grossMarginPercent) : undefined,
    address: result.address,
    notes: result.notes,
  };
}
