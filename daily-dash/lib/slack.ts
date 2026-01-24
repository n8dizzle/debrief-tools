// Slack integration stub - notifications disabled for now
// To enable Slack: npm install @slack/web-api, set SLACK_ENABLED=true and SLACK_BOT_TOKEN

/**
 * Check if Slack integration is enabled and configured
 */
export function isSlackEnabled(): boolean {
  return false; // Disabled until Slack package is installed
}

/**
 * Look up a Slack user by email address
 * Stub implementation - always returns null
 */
export async function lookupSlackUserByEmail(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _email: string
): Promise<{
  id: string;
  name: string;
  realName: string;
} | null> {
  // Slack disabled - return null
  return null;
}

/**
 * Data structure for reviews with team mentions
 */
export interface ReviewMentionNotification {
  reviewId: string;
  reviewerName: string;
  starRating: number;
  comment: string;
  locationName: string;
  teamMentions: string[];
  slackUserIds: string[];
}

/**
 * Send Slack DM notifications for new reviews that mention team members
 * Stub implementation - returns immediately
 */
export async function sendReviewMentionNotifications(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _reviews: ReviewMentionNotification[]
): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  // Slack notifications disabled
  return { sent: 0, failed: 0, skipped: _reviews.length };
}
