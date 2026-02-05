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

    const { searchParams } = new URL(request.url);
    const excludeFinancing = searchParams.get('excludeFinancing') === 'true';

    const supabase = getServerSupabase();

    // Get all open invoices with tracking data
    let query = supabase
      .from('ar_invoices')
      .select(`
        *,
        tracking:ar_invoice_tracking(*)
      `)
      .gt('balance', 0)
      .neq('status', 'written_off');

    // Exclude in-house financing invoices if requested
    if (excludeFinancing) {
      query = query.or('has_inhouse_financing.is.null,has_inhouse_financing.eq.false');
    }

    const { data: invoices, error: invoicesError } = await query;

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

    // Calculate in-house financing stats (always from full dataset, not affected by excludeFinancing toggle)
    const { data: allFinancingInvoices } = await supabase
      .from('ar_invoices')
      .select('id, balance')
      .eq('has_inhouse_financing', true)
      .gt('balance', 0)
      .neq('status', 'written_off');

    const financingInvoiceIds = allFinancingInvoices?.map(inv => inv.id) || [];
    const inhouse_financing_total = allFinancingInvoices?.reduce((sum, inv) => sum + Number(inv.balance), 0) || 0;
    const inhouse_financing_count = allFinancingInvoices?.length || 0;

    // Get tracking data for monthly amounts
    const { data: trackingData } = financingInvoiceIds.length > 0
      ? await supabase
          .from('ar_invoice_tracking')
          .select('invoice_id, financing_monthly_amount')
          .in('invoice_id', financingInvoiceIds)
      : { data: [] };

    const monthlyAmountMap = new Map<string, number>();
    for (const t of trackingData || []) {
      if (t.financing_monthly_amount) {
        monthlyAmountMap.set(t.invoice_id, t.financing_monthly_amount);
      }
    }

    // Get missed payment counts from schedule
    const { data: scheduleData } = financingInvoiceIds.length > 0
      ? await supabase
          .from('ar_financing_payments')
          .select('invoice_id, status')
          .in('invoice_id', financingInvoiceIds)
          .eq('status', 'missed')
      : { data: [] };

    // Count missed payments per invoice and calculate delinquent amount
    const missedCountMap = new Map<string, number>();
    for (const entry of scheduleData || []) {
      if (!entry.invoice_id) continue;
      const current = missedCountMap.get(entry.invoice_id) || 0;
      missedCountMap.set(entry.invoice_id, current + 1);
    }

    // Calculate delinquent amount: missed payments × monthly amount for each invoice
    let inhouse_financing_delinquent = 0;
    for (const [invoiceId, missedCount] of missedCountMap) {
      const monthlyAmount = monthlyAmountMap.get(invoiceId) || 0;
      inhouse_financing_delinquent += missedCount * monthlyAmount;
    }

    // Calculate business unit totals
    const businessUnitMap = new Map<string, number>();
    for (const inv of invoices || []) {
      const buName = inv.business_unit_name || 'Unknown';
      const current = businessUnitMap.get(buName) || 0;
      businessUnitMap.set(buName, current + Number(inv.balance));
    }
    const business_unit_totals = Array.from(businessUnitMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    // Calculate average DSO
    const avg_dso = invoices ? calculateAverageDSO(invoices.map(inv => ({
      days_outstanding: inv.days_outstanding
    }))) : 0;

    // Get top 5 lists
    const top_balances = [...(invoices || [])]
      .sort((a, b) => Number(b.balance) - Number(a.balance))
      .slice(0, 5);

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

    // Get recent activity (notes)
    const { data: recentNotes, error: notesError } = await supabase
      .from('ar_collection_notes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (notesError) {
      console.error('Error fetching notes:', notesError);
    }

    // Get last successful sync date
    const { data: lastSync } = await supabase
      .from('ar_sync_log')
      .select('completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

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
      inhouse_financing_total,
      inhouse_financing_count,
      inhouse_financing_delinquent,
      business_unit_totals,
      top_balances,
      top_oldest,
      top_90_plus,
      top_recent,
      recent_activity: recentNotes || [],
      last_sync_at: lastSync?.completed_at || null,
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
