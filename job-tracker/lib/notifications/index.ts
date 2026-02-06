import { getServerSupabase, JobTracker, TrackerMilestone } from '@/lib/supabase';
import { sendMilestoneNotificationSMS, sendWelcomeSMS, sendCompletionSMS, sendSMS } from './sms';
import { sendMilestoneNotificationEmail, sendWelcomeEmail, sendCompletionEmail, sendEmail } from './email';
import { getTrackerUrl } from '@/lib/tracking-code';

type NotificationCategory = 'welcome' | 'milestone' | 'completion';

/**
 * Get a setting value from job_tracker_settings
 */
async function getSetting(key: string): Promise<boolean> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from('job_tracker_settings')
    .select('value')
    .eq('key', key)
    .single();

  if (!data) return false;
  return data.value === true || data.value === 'true';
}

/**
 * Check if notifications should be queued or sent directly
 */
async function shouldQueueNotification(category: NotificationCategory): Promise<boolean> {
  const requireApproval = await getSetting('require_queue_approval');
  if (requireApproval) return true;

  // Check category-specific auto-send settings
  const autoSendKey = `auto_send_${category}`;
  const autoSend = await getSetting(autoSendKey);
  return !autoSend;
}

/**
 * Queue a notification for approval
 */
async function queueNotification(
  trackerId: string,
  milestoneId: string | null,
  type: 'sms' | 'email',
  recipient: string,
  subject: string | null,
  message: string,
  category: NotificationCategory
): Promise<{ queued: boolean; error?: string }> {
  const supabase = getServerSupabase();

  const { error } = await supabase.from('tracker_notifications').insert({
    tracker_id: trackerId,
    milestone_id: milestoneId,
    notification_type: type,
    recipient,
    subject,
    message,
    status: 'queued',
    metadata: { category },
  });

  if (error) {
    console.error('Failed to queue notification:', error);
    return { queued: false, error: error.message };
  }

  return { queued: true };
}

/**
 * Send milestone notification to customer (both SMS and email if enabled)
 */
export async function notifyMilestoneComplete(
  tracker: JobTracker,
  milestone: TrackerMilestone
): Promise<{ sms: boolean; email: boolean; queued: boolean }> {
  const results = { sms: false, email: false, queued: false };
  const shouldQueue = await shouldQueueNotification('milestone');

  const trackerUrl = getTrackerUrl(tracker.tracking_code);
  const tradeName = tracker.trade === 'hvac' ? 'HVAC' : 'Plumbing';

  // Handle SMS
  if (tracker.notify_sms && tracker.notification_phone) {
    const smsMessage = `Christmas Air ${tradeName} Update: "${milestone.name}" is complete! ${
      milestone.customer_notes ? `\n\n${milestone.customer_notes}` : ''
    }\n\nTrack your progress: ${trackerUrl}`;

    if (shouldQueue) {
      await queueNotification(
        tracker.id,
        milestone.id,
        'sms',
        tracker.notification_phone,
        null,
        smsMessage,
        'milestone'
      );
      results.queued = true;
    } else {
      const smsResult = await sendMilestoneNotificationSMS(tracker, milestone);
      results.sms = smsResult.success;
    }
  }

  // Handle email
  if (tracker.notify_email && tracker.notification_email) {
    const subject = `Update: ${milestone.name} - Your ${tradeName} Job`;
    // Generate full HTML would be complex here, so we'll store a simplified version
    const emailMessage = `Milestone "${milestone.name}" is complete for your ${tradeName} job. ${
      milestone.customer_notes || ''
    }`;

    if (shouldQueue) {
      await queueNotification(
        tracker.id,
        milestone.id,
        'email',
        tracker.notification_email,
        subject,
        emailMessage,
        'milestone'
      );
      results.queued = true;
    } else {
      const emailResult = await sendMilestoneNotificationEmail(tracker, milestone);
      results.email = emailResult.success;
    }
  }

  return results;
}

/**
 * Send welcome notification when tracker is created
 */
export async function notifyTrackerCreated(
  tracker: JobTracker
): Promise<{ sms: boolean; email: boolean; queued: boolean }> {
  const results = { sms: false, email: false, queued: false };
  const shouldQueue = await shouldQueueNotification('welcome');

  const trackerUrl = getTrackerUrl(tracker.tracking_code);
  const tradeName = tracker.trade === 'hvac' ? 'HVAC' : 'Plumbing';
  const jobType = tracker.job_type.charAt(0).toUpperCase() + tracker.job_type.slice(1);

  // Handle SMS
  if (tracker.notify_sms && tracker.notification_phone) {
    const smsMessage = `Hi ${tracker.customer_name.split(' ')[0]}! Track your Christmas Air ${tradeName} ${jobType} progress here: ${trackerUrl}\n\nWe'll text you updates as we complete each step.`;

    if (shouldQueue) {
      await queueNotification(
        tracker.id,
        null,
        'sms',
        tracker.notification_phone,
        null,
        smsMessage,
        'welcome'
      );
      results.queued = true;
    } else {
      const smsResult = await sendWelcomeSMS(tracker);
      results.sms = smsResult.success;
    }
  }

  // Handle email
  if (tracker.notify_email && tracker.notification_email) {
    const subject = `Track Your ${tradeName} ${jobType} - Christmas Air`;
    const emailMessage = `Hi ${tracker.customer_name.split(' ')[0]}! We've created a progress tracker for your ${tradeName} ${jobType}. Track your progress at: ${trackerUrl}`;

    if (shouldQueue) {
      await queueNotification(
        tracker.id,
        null,
        'email',
        tracker.notification_email,
        subject,
        emailMessage,
        'welcome'
      );
      results.queued = true;
    } else {
      const emailResult = await sendWelcomeEmail(tracker);
      results.email = emailResult.success;
    }
  }

  return results;
}

/**
 * Send completion notification when tracker is marked complete
 */
export async function notifyTrackerComplete(
  tracker: JobTracker
): Promise<{ sms: boolean; email: boolean; queued: boolean }> {
  const results = { sms: false, email: false, queued: false };
  const shouldQueue = await shouldQueueNotification('completion');

  const tradeName = tracker.trade === 'hvac' ? 'HVAC' : 'Plumbing';

  // Handle SMS
  if (tracker.notify_sms && tracker.notification_phone) {
    const smsMessage = `Great news, ${tracker.customer_name.split(' ')[0]}! Your Christmas Air ${tradeName} job is complete!\n\nThank you for choosing Christmas Air. Questions? Call us at (512) 439-1616`;

    if (shouldQueue) {
      await queueNotification(
        tracker.id,
        null,
        'sms',
        tracker.notification_phone,
        null,
        smsMessage,
        'completion'
      );
      results.queued = true;
    } else {
      const smsResult = await sendCompletionSMS(tracker);
      results.sms = smsResult.success;
    }
  }

  // Handle email
  if (tracker.notify_email && tracker.notification_email) {
    const subject = `Your ${tradeName} Job is Complete! - Christmas Air`;
    const emailMessage = `Great news - your ${tradeName} ${tracker.job_type} is complete! Thank you for choosing Christmas Air.`;

    if (shouldQueue) {
      await queueNotification(
        tracker.id,
        null,
        'email',
        tracker.notification_email,
        subject,
        emailMessage,
        'completion'
      );
      results.queued = true;
    } else {
      const emailResult = await sendCompletionEmail(tracker);
      results.email = emailResult.success;
    }
  }

  return results;
}

export * from './sms';
export * from './email';
