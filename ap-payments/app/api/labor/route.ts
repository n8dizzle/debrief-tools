import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import type { APLaborStats, APLaborMonthly } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const trade = searchParams.get('trade');

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end params required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  try {
    // Build job query with filters
    let jobQuery = supabase
      .from('ap_install_jobs')
      .select('id, assignment_type, job_total, payment_amount, labor_hours, labor_cost, technician_id, st_technician_id, scheduled_date, completed_date, trade, is_ignored')
      .eq('is_ignored', false);

    if (trade) {
      jobQuery = jobQuery.eq('trade', trade);
    }

    // Filter by date range (use completed_date, fall back to scheduled_date)
    jobQuery = jobQuery.or(`completed_date.gte.${start},scheduled_date.gte.${start}`)
      .or(`completed_date.lte.${end},scheduled_date.lte.${end}`);

    const { data: jobs } = await jobQuery;

    // Filter jobs to those actually in the date range
    const filteredJobs = (jobs || []).filter(j => {
      const jobDate = j.completed_date || j.scheduled_date;
      if (!jobDate) return false;
      return jobDate >= start && jobDate <= end;
    });

    // Get technician rates for in-house labor calculation (HVAC Install only)
    const { data: techs } = await supabase
      .from('ap_technicians')
      .select('id, hourly_rate, is_active')
      .eq('business_unit_id', 610);

    const techRateMap = new Map(
      (techs || []).map(t => [t.id, t.hourly_rate as number | null])
    );

    // Get overhead entries for months in range
    const startMonth = start.substring(0, 7);
    const endMonth = end.substring(0, 7);
    const { data: overheads } = await supabase
      .from('ap_labor_overheads')
      .select('month, amount')
      .gte('month', startMonth)
      .lte('month', endMonth);

    const overheadMap = new Map(
      (overheads || []).map(o => [o.month, Number(o.amount)])
    );

    // Calculate stats
    let totalRevenue = 0;
    let contractorLabor = 0;
    let inHouseLabor = 0;
    let jobsMissingHours = 0;

    // Monthly buckets
    const monthlyMap = new Map<string, {
      revenue: number;
      contractor_labor: number;
      in_house_labor: number;
      job_count: number;
      contractor_count: number;
      in_house_count: number;
    }>();

    for (const job of filteredJobs) {
      const jobDate = job.completed_date || job.scheduled_date;
      const month = jobDate ? jobDate.substring(0, 7) : null;
      const revenue = Number(job.job_total) || 0;

      totalRevenue += revenue;

      if (!month) continue;

      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          revenue: 0, contractor_labor: 0, in_house_labor: 0,
          job_count: 0, contractor_count: 0, in_house_count: 0,
        });
      }
      const m = monthlyMap.get(month)!;
      m.revenue += revenue;
      m.job_count++;

      if (job.assignment_type === 'contractor') {
        const pay = Number(job.payment_amount) || 0;
        contractorLabor += pay;
        m.contractor_labor += pay;
        m.contractor_count++;
      } else if (job.assignment_type === 'in_house') {
        // Use stored labor_cost if available, otherwise compute
        let cost = Number(job.labor_cost) || 0;
        if (!cost && job.labor_hours && job.technician_id) {
          const rate = techRateMap.get(job.technician_id);
          if (rate) {
            cost = Number(job.labor_hours) * rate;
          }
        }
        if (!cost && job.labor_hours == null) {
          jobsMissingHours++;
        }
        inHouseLabor += cost;
        m.in_house_labor += cost;
        m.in_house_count++;
      }
    }

    // Sum overhead for the range
    let overheadCost = 0;
    for (const [, amount] of overheadMap) {
      overheadCost += amount;
    }

    const totalLaborCost = contractorLabor + inHouseLabor + overheadCost;
    const laborPct = totalRevenue > 0 ? Math.round((totalLaborCost / totalRevenue) * 1000) / 10 : 0;

    // Count techs missing rates
    const activeTechsMissingRates = (techs || []).filter(t => t.is_active && !t.hourly_rate).length;

    // Build monthly breakdown
    const months = Array.from(monthlyMap.keys()).sort();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const monthlyBreakdown: APLaborMonthly[] = months.map(month => {
      const m = monthlyMap.get(month)!;
      const overhead = overheadMap.get(month) || 0;
      const totalLabor = m.contractor_labor + m.in_house_labor + overhead;
      const pct = m.revenue > 0 ? Math.round((totalLabor / m.revenue) * 1000) / 10 : 0;
      const [yearStr, monthStr] = month.split('-');
      const monthIdx = parseInt(monthStr) - 1;
      const label = `${monthNames[monthIdx]} ${yearStr.slice(-2)}`;

      return {
        month,
        label,
        revenue: Math.round(m.revenue * 100) / 100,
        contractor_labor: Math.round(m.contractor_labor * 100) / 100,
        in_house_labor: Math.round(m.in_house_labor * 100) / 100,
        overhead,
        total_labor: Math.round(totalLabor * 100) / 100,
        labor_pct: pct,
        job_count: m.job_count,
        contractor_count: m.contractor_count,
        in_house_count: m.in_house_count,
      };
    });

    const result: APLaborStats = {
      total_revenue: Math.round(totalRevenue * 100) / 100,
      contractor_labor_cost: Math.round(contractorLabor * 100) / 100,
      in_house_labor_cost: Math.round(inHouseLabor * 100) / 100,
      overhead_cost: overheadCost,
      total_labor_cost: Math.round(totalLaborCost * 100) / 100,
      labor_pct: laborPct,
      goal_pct: 9.5,
      monthly_breakdown: monthlyBreakdown,
      jobs_missing_hours: jobsMissingHours,
      techs_missing_rates: activeTechsMissingRates,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Labor stats error:', error);
    return NextResponse.json({ error: 'Failed to calculate labor stats' }, { status: 500 });
  }
}
