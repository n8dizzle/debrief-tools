import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { sendSMS } from '@/lib/notifications/sms';
import { sendEmail } from '@/lib/notifications/email';

// GET - List queued notifications
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'queued';

  const { data: notifications, error } = await supabase
    .from('tracker_notifications')
    .select(`
      *,
      tracker:job_trackers(
        id,
        tracking_code,
        customer_name,
        trade,
        job_type
      )
    `)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(notifications);
}

// POST - Approve or discard a notification
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, action } = body;

  if (!id || !['approve', 'discard'].includes(action)) {
    return NextResponse.json(
      { error: 'Invalid request. Provide id and action (approve/discard)' },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();

  // Get the notification
  const { data: notification, error: fetchError } = await supabase
    .from('tracker_notifications')
    .select('*')
    .eq('id', id)
    .eq('status', 'queued')
    .single();

  if (fetchError || !notification) {
    return NextResponse.json(
      { error: 'Notification not found or already processed' },
      { status: 404 }
    );
  }

  if (action === 'discard') {
    // Mark as discarded
    const { error: updateError } = await supabase
      .from('tracker_notifications')
      .update({
        status: 'discarded',
        discarded_by: session.user.id,
        discarded_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: 'discarded' });
  }

  // Approve and send
  let sendResult: { success: boolean; messageId?: string; error?: string };

  if (notification.notification_type === 'sms') {
    sendResult = await sendSMS(notification.recipient, notification.message);
  } else {
    // For email, we need to generate the full HTML template
    // For now, send a simple version
    const html = generateEmailHtml(notification);
    sendResult = await sendEmail(
      notification.recipient,
      notification.subject || 'Update from Christmas Air',
      html
    );
  }

  // Update notification status
  const { error: updateError } = await supabase
    .from('tracker_notifications')
    .update({
      status: sendResult.success ? 'sent' : 'failed',
      approved_by: session.user.id,
      approved_at: new Date().toISOString(),
      sent_at: sendResult.success ? new Date().toISOString() : null,
      external_id: sendResult.messageId || null,
      error_message: sendResult.error || null,
    })
    .eq('id', id);

  if (updateError) {
    console.error('Failed to update notification status:', updateError);
  }

  return NextResponse.json({
    success: sendResult.success,
    action: 'approved',
    sent: sendResult.success,
    error: sendResult.error,
  });
}

function generateEmailHtml(notification: {
  message: string;
  subject?: string | null;
  metadata?: { category?: string } | null;
}): string {
  const category = (notification.metadata as { category?: string })?.category || 'update';

  let title = 'Update from Christmas Air';
  if (category === 'welcome') title = 'Your Job Tracker';
  if (category === 'milestone') title = 'Progress Update';
  if (category === 'completion') title = 'Job Complete!';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="min-width: 100%;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background-color: #5D8A66; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Christmas Air</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="margin: 0 0 16px 0; color: #18181b; font-size: 20px; font-weight: 600;">${title}</h2>
              <p style="margin: 0; color: #3f3f46; line-height: 1.6;">${notification.message}</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f4f4f5; padding: 24px; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #71717a; font-size: 14px;">Questions? Call us at (512) 439-1616</p>
              <p style="margin: 0; color: #a1a1aa; font-size: 12px;"><a href="https://christmasair.com" style="color: #5D8A66; text-decoration: none;">christmasair.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
