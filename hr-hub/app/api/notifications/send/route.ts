import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    onboarding_id,
    task_id,
    recipient_email,
    channel,
    notification_type,
    subject,
    body: messageBody,
  } = body;

  if (!recipient_email || !channel || !notification_type || !subject || !messageBody) {
    return NextResponse.json(
      { error: 'recipient_email, channel, notification_type, subject, and body are required' },
      { status: 400 }
    );
  }

  if (!['email', 'slack'].includes(channel)) {
    return NextResponse.json({ error: 'channel must be "email" or "slack"' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  let status = 'failed';
  let errorMessage: string | null = null;

  try {
    if (channel === 'email') {
      if (!process.env.RESEND_API_KEY) {
        return NextResponse.json({ error: 'Email not configured (RESEND_API_KEY missing)' }, { status: 500 });
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'HR Hub <notifications@christmasair.com>',
          to: [recipient_email],
          subject,
          text: messageBody,
        }),
      });

      if (response.ok) {
        status = 'sent';
      } else {
        const errText = await response.text();
        console.error('Resend error:', errText);
        errorMessage = errText;
      }
    } else if (channel === 'slack') {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (!webhookUrl) {
        return NextResponse.json({ error: 'Slack not configured (SLACK_WEBHOOK_URL missing)' }, { status: 500 });
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `*${subject}*\n${messageBody}`,
        }),
      });

      if (response.ok) {
        status = 'sent';
      } else {
        const errText = await response.text();
        console.error('Slack webhook error:', errText);
        errorMessage = errText;
      }
    }
  } catch (err) {
    console.error('Notification send error:', err);
    errorMessage = err instanceof Error ? err.message : 'Unknown error';
  }

  // Log in hr_notification_log
  const { data: logEntry, error: logError } = await supabase
    .from('hr_notification_log')
    .insert({
      onboarding_id: onboarding_id || null,
      task_id: task_id || null,
      recipient_email,
      channel,
      notification_type,
      subject,
      body: messageBody,
      status,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      error_message: errorMessage,
    })
    .select()
    .single();

  if (logError) {
    console.error('Error logging notification:', logError);
  }

  if (status === 'sent') {
    return NextResponse.json({ success: true, notification_id: logEntry?.id });
  } else {
    return NextResponse.json(
      { error: 'Failed to send notification', details: errorMessage },
      { status: 500 }
    );
  }
}
