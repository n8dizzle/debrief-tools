import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { hasAPPermission } from '@/lib/ap-utils';
import { skuMatch } from '@/lib/shearer-csv';

/**
 * GET /api/supplier-invoices/validate?start&end — validate job-linked Shearer invoices
 * against the ServiceTitan estimate's equipment cost. For each invoice whose PO is a
 * numeric estimate job #, compares Shearer's actual cost to ST's listed equipment cost
 * (estimate item totalCost), at the PO total level and line-by-line (matched by SKU).
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const supabase = getServerSupabase();

  let q = supabase
    .from('ap_supplier_invoices')
    .select(`id, vendor, invoice_number, estimate_job_number, invoice_date, merchandise,
             lines:ap_supplier_invoice_lines(sku, description, qty_shipped, net_amount, is_return)`)
    .not('estimate_job_number', 'is', null)
    .order('invoice_date', { ascending: false, nullsFirst: false });
  if (start) q = q.gte('invoice_date', start);
  if (end) q = q.lte('invoice_date', end);
  const { data: invoices, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invoices || invoices.length === 0) return NextResponse.json({ rows: [] });

  const st = getServiceTitanClient();
  if (!st.isConfigured()) return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });

  const jobNos = Array.from(new Set(invoices.map((i: any) => i.estimate_job_number)));
  const estByJob = await st.getEstimateEquipmentByJob(jobNos);

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const rows = invoices.map((inv: any) => {
    const est = estByJob.get(inv.estimate_job_number);
    // Shearer side: equipment-ish lines (exclude returns from the cost-to-validate total
    // but keep them visible). Use net_amount as actual cost.
    const shearerLines = (inv.lines || []).map((l: any) => ({
      sku: l.sku, description: l.description, qty: l.qty_shipped,
      cost: Number(l.net_amount || 0), is_return: l.is_return,
    }));
    const shearerTotal = r2(shearerLines.reduce((s: number, l: any) => s + l.cost, 0));

    const estLines = (est?.lines || []).map((l: any) => ({ ...l }));
    const stTotal = est ? est.equipment_cost : null;

    // Line match: each Shearer line ↔ ST equipment line by SKU.
    const matched: any[] = [];
    const usedEst = new Set<number>();
    for (const sl of shearerLines) {
      const j = estLines.findIndex((el: any, idx: number) => !usedEst.has(idx) && skuMatch(sl.sku, el.sku));
      if (j >= 0) {
        usedEst.add(j);
        const el = estLines[j];
        matched.push({ sku: sl.sku, description: sl.description || el.name,
          shearer_cost: sl.cost, st_cost: r2(el.total_cost), variance: r2(sl.cost - el.total_cost),
          is_return: sl.is_return });
      } else {
        matched.push({ sku: sl.sku, description: sl.description, shearer_cost: sl.cost, st_cost: null, variance: null, is_return: sl.is_return, only: 'shearer' });
      }
    }
    estLines.forEach((el: any, idx: number) => {
      if (!usedEst.has(idx)) matched.push({ sku: el.sku, description: el.name, shearer_cost: null, st_cost: r2(el.total_cost), variance: null, only: 'st' });
    });

    return {
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      estimate_job_number: inv.estimate_job_number,
      invoice_date: inv.invoice_date,
      shearer_total: shearerTotal,
      st_total: stTotal,
      st_status: est?.status ?? null,
      st_estimate_id: est?.estimate_id ?? null,
      variance: stTotal != null ? r2(shearerTotal - stTotal) : null,
      matched_to_st: !!est,
      lines: matched,
    };
  });

  return NextResponse.json({ rows });
}
