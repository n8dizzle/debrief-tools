import { getServerSupabase, JobTracker, TrackerMilestone } from '@/lib/supabase';
import { getTrackerUrl } from '@/lib/tracking-code';

interface DialpadConfig {
  apiKey: string;
  fromNumber: string;
}

function getDialpadConfig(): DialpadConfig | null {
  const apiKey = process.env.DIALPAD_API_KEY;
  const fromNumber = process.env.DIALPAD_FROM_NUMBER;

  if (!apiKey || !fromNumber) {
    console.warn('Dialpad credentials not configured');
    return null;
  }

  return { apiKey, fromNumber };
}

interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an SMS message via Dialpad
 */
export async function sendSMS(to: string, message: string): Promise<SendSMSResult> {
  const config = getDialpadConfig();

  if (!config) {
    return { success: false, error: 'Dialpad not configured' };
  }

  try {
    // Format phone number to E.164 format
    let formattedTo = to.replace(/\D/g, '');
    if (formattedTo.length === 10) {
      formattedTo = `+1${formattedTo}`;
    } else if (!formattedTo.startsWith('+')) {
      formattedTo = `+${formattedTo}`;
    }

    // Format from_number to E.164
    let formattedFrom = config.fromNumber.replace(/\D/g, '');
    if (formattedFrom.length === 10) {
      formattedFrom = `+1${formattedFrom}`;
    } else if (!formattedFrom.startsWith('+')) {
      formattedFrom = `+${formattedFrom}`;
    }

    const response = await fetch('https://dialpad.com/api/v2/sms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_number: formattedFrom,
        to_numbers: [formattedTo],
        text: message,
        infer_country_code: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Dialpad SMS error:', response.status, errorText);
      return {
        success: false,
        error: `Dialpad API error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    return { success: true, messageId: result.id || 'sent' };
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send a milestone completion notification via SMS
 */
export async function sendMilestoneNotificationSMS(
  tracker: JobTracker,
  milestone: TrackerMilestone
): Promise<SendSMSResult> {
  if (!tracker.notify_sms || !tracker.notification_phone) {
    return { success: false, error: 'SMS notifications not enabled or phone missing' };
  }

  const trackerUrl = getTrackerUrl(tracker.tracking_code);
  const tradeName = tracker.trade === 'hvac' ? 'HVAC' : 'Plumbing';

  const message = `Christmas Air ${tradeName} Update: "${milestone.name}" is complete! ${
    milestone.customer_notes ? `\n\n${milestone.customer_notes}` : ''
  }\n\nTrack your progress: ${trackerUrl}`;

  const result = await sendSMS(tracker.notification_phone, message);

  // Log the notification
  const supabase = getServerSupabase();
  await supabase.from('tracker_notifications').insert({
    tracker_id: tracker.id,
    milestone_id: milestone.id,
    notification_type: 'sms',
    recipient: tracker.notification_phone,
    message,
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
 * Send a tracker creation welcome SMS
 */
export async function sendWelcomeSMS(tracker: JobTracker): Promise<SendSMSResult> {
  if (!tracker.notify_sms || !tracker.notification_phone) {
    return { success: false, error: 'SMS notifications not enabled or phone missing' };
  }

  const trackerUrl = getTrackerUrl(tracker.tracking_code);
  const tradeName = tracker.trade === 'hvac' ? 'HVAC' : 'Plumbing';
  const jobType = tracker.job_type.charAt(0).toUpperCase() + tracker.job_type.slice(1);

  const message = `Hi ${tracker.customer_name.split(' ')[0]}! Track your Christmas Air ${tradeName} ${jobType} progress here: ${trackerUrl}\n\nWe'll text you updates as we complete each step.`;

  const result = await sendSMS(tracker.notification_phone, message);

  // Log the notification
  const supabase = getServerSupabase();
  await supabase.from('tracker_notifications').insert({
    tracker_id: tracker.id,
    notification_type: 'sms',
    recipient: tracker.notification_phone,
    message,
    status: result.success ? 'sent' : 'failed',
    sent_at: result.success ? new Date().toISOString() : null,
    external_id: result.messageId || null,
    error_message: result.error || null,
  });

  return result;
}

/**
 * Send a job completion SMS
 */
export async function sendCompletionSMS(tracker: JobTracker): Promise<SendSMSResult> {
  if (!tracker.notify_sms || !tracker.notification_phone) {
    return { success: false, error: 'SMS notifications not enabled or phone missing' };
  }

  const tradeName = tracker.trade === 'hvac' ? 'HVAC' : 'Plumbing';

  const message = `Great news, ${tracker.customer_name.split(' ')[0]}! Your Christmas Air ${tradeName} job is complete!\n\nThank you for choosing Christmas Air. Questions? Call us at (512) 439-1616`;

  const result = await sendSMS(tracker.notification_phone, message);

  // Log the notification
  const supabase = getServerSupabase();
  await supabase.from('tracker_notifications').insert({
    tracker_id: tracker.id,
    notification_type: 'sms',
    recipient: tracker.notification_phone,
    message,
    status: result.success ? 'sent' : 'failed',
    sent_at: result.success ? new Date().toISOString() : null,
    external_id: result.messageId || null,
    error_message: result.error || null,
  });

  return result;
}
