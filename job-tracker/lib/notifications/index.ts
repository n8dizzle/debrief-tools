import { JobTracker, TrackerMilestone } from '@/lib/supabase';
import { sendMilestoneNotificationSMS, sendWelcomeSMS, sendCompletionSMS } from './sms';
import { sendMilestoneNotificationEmail, sendWelcomeEmail, sendCompletionEmail } from './email';

/**
 * Send milestone notification to customer (both SMS and email if enabled)
 */
export async function notifyMilestoneComplete(
  tracker: JobTracker,
  milestone: TrackerMilestone
): Promise<{ sms: boolean; email: boolean }> {
  const results = { sms: false, email: false };

  // Send SMS if enabled
  if (tracker.notify_sms && tracker.notification_phone) {
    const smsResult = await sendMilestoneNotificationSMS(tracker, milestone);
    results.sms = smsResult.success;
  }

  // Send email if enabled
  if (tracker.notify_email && tracker.notification_email) {
    const emailResult = await sendMilestoneNotificationEmail(tracker, milestone);
    results.email = emailResult.success;
  }

  return results;
}

/**
 * Send welcome notification when tracker is created
 */
export async function notifyTrackerCreated(
  tracker: JobTracker
): Promise<{ sms: boolean; email: boolean }> {
  const results = { sms: false, email: false };

  // Send SMS if enabled
  if (tracker.notify_sms && tracker.notification_phone) {
    const smsResult = await sendWelcomeSMS(tracker);
    results.sms = smsResult.success;
  }

  // Send email if enabled
  if (tracker.notify_email && tracker.notification_email) {
    const emailResult = await sendWelcomeEmail(tracker);
    results.email = emailResult.success;
  }

  return results;
}

/**
 * Send completion notification when tracker is marked complete
 */
export async function notifyTrackerComplete(
  tracker: JobTracker
): Promise<{ sms: boolean; email: boolean }> {
  const results = { sms: false, email: false };

  // Send SMS if enabled
  if (tracker.notify_sms && tracker.notification_phone) {
    const smsResult = await sendCompletionSMS(tracker);
    results.sms = smsResult.success;
  }

  // Send email if enabled
  if (tracker.notify_email && tracker.notification_email) {
    const emailResult = await sendCompletionEmail(tracker);
    results.email = emailResult.success;
  }

  return results;
}

export * from './sms';
export * from './email';
