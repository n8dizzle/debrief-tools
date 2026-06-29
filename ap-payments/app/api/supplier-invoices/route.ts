import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * GET /api/supplier-invoices — imported supplier invoices with their line items.
 * Filters: vendor, start/end (invoice_date), q (PO / invoice / SKU / desc), linked
 * (only/none/all = has a numeric estimate job # or not). Returns invoices + lines so
 * the UI can sum and slice however it wants.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const vendor = searchParams.get('vendor');
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const supabase = getServerSupabase();

  let q = supabase
    .from('ap_supplier_invoices')
    .select(`id, vendor, doc_type, invoice_number, order_number, po_number, estimate_job_number,
             salesperson, ship_to, order_date, invoice_date, due_date,
             merchandise, freight, sales_tax, total_due,
             lines:ap_supplier_invoice_lines(id, line_no, sku, description, uom,
               qty_ordered, qty_shipped, qty_backordered, unit_price, net_amount, is_return)`)
    .order('invoice_date', { ascending: false, nullsFirst: false });
  if (vendor) q = q.eq('vendor', vendor);
  if (start) q = q.gte('invoice_date', start);
  if (end) q = q.lte('invoice_date', end);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Distinct vendors for the filter dropdown.
  const { data: vendorRows } = await supabase.from('ap_supplier_invoices').select('vendor');
  const vendors = Array.from(new Set((vendorRows || []).map((r: any) => r.vendor))).sort();

  return NextResponse.json({ invoices: data || [], vendors });
}
