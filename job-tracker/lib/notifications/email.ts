import { Resend } from 'resend';
import { getServerSupabase, JobTracker, TrackerMilestone } from '@/lib/supabase';
import { getTrackerUrl } from '@/lib/tracking-code';

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('Resend API key not configured');
    return null;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

const FROM_EMAIL = 'Christmas Air <updates@christmasair.com>';

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email via Resend
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<SendEmailResult> {
  const client = getResendClient();

  if (!client) {
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate email template HTML
 */
function generateEmailTemplate(
  title: string,
  content: string,
  ctaText: string,
  ctaUrl: string,
  trade: 'hvac' | 'plumbing'
): string {
  const primaryColor = trade === 'hvac' ? '#5D8A66' : '#B8956B';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="min-width: 100%;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${primaryColor}; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Christmas Air</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="margin: 0 0 16px 0; color: #18181b; font-size: 20px; font-weight: 600;">${title}</h2>
              ${content}

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 24px;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" style="display: inline-block; padding: 12px 24px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px;">${ctaText}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f4f4f5; padding: 24px; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #71717a; font-size: 14px;">Questions? Call us at (512) 439-1616</p>
              <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
                <a href="https://christmasair.com" style="color: ${primaryColor}; text-decoration: none;">christmasair.com</a>
              </p>
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

/**
 * Send a milestone completion notification via email
 */
export async function sendMilestoneNotificationEmail(
  tracker: JobTracker,
  milestone: TrackerMilestone
): Promise<SendEmailResult> {
  if (!tracker.notify_email || !tracker.notification_email) {
    return { success: false, error: 'Email notifications not enabled or email missing' };
  }

  const trackerUrl = getTrackerUrl(tracker.tracking_code);
  const tradeName = tracker.trade === 'hvac' ? 'HVAC' : 'Plumbing';

  const subject = `Update: ${milestone.name} - Your ${tradeName} Job`;

  const content = `
    <p style="margin: 0 0 16px 0; color: #3f3f46; line-height: 1.6;">
      Good news! We've completed the "${milestone.name}" step on your ${tradeName.toLowerCase()} job.
    </p>
    ${
      milestone.customer_notes
        ? `<div style="background-color: #f4f4f5; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0; color: #3f3f46;">${milestone.customer_notes}</p>
          </div>`
        : ''
    }
    <p style="margin: 0; color: #3f3f46; line-height: 1.6;">
      Click below to view your full progress tracker.
    </p>
  `;

  const html = generateEmailTemplate(
    `${milestone.name} Complete!`,
    content,
    'View Progress',
    trackerUrl,
    tracker.trade
  );

  const result = await sendEmail(tracker.notification_email, subject, html);

  // Log the notification
  const supabase = getServerSupabase();
  await supabase.from('tracker_notifications').insert({
    tracker_id: tracker.id,
    milestone_id: milestone.id,
    notification_type: 'email',
    recipient: tracker.notification_email,
    subject,
    message: html,
    status: result.success ? 'sent' : 'failed',
    sent_at: result.success ? new Date().toISOString() : null,
    external_id: result.messageId || null,
    error_message: result.error || null,
  });

  // Update milestone to mark notification sent
  if (result.success) {
    await supabase
      .from('tracker_milestones')
      .update({
        notification_sent: true,
        notification_sent_at: new Date().toISOString(),
      })
      .eq('id', milestone.id);
  }

  return result;
}

/**
 * Send a tracker creation welcome email
 */
export async function sendWelcomeEmail(tracker: JobTracker): Promise<SendEmailResult> {
  if (!tracker.notify_email || !tracker.notification_email) {
    return { success: false, error: 'Email notifications not enabled or email missing' };
  }

  const trackerUrl = getTrackerUrl(tracker.tracking_code);
  const tradeName = tracker.trade === 'hvac' ? 'HVAC' : 'Plumbing';
  const jobType = tracker.job_type.charAt(0).toUpperCase() + tracker.job_type.slice(1);

  const subject = `Track Your ${tradeName} ${jobType} - Christmas Air`;

  const content = `
    <p style="margin: 0 0 16px 0; color: #3f3f46; line-height: 1.6;">
      Hi ${tracker.customer_name.split(' ')[0]}!
    </p>
    <p style="margin: 0 0 16px 0; color: #3f3f46; line-height: 1.6;">
      We've created a progress tracker for your ${tradeName.toLowerCase()} ${tracker.job_type}.
      You can check in anytime to see how your job is progressing.
    </p>
    ${
      tracker.scheduled_date
        ? `<p style="margin: 0 0 16px 0; color: #3f3f46; line-height: 1.6;">
            <strong>Scheduled Date:</strong> ${new Date(tracker.scheduled_date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>`
        : ''
    }
    ${
      tracker.job_address
        ? `<p style="margin: 0 0 16px 0; color: #3f3f46; line-height: 1.6;">
            <strong>Service Address:</strong> ${tracker.job_address}
          </p>`
        : ''
    }
    <p style="margin: 0; color: #3f3f46; line-height: 1.6;">
      We'll keep you updated as we complete each step!
    </p>
  `;

  const html = generateEmailTemplate(
    `Your ${tradeName} Job Tracker`,
    content,
    'Track Your Progress',
    trackerUrl,
    tracker.trade
  );

  const result = await sendEmail(tracker.notification_email, subject, html);

  // Log the notification
  const supabase = getServerSupabase();
  await supabase.from('tracker_notifications').insert({
    tracker_id: tracker.id,
    notification_type: 'email',
    recipient: tracker.notification_email,
    subject,
    message: html,
    status: result.success ? 'sent' : 'failed',
    sent_at: result.success ? new Date().toISOString() : null,
    external_id: result.messageId || null,
    error_message: result.error || null,
  });

  return result;
}

/**
 * Send a job completion email
 */
export async function sendCompletionEmail(tracker: JobTracker): Promise<SendEmailResult> {
  if (!tracker.notify_email || !tracker.notification_email) {
    return { success: false, error: 'Email notifications not enabled or email missing' };
  }

  const tradeName = tracker.trade === 'hvac' ? 'HVAC' : 'Plumbing';

  const subject = `Your ${tradeName} Job is Complete! - Christmas Air`;

  const content = `
    <p style="margin: 0 0 16px 0; color: #3f3f46; line-height: 1.6;">
      Hi ${tracker.customer_name.split(' ')[0]}!
    </p>
    <p style="margin: 0 0 16px 0; color: #3f3f46; line-height: 1.6;">
      Great news - your ${tradeName.toLowerCase()} ${tracker.job_type} is complete!
      Thank you for choosing Christmas Air for your home comfort needs.
    </p>
    <p style="margin: 0 0 16px 0; color: #3f3f46; line-height: 1.6;">
      If you have any questions about your new equipment or service, don't hesitate to reach out.
      We're here to help!
    </p>
    <p style="margin: 0; color: #3f3f46; line-height: 1.6;">
      Thanks again,<br>
      <strong>The Christmas Air Team</strong>
    </p>
  `;

  const html = generateEmailTemplate(
    'Job Complete!',
    content,
    'Visit Our Website',
    'https://christmasair.com',
    tracker.trade
  );

  const result = await sendEmail(tracker.notification_email, subject, html);

  // Log the notification
  const supabase = getServerSupabase();
  await supabase.from('tracker_notifications').insert({
    tracker_id: tracker.id,
    notification_type: 'email',
    recipient: tracker.notification_email,
    subject,
    message: html,
    status: result.success ? 'sent' : 'failed',
    sent_at: result.success ? new Date().toISOString() : null,
    external_id: result.messageId || null,
    error_message: result.error || null,
  });

  return result;
}
