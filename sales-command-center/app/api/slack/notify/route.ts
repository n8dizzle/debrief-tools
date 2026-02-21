import { NextRequest, NextResponse } from 'next/server';
import {
  postToSlack,
  sendAdvisorDM,
  formatLeadAssignmentMessage,
  formatAdvisorDMMessage,
  isSlackConfigured,
} from '@/lib/slack';
import { SlackNotificationPayload } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const payload: SlackNotificationPayload = await request.json();
    const { lead, advisor, channel } = payload;

    if (!lead || !advisor) {
      return NextResponse.json(
        { error: 'Missing lead or advisor data' },
        { status: 400 }
      );
    }

    // Check if Slack is configured
    if (!isSlackConfigured()) {
      console.warn('Slack notification skipped: not configured');
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Slack not configured',
      });
    }

    const results: {
      channelPost: { ok: boolean; error?: string };
      advisorDM: { ok: boolean; error?: string };
    } = {
      channelPost: { ok: false, error: 'not attempted' },
      advisorDM: { ok: false, error: 'not attempted' },
    };

    // Post to the channel
    const channelMessage = formatLeadAssignmentMessage(lead, advisor);
    if (channel) {
      channelMessage.channel = channel;
    }
    results.channelPost = await postToSlack(channelMessage);

    // Send DM to the assigned advisor
    if (advisor.email) {
      const dmMessage = formatAdvisorDMMessage(lead);
      results.advisorDM = await sendAdvisorDM(advisor.email, dmMessage);
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification', details: String(error) },
      { status: 500 }
    );
  }
}
