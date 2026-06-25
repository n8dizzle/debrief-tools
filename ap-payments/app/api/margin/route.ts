import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission, formatCurrency } from '@/lib/ap-utils';
import { computeAdjustedMargin, CostAdjustment, MarginJobInput } from '@/lib/margin';

/**
 * GET /api/margin — install-job gross margin grid for a period.
 *
 * Revenue + cost buckets come from ServiceTitan report data cached on ap_install_jobs
 * (st_revenue, st_*_cost). The contractor payment is layered in at read time (computeAdjustedMargin),
 * plus any manual ap_cost_adjustments. Jobs whose costs haven't synced yet return cost_status
 * 'pending' and a null margin (never a zero-cost inflated number).
 *
 * Query params: start, end (completed_date range), trade, contractor_id, group_by
 * (none|trade|contractor|job_type), include_zero_revenue (default false), format (json|csv).
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasAPPermission(session, 'can_view_margin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const trade = searchParams.get('trade');
  const contractorId = searchParams.get('contractor_id');
  const groupBy = searchParams.get('group_by') || 'none';
  const includeZeroRevenue = searchParams.get('include_zero_revenue') === 'true';
  const format = searchParams.get('format') || 'json';

  const supabase = getServerSupabase();

  let query = supabase
    .from('ap_install_jobs')
    .select(
      `
      id, job_number, customer_name, trade, job_type_name, assignment_type,
      payment_amount, completed_date, contractor_id,
      st_revenue, st_equipment_cost, st_material_cost, st_labor_cost,
      st_total_cost, st_gross_margin, st_gross_margin_pct, costs_synced_at,
      contractor:ap_contractors(name)
    `
    )
    .neq('job_status', 'Canceled')
    .or('is_ignored.is.null,is_ignored.eq.false')
    .order('completed_date', { ascending: false });

  if (start) query = query.gte('completed_date', start);
  if (end) query = query.lte('completed_date', end);
  if (trade) query = query.eq('trade', trade);
  if (contractorId) query = query.eq('contractor_id', contractorId);

  const { data: jobs, error } = await query;
  if (error) {
    console.error('Margin query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const jobRows = jobs || [];
  const jobIds = jobRows.map((j: any) => j.id);

  // One query for all active adjustments across the period's jobs (no N+1).
  const adjByJob = new Map<string, CostAdjustment[]>();
  const adjDetailByJob = new Map<string, any[]>();
  if (jobIds.length > 0) {
    const { data: adjustments } = await supabase
      .from('ap_cost_adjustments')
      .select('id, job_id, bucket, amount, label, source, note, created_at')
      .in('job_id', jobIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    for (const a of adjustments || []) {
      const list = adjByJob.get(a.job_id) || [];
      list.push({ bucket: a.bucket, amount: Number(a.amount) });
      adjByJob.set(a.job_id, list);
      const dlist = adjDetailByJob.get(a.job_id) || [];
      dlist.push(a);
      adjDetailByJob.set(a.job_id, dlist);
    }
  }

  const groupKey = (j: any): string => {
    switch (groupBy) {
      case 'trade':
        return j.trade || '—';
      case 'contractor':
        return j.contractor?.name || (j.assignment_type === 'in_house' ? 'In-House' : 'Unassigned');
      case 'job_type':
        return j.job_type_name || '—';
      default:
        return '';
    }
  };

  const rows = jobRows
    .map((j: any) => {
      const input: MarginJobInput = {
        assignment_type: j.assignment_type,
        payment_amount: j.payment_amount != null ? Number(j.payment_amount) : null,
        st_revenue: j.st_revenue != null ? Number(j.st_revenue) : null,
        st_equipment_cost: j.st_equipment_cost != null ? Number(j.st_equipment_cost) : null,
        st_material_cost: j.st_material_cost != null ? Number(j.st_material_cost) : null,
        st_labor_cost: j.st_labor_cost != null ? Number(j.st_labor_cost) : null,
        st_total_cost: j.st_total_cost != null ? Number(j.st_total_cost) : null,
        st_gross_margin: j.st_gross_margin != null ? Number(j.st_gross_margin) : null,
        st_gross_margin_pct: j.st_gross_margin_pct != null ? Number(j.st_gross_margin_pct) : null,
        costs_synced_at: j.costs_synced_at,
      };
      const m = computeAdjustedMargin(input, adjByJob.get(j.id) || []);
      return {
        id: j.id,
        job_number: j.job_number,
        customer_name: j.customer_name,
        trade: j.trade,
        job_type: j.job_type_name,
        assignment_type: j.assignment_type,
        contractor_name: j.contractor?.name || null,
        completed_date: j.completed_date,
        group: groupKey(j),
        cost_status: m.hasCostData ? 'synced' : 'pending',
        ...m,
        adjustments: adjDetailByJob.get(j.id) || [],
      };
    })
    .filter((r) => includeZeroRevenue || r.cost_status === 'pending' || (r.revenue ?? 0) > 0);

  // Summary over rows that actually have cost data + revenue.
  const priced = rows.filter((r) => r.cost_status === 'synced' && (r.revenue ?? 0) > 0);
  const totalRevenue = priced.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalAdjCost = priced.reduce((s, r) => s + (r.adjustedTotalCost || 0), 0);
  const totalAdjGM = totalRevenue - totalAdjCost;
  const summary = {
    job_count: rows.length,
    priced_count: priced.length,
    pending_count: rows.filter((r) => r.cost_status === 'pending').length,
    total_revenue: totalRevenue,
    total_adjusted_cost: totalAdjCost,
    total_adjusted_gross_margin: totalAdjGM,
    avg_adjusted_gm_pct: totalRevenue > 0 ? totalAdjGM / totalRevenue : null,
  };

  if (format === 'csv') {
    const headers = [
      'Job #', 'Customer', 'Trade', 'Job Type', 'Assignment', 'Contractor', 'Completed',
      'Group', 'Revenue', 'Equipment', 'Material', 'Labor', 'Other ST', 'Soft Cost', 'Overhead',
      'Contractor Labor', 'Adjusted Total Cost', 'Adjusted GM $', 'Adjusted GM %',
      'ST GM $', 'ST GM %', 'Cost Status',
    ];
    const csvRows = rows.map((r) =>
      [
        r.job_number,
        `"${(r.customer_name || '').replace(/"/g, '""')}"`,
        r.trade,
        `"${(r.job_type || '').replace(/"/g, '""')}"`,
        r.assignment_type,
        `"${(r.contractor_name || '').replace(/"/g, '""')}"`,
        r.completed_date || '',
        `"${(r.group || '').replace(/"/g, '""')}"`,
        r.revenue ?? '',
        r.equipmentCost,
        r.materialCost,
        r.laborCost,
        r.stOtherCost,
        r.softCost,
        r.overheadCost,
        r.contractorLabor,
        r.adjustedTotalCost ?? '',
        r.adjustedGrossMargin ?? '',
        r.adjustedGrossMarginPct != null ? (r.adjustedGrossMarginPct * 100).toFixed(2) : '',
        r.stGrossMargin ?? '',
        r.stGrossMarginPct != null ? (r.stGrossMarginPct * 100).toFixed(2) : '',
        r.cost_status,
      ].join(',')
    );
    const csv = [headers.join(','), ...csvRows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="ap-margin-${start || 'all'}-to-${end || 'all'}.csv"`,
      },
    });
  }

  return NextResponse.json({ rows, summary });
}
