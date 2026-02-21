import { NextRequest, NextResponse } from 'next/server';
import {
  verifySlackSignature,
  parseLeadFromSlackMessage,
  postToSlack,
  isSlackConfigured,
} from '@/lib/slack';

interface SlackEvent {
  type: string;
  challenge?: string;
  event?: {
    type: string;
    channel: string;
    user: string;
    text: string;
    ts: string;
    bot_id?: string;
  };
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  let payload: SlackEvent;

  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Handle URL verification challenge from Slack
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Verify Slack signature for security
  const signature = request.headers.get('x-slack-signature') || '';
  const timestamp = request.headers.get('x-slack-request-timestamp') || '';

  const isValid = await verifySlackSignature(signature, timestamp, body);
  if (!isValid) {
    console.warn('Invalid Slack signature');
    // Return 200 to prevent Slack retries, but log the issue
    return NextResponse.json({ ok: true, warning: 'Signature verification failed' });
  }

  // Handle event callbacks
  if (payload.type === 'event_callback' && payload.event) {
    const event = payload.event;

    // Ignore bot messages to prevent loops
    if (event.bot_id) {
      return NextResponse.json({ ok: true });
    }

    // Only handle message events
    if (event.type === 'message') {
      try {
        await handleIncomingMessage(event.channel, event.text, event.user);
      } catch (error) {
        console.error('Error handling incoming message:', error);
        // Return 200 to prevent Slack retries
      }
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleIncomingMessage(channel: string, text: string, userId: string) {
  // Try to parse lead data from the message
  const leadData = parseLeadFromSlackMessage(text);

  if (!leadData) {
    // Message doesn't contain valid lead data, ignore it
    return;
  }

  if (!leadData.estimatedValue || !leadData.grossMarginPercent) {
    // Missing required fields - post a helpful message
    if (isSlackConfigured()) {
      await postToSlack({
        channel,
        text: `<@${userId}> I found a lead for *${leadData.customerName}* but it's missing required fields. Please include:\n- Value: (estimated job value)\n- Margin: (gross margin percentage)\n\nOr enter the lead via the dashboard: ${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}`,
      });
    }
    return;
  }

  // Note: In a production setup with a database, we would:
  // 1. Look up the next advisor from the database
  // 2. Create the lead in the database
  // 3. Rotate the queue in the database
  // 4. Post a confirmation message
  //
  // Since this is an in-memory store (client-side only), we can't directly
  // create leads from the webhook. Instead, we post a message instructing
  // users to use the web form, or this could be extended with a database.

  if (isSlackConfigured()) {
    await postToSlack({
      channel,
      text: [
        `Lead detected from <@${userId}>:`,
        `- Customer: ${leadData.customerName}`,
        `- Phone: ${leadData.phone}`,
        `- Source: ${leadData.source}`,
        `- Value: $${leadData.estimatedValue.toLocaleString()}`,
        `- Margin: ${leadData.grossMarginPercent}%`,
        leadData.address ? `- Address: ${leadData.address}` : '',
        leadData.notes ? `- Notes: ${leadData.notes}` : '',
        ``,
        `To assign this lead, please enter it in the dashboard: ${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}`,
      ].filter(Boolean).join('\n'),
    });
  }
}

// Also handle GET for Slack's URL verification during app setup
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Slack webhook endpoint is active',
  });
}
