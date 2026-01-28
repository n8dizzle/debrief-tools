import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, ARSlackSettings, ARSlackNotificationLog } from '@/lib/supabase';

/**
 * GET /api/settings/slack
 * Get Slack settings and last sent info
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only managers and owners can view Slack settings
    const role = (session.user as { role?: string }).role;
    if (!role || !['manager', 'owner'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServerSupabase();

    // Get settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('ar_slack_settings')
      .select('setting_key, setting_value');

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    const settingsMap = new Map(settingsData?.map(s => [s.setting_key, s.setting_value]) || []);
    const settings: ARSlackSettings = {
      weekly_slack_enabled: settingsMap.get('weekly_slack_enabled') === 'true',
      weekly_slack_day: parseInt(settingsMap.get('weekly_slack_day') || '1', 10),
      weekly_slack_hour: parseInt(settingsMap.get('weekly_slack_hour') || '6', 10),
      slack_webhook_url: settingsMap.get('slack_webhook_url') || '',
    };

    // Get last sent info
    const { data: lastSent } = await supabase
      .from('ar_slack_notifications_log')
      .select('*')
      .eq('notification_type', 'weekly_summary')
      .order('sent_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      settings,
      lastSent: lastSent as ARSlackNotificationLog | null,
    });
  } catch (error) {
    console.error('Slack settings API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/slack
 * Update Slack settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only managers and owners can update Slack settings
    const role = (session.user as { role?: string }).role;
    if (!role || !['manager', 'owner'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { weekly_slack_enabled, weekly_slack_day, weekly_slack_hour, slack_webhook_url } = body;

    const supabase = getServerSupabase();

    // Update settings
    const updates: { setting_key: string; setting_value: string }[] = [];

    if (weekly_slack_enabled !== undefined) {
      updates.push({
        setting_key: 'weekly_slack_enabled',
        setting_value: weekly_slack_enabled ? 'true' : 'false',
      });
    }

    if (weekly_slack_day !== undefined) {
      updates.push({
        setting_key: 'weekly_slack_day',
        setting_value: String(weekly_slack_day),
      });
    }

    if (weekly_slack_hour !== undefined) {
      updates.push({
        setting_key: 'weekly_slack_hour',
        setting_value: String(weekly_slack_hour),
      });
    }

    if (slack_webhook_url !== undefined) {
      updates.push({
        setting_key: 'slack_webhook_url',
        setting_value: slack_webhook_url,
      });
    }

    for (const update of updates) {
      const { error } = await supabase
        .from('ar_slack_settings')
        .update({
          setting_value: update.setting_value,
          updated_at: new Date().toISOString(),
        })
        .eq('setting_key', update.setting_key);

      if (error) {
        console.error('Error updating setting:', error);
        return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Slack settings API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
