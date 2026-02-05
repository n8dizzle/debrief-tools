import { ARDashboardStats } from './supabase';

export interface SlackSendResult {
  success: boolean;
  error?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SlackBlock = Record<string, any>;

/**
 * Generate Slack Block Kit message for dashboard summary
 */
function generateSlackBlocks(stats: ARDashboardStats, weekDate: string, isTest: boolean = false): SlackBlock[] {
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ar.christmasair.com';

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${isTest ? '[TEST] ' : ''}AR Weekly Summary - ${weekDate}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Total Outstanding*\n${formatCurrency(stats.total_outstanding)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Actionable AR*\n${formatCurrency(stats.ar_collectible)}`,
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Aging Breakdown*',
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Current*\n${formatCurrency(stats.aging_buckets.current)}`,
        },
        {
          type: 'mrkdwn',
          text: `*31-60 Days*\n${formatCurrency(stats.aging_buckets.bucket_30)}`,
        },
        {
          type: 'mrkdwn',
          text: `*61-90 Days*\n${formatCurrency(stats.aging_buckets.bucket_60)}`,
        },
        {
          type: 'mrkdwn',
          text: `*90+ Days*\n${formatCurrency(stats.aging_buckets.bucket_90_plus)}`,
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Install*\n${formatCurrency(stats.install_total)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Service*\n${formatCurrency(stats.service_total)}`,
        },
      ],
    },
  ];

  // Add business unit breakdown if available
  if (stats.business_unit_totals.length > 0) {
    blocks.push({
      type: 'divider',
    });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*By Business Unit*',
      },
    });

    const buFields = stats.business_unit_totals.slice(0, 4).map(bu => ({
      type: 'mrkdwn',
      text: `*${bu.name}*\n${formatCurrency(bu.total)}`,
    }));

    blocks.push({
      type: 'section',
      fields: buFields,
    });
  }

  // Add top balances
  if (stats.top_balances.length > 0) {
    blocks.push({
      type: 'divider',
    });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Top 5 Highest Balances*',
      },
    });

    const topBalancesText = stats.top_balances.slice(0, 5).map((inv, i) =>
      `${i + 1}. ${inv.customer_name.substring(0, 20)} - ${formatCurrency(inv.balance)} (${inv.days_outstanding} days)`
    ).join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: topBalancesText,
      },
    });
  }

  // Add link to dashboard
  blocks.push({
    type: 'divider',
  });
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View Full Dashboard',
          emoji: true,
        },
        url: dashboardUrl,
        style: 'primary',
      },
    ],
  });

  return blocks;
}

/**
 * Send dashboard summary to Slack webhook
 */
export async function sendSlackDashboardNotification(
  webhookUrl: string,
  dashboardData: ARDashboardStats,
  isTest: boolean = false
): Promise<SlackSendResult> {
  if (!webhookUrl) {
    return { success: false, error: 'Slack webhook URL not configured' };
  }

  const weekDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  try {
    const blocks = generateSlackBlocks(dashboardData, weekDate, isTest);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: `AR Weekly Summary - ${weekDate}`,
        blocks,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Slack webhook error:', errorText);
      return { success: false, error: `Slack API error: ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    console.error('Slack send error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
