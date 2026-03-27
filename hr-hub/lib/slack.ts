/**
 * Slack webhook utility for HR Hub notifications
 */

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

interface SlackResult {
  success: boolean;
  error?: string;
}

export async function sendSlackMessage(text: string, blocks?: any[]): Promise<SlackResult> {
  if (!SLACK_WEBHOOK_URL) {
    return { success: false, error: 'Slack webhook not configured' };
  }

  try {
    const body: any = { text };
    if (blocks) body.blocks = blocks;

    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Slack error: ${res.status} ${text}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
