import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, ARDashboardStats } from '@/lib/supabase';
import { sendSlackDashboardNotification } from '@/lib/slack';

/**
 * Hourly cron job to check if weekly Slack notification should be sent
 * Runs every hour, checks if current time matches configured schedule
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  try {
    // Get Slack settings
    const { data: settings, error: settingsError } = await supabase
      .from('ar_slack_settings')
      .select('setting_key, setting_value');

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    const settingsMap = new Map(settings?.map(s => [s.setting_key, s.setting_value]) || []);
    const enabled = settingsMap.get('weekly_slack_enabled') === 'true';
    const scheduledDay = parseInt(settingsMap.get('weekly_slack_day') || '1', 10);
    const scheduledHour = parseInt(settingsMap.get('weekly_slack_hour') || '6', 10);
    const webhookUrl = settingsMap.get('slack_webhook_url') || '';

    if (!enabled) {
      return NextResponse.json({ message: 'Weekly Slack notification disabled', skipped: true });
    }

    if (!webhookUrl) {
      return NextResponse.json({ message: 'Slack webhook URL not configured', skipped: true });
    }

    // Get current time in Central Time
    const now = new Date();
    const ctFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long',
      hour: 'numeric',
      hour12: false,
    });
    const parts = ctFormatter.formatToParts(now);
    const currentDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      .indexOf(parts.find(p => p.type === 'weekday')?.value || '');
    const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);

    // Check if it's the right time
    if (currentDay !== scheduledDay || currentHour !== scheduledHour) {
      return NextResponse.json({
        message: 'Not scheduled time',
        skipped: true,
        current: { day: currentDay, hour: currentHour },
        scheduled: { day: scheduledDay, hour: scheduledHour },
      });
    }

    // Check if we already sent today (prevent double-send)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: recentSend } = await supabase
      .from('ar_slack_notifications_log')
      .select('id')
      .eq('notification_type', 'weekly_summary')
      .gte('sent_at', todayStart.toISOString())
      .limit(1);

    if (recentSend && recentSend.length > 0) {
      return NextResponse.json({ message: 'Already sent today', skipped: true });
    }

    // Fetch dashboard data
    const dashboardStats = await fetchDashboardStats(supabase);

    // Send Slack notification
    const result = await sendSlackDashboardNotification(webhookUrl, dashboardStats);

    // Log the result
    await supabase.from('ar_slack_notifications_log').insert({
      notification_type: 'weekly_summary',
      status: result.success ? 'sent' : 'failed',
      error_message: result.error || null,
    });

    if (result.success) {
      return NextResponse.json({ message: 'Weekly Slack notification sent' });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('Cron error:', error);

    // Log the error
    await supabase.from('ar_slack_notifications_log').insert({
      notification_type: 'weekly_summary',
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Fetch dashboard stats directly from database
 */
async function fetchDashboardStats(supabase: ReturnType<typeof getServerSupabase>): Promise<ARDashboardStats> {
  // Get all open invoices with tracking
  const { data: invoices } = await supabase
    .from('ar_invoices')
    .select(`
      *,
      tracking:ar_invoice_tracking(*)
    `)
    .gt('balance', 0)
    .neq('status', 'written_off');

  const total_outstanding = invoices?.reduce((sum, inv) => sum + Number(inv.balance), 0) || 0;

  const ar_collectible = invoices?.filter(inv =>
    inv.tracking?.control_bucket !== 'ar_not_in_our_control'
  ).reduce((sum, inv) => sum + Number(inv.balance), 0) || 0;

  const ar_not_in_control = total_outstanding - ar_collectible;

  const aging_buckets = {
    current: invoices?.filter(inv => inv.aging_bucket === 'current')
      .reduce((sum, inv) => sum + Number(inv.balance), 0) || 0,
    bucket_30: invoices?.filter(inv => inv.aging_bucket === '30')
      .reduce((sum, inv) => sum + Number(inv.balance), 0) || 0,
    bucket_60: invoices?.filter(inv => inv.aging_bucket === '60')
      .reduce((sum, inv) => sum + Number(inv.balance), 0) || 0,
    bucket_90_plus: invoices?.filter(inv => inv.aging_bucket === '90+')
      .reduce((sum, inv) => sum + Number(inv.balance), 0) || 0,
  };

  const install_total = invoices?.filter(inv => inv.job_type === 'install')
    .reduce((sum, inv) => sum + Number(inv.balance), 0) || 0;
  const service_total = invoices?.filter(inv => inv.job_type === 'service')
    .reduce((sum, inv) => sum + Number(inv.balance), 0) || 0;

  const residential_total = invoices?.filter(inv => inv.customer_type === 'residential')
    .reduce((sum, inv) => sum + Number(inv.balance), 0) || 0;
  const commercial_total = invoices?.filter(inv => inv.customer_type === 'commercial')
    .reduce((sum, inv) => sum + Number(inv.balance), 0) || 0;

  // Business unit totals
  const businessUnitMap = new Map<string, number>();
  for (const inv of invoices || []) {
    const buName = inv.business_unit_name || 'Unknown';
    const current = businessUnitMap.get(buName) || 0;
    businessUnitMap.set(buName, current + Number(inv.balance));
  }
  const business_unit_totals = Array.from(businessUnitMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  // Top lists
  const top_balances = [...(invoices || [])]
    .sort((a, b) => Number(b.balance) - Number(a.balance))
    .slice(0, 10);

  const top_oldest = [...(invoices || [])]
    .sort((a, b) => Number(b.days_outstanding) - Number(a.days_outstanding))
    .slice(0, 5);

  const top_90_plus = [...(invoices || [])]
    .filter(inv => inv.aging_bucket === '90+')
    .sort((a, b) => Number(b.balance) - Number(a.balance))
    .slice(0, 5);

  const top_recent = [...(invoices || [])]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  // Recent notes
  const { data: recentNotes } = await supabase
    .from('ar_collection_notes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  // Calculate average DSO
  const avg_dso = invoices && invoices.length > 0
    ? Math.round(invoices.reduce((sum, inv) => sum + (inv.days_outstanding || 0), 0) / invoices.length)
    : 0;

  return {
    total_outstanding,
    ar_collectible,
    ar_not_in_control,
    avg_invoice_age: avg_dso,
    actionable_ar_avg_age: 0,
    pending_closures_avg_age: 0,
    true_dso: 0,
    true_dso_period_days: 30,
    true_dso_revenue: 0,
    aging_buckets,
    install_total,
    service_total,
    residential_total,
    commercial_total,
    inhouse_financing_total: 0,
    inhouse_financing_count: 0,
    inhouse_financing_delinquent: 0,
    business_unit_totals,
    job_status_totals: [],
    top_balances,
    top_oldest,
    top_90_plus,
    top_recent,
    recent_activity: recentNotes || [],
    last_sync_at: null,
  };
}
