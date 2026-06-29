import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';
import { parseShearerCsv } from '@/lib/shearer-csv';

/**
 * POST /api/supplier-invoices/upload — import a Shearer CSV (multipart 'file').
 * Upserts by (vendor, invoice_number) and replaces that invoice's lines, so
 * re-uploading the same file never double-counts.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const vendor = (form.get('vendor') as string) || 'Shearer';
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  let invoices;
  try {
    const text = await (file as File).text();
    invoices = parseShearerCsv(text);
  } catch (e) {
    return NextResponse.json({ error: `Could not parse CSV: ${e instanceof Error ? e.message : 'unknown'}` }, { status: 400 });
  }
  if (invoices.length === 0) {
    return NextResponse.json({ error: 'No invoices found in file. Is this a Shearer export?' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  let created = 0, updated = 0, lineCount = 0;
  const errors: string[] = [];

  for (const inv of invoices) {
    try {
      const { data: existing } = await supabase
        .from('ap_supplier_invoices')
        .select('id')
        .eq('vendor', vendor)
        .eq('invoice_number', inv.invoice_number)
        .maybeSingle();

      const payload = {
        vendor,
        doc_type: inv.doc_type || null,
        invoice_number: inv.invoice_number,
        order_number: inv.order_number || null,
        po_number: inv.po_number || null,
        estimate_job_number: inv.estimate_job_number,
        account_number: inv.account_number || null,
        salesperson: inv.salesperson || null,
        ship_to: inv.ship_to || null,
        order_date: inv.order_date,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        merchandise: inv.merchandise,
        freight: inv.freight,
        service_charge: inv.service_charge,
        subtotal: inv.subtotal,
        sales_tax: inv.sales_tax,
        total_due: inv.total_due,
        uploaded_by: session.user.id,
        updated_at: new Date().toISOString(),
      };

      const { data: up, error: upErr } = await supabase
        .from('ap_supplier_invoices')
        .upsert(payload, { onConflict: 'vendor,invoice_number' })
        .select('id')
        .single();
      if (upErr || !up) { errors.push(`${inv.invoice_number}: ${upErr?.message || 'upsert failed'}`); continue; }

      // Replace lines for this invoice.
      await supabase.from('ap_supplier_invoice_lines').delete().eq('invoice_id', up.id);
      if (inv.lines.length > 0) {
        const rows = inv.lines.map(l => ({
          invoice_id: up.id,
          line_no: l.line_no,
          sku: l.sku || null,
          description: l.description || null,
          uom: l.uom || null,
          qty_ordered: l.qty_ordered,
          qty_shipped: l.qty_shipped,
          qty_backordered: l.qty_backordered,
          unit_price: l.unit_price,
          net_amount: l.net_amount,
          is_return: l.is_return,
        }));
        const { error: lErr } = await supabase.from('ap_supplier_invoice_lines').insert(rows);
        if (lErr) errors.push(`${inv.invoice_number} lines: ${lErr.message}`);
        else lineCount += rows.length;
      }
      if (existing) updated++; else created++;
    } catch (e) {
      errors.push(`${inv.invoice_number}: ${e instanceof Error ? e.message : 'error'}`);
    }
  }

  return NextResponse.json({
    invoices: invoices.length, created, updated, lines: lineCount,
    errors: errors.length ? errors : undefined,
  });
}
