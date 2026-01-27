import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { ARDashboardStats } from '@/lib/supabase';
import { calculateAverageDSO } from '@/lib/ar-utils';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();

    // Get all open invoices with tracking data
    const { data: invoices, error: invoicesError } = await supabase
      .from('ar_invoices')
      .select(`
        *,
        tracking:ar_invoice_tracking(*)
      `)
      .gt('balance', 0)
      .neq('status', 'written_off');

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }

    // Calculate totals
    const total_outstanding = invoices?.reduce((sum, inv) => sum + Number(inv.balance), 0) || 0;

    // Calculate AR collectible vs not in control
    const ar_collectible = invoices?.filter(inv =>
      inv.tracking?.control_bucket !== 'ar_not_in_our_control'
    ).reduce((sum, inv) => sum + Number(inv.balance), 0) || 0;

    const ar_not_in_control = total_outstanding - ar_collectible;

    // Calculate aging buckets
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

    // Calculate install vs service totals
    const install_total = invoices?.filter(inv => inv.job_type === 'install')
      .reduce((sum, inv) => sum + Number(inv.balance), 0) || 0;
    const service_total = invoices?.filter(inv => inv.job_type === 'service')
      .reduce((sum, inv) => sum + Number(inv.balance), 0) || 0;

    // Calculate residential vs commercial totals
    const residential_total = invoices?.filter(inv => inv.customer_type === 'residential')
      .reduce((sum, inv) => sum + Number(inv.balance), 0) || 0;
    const commercial_total = invoices?.filter(inv => inv.customer_type === 'commercial')
      .reduce((sum, inv) => sum + Number(inv.balance), 0) || 0;

    // Calculate average DSO
    const avg_dso = invoices ? calculateAverageDSO(invoices.map(inv => ({
      days_outstanding: inv.days_outstanding
    }))) : 0;

    // Get top 5 balances
    const top_balances = [...(invoices || [])]
      .sort((a, b) => Number(b.balance) - Number(a.balance))
      .slice(0, 5);

    // Get recent activity (notes)
    const { data: recentNotes, error: notesError } = await supabase
      .from('ar_collection_notes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (notesError) {
      console.error('Error fetching notes:', notesError);
    }

    const stats: ARDashboardStats = {
      total_outstanding,
      ar_collectible,
      ar_not_in_control,
      avg_dso,
      aging_buckets,
      install_total,
      service_total,
      residential_total,
      commercial_total,
      top_balances,
      recent_activity: recentNotes || [],
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
