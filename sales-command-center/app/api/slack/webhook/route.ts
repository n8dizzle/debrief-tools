import { NextRequest, NextResponse } from 'next/server';
import {
  verifySlackSignature,
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

    // Lead creation now happens via Service Titan poll cron, not Slack messages.
    // This webhook is kept for future interactive button handling.
  }

  return NextResponse.json({ ok: true });
}

// Also handle GET for Slack's URL verification during app setup
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Slack webhook endpoint is active',
  });
}
