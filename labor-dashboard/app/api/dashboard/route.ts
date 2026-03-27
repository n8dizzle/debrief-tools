import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const url = new URL(request.url);
  const startDate = url.searchParams.get('start');
  const endDate = url.searchParams.get('end');
  const trade = url.searchParams.get('trade'); // 'hvac' | 'plumbing' | null (all)

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start and end date required' }, { status: 400 });
  }

  try {
    // Build query for gross pay items in date range
    let query = supabase
      .from('labor_gross_pay_items')
      .select('amount, paid_duration_hours, paid_time_type, gross_pay_item_type, activity, date, job_id, trade')
      .gte('date', startDate)
      .lte('date', endDate);

    if (trade) {
      query = query.eq('trade', trade);
    }

    const { data: items, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Compute stats
    let totalPayroll = 0;
    let hourlyPay = 0;
    let overtimePay = 0;
    let commissions = 0;
    let nonJobTimeCost = 0;

    // Monthly aggregation
    const monthlyMap = new Map<string, {
      hourly: number;
      overtime: number;
      commission: number;
      nonJob: number;
    }>();

    // Non-job time breakdown by activity
    const activityMap = new Map<string, number>();

    for (const item of items || []) {
      const amount = Number(item.amount) || 0;
      totalPayroll += amount;

      const type = item.gross_pay_item_type || '';
      const paidTimeType = item.paid_time_type || '';
      const activity = item.activity || 'Unknown';
      const isJobRelated = !!item.job_id;

      // Classify the pay item
      if (type === 'TimesheetTime' || type === 'Timesheet') {
        if (paidTimeType === 'Overtime') {
          overtimePay += amount;
        } else {
          hourlyPay += amount;
        }

        // Non-job time tracking
        if (!isJobRelated) {
          nonJobTimeCost += amount;
          activityMap.set(activity, (activityMap.get(activity) || 0) + amount);
        }
      } else {
        // InvoiceRelatedBonus, Bonus, Commission, etc.
        commissions += amount;
      }

      // Monthly aggregation
      const month = item.date ? item.date.substring(0, 7) : 'unknown';
      if (month !== 'unknown') {
        const existing = monthlyMap.get(month) || { hourly: 0, overtime: 0, commission: 0, nonJob: 0 };

        if (type === 'TimesheetTime' || type === 'Timesheet') {
          if (paidTimeType === 'Overtime') {
            existing.overtime += amount;
          } else {
            existing.hourly += amount;
          }
          if (!isJobRelated) {
            existing.nonJob += amount;
          }
        } else {
          existing.commission += amount;
        }

        monthlyMap.set(month, existing);
      }
    }

    // Sort months and format
    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month,
        hourly: Math.round(data.hourly * 100) / 100,
        overtime: Math.round(data.overtime * 100) / 100,
        commission: Math.round(data.commission * 100) / 100,
        nonJob: Math.round(data.nonJob * 100) / 100,
        total: Math.round((data.hourly + data.overtime + data.commission) * 100) / 100,
      }));

    // Sort activities by cost (descending)
    const nonJobBreakdown = Array.from(activityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([activity, cost]) => ({
        activity,
        cost: Math.round(cost * 100) / 100,
      }));

    // Get last sync time
    const { data: lastSync } = await supabase
      .from('labor_sync_log')
      .select('completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      stats: {
        totalPayroll: Math.round(totalPayroll * 100) / 100,
        hourlyPay: Math.round(hourlyPay * 100) / 100,
        overtimePay: Math.round(overtimePay * 100) / 100,
        commissions: Math.round(commissions * 100) / 100,
        nonJobTimeCost: Math.round(nonJobTimeCost * 100) / 100,
      },
      monthlyTrend,
      nonJobBreakdown,
      lastSync: lastSync?.completed_at || null,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
