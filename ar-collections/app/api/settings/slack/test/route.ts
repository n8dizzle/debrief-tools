import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, ARDashboardStats } from '@/lib/supabase';
import { sendSlackDashboardNotification } from '@/lib/slack';

/**
 * POST /api/settings/slack/test
 * Send a test Slack notification
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only managers and owners can send test notifications
    const role = (session.user as { role?: string }).role;
    if (!role || !['manager', 'owner'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServerSupabase();

    // Get webhook URL
    const { data: settingsData } = await supabase
      .from('ar_slack_settings')
      .select('setting_value')
      .eq('setting_key', 'slack_webhook_url')
      .single();

    const webhookUrl = settingsData?.setting_value || '';

    if (!webhookUrl) {
      return NextResponse.json({ error: 'Slack webhook URL not configured' }, { status: 400 });
    }

    // Fetch dashboard stats
    const dashboardStats = await fetchDashboardStats(supabase);

    // Send test notification
    const result = await sendSlackDashboardNotification(webhookUrl, dashboardStats, true);

    if (result.success) {
      return NextResponse.json({ message: 'Test notification sent to Slack' });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('Test Slack API error:', error);
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
    avg_dso,
    aging_buckets,
    install_total,
    service_total,
    residential_total,
    commercial_total,
    inhouse_financing_total: 0,
    inhouse_financing_count: 0,
    inhouse_financing_delinquent: 0,
    business_unit_totals,
    top_balances,
    top_oldest,
    top_90_plus,
    top_recent,
    recent_activity: recentNotes || [],
  };
}
