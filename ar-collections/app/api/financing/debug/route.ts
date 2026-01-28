import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();

    // Get financing invoices
    const { data: invoices } = await supabase
      .from('ar_invoices')
      .select('id, st_invoice_id, invoice_number, customer_id')
      .eq('has_inhouse_financing', true)
      .limit(10);

    // Get all payments (limit 20)
    const { data: payments } = await supabase
      .from('ar_payments')
      .select('id, st_payment_id, invoice_id, amount, payment_date')
      .order('created_at', { ascending: false })
      .limit(20);

    // Check if any payments match financing invoice IDs
    const invoiceIds = new Set((invoices || []).map(i => i.id));
    const matchingPayments = (payments || []).filter(p => invoiceIds.has(p.invoice_id));

    return NextResponse.json({
      financing_invoices: invoices?.map(i => ({
        id: i.id,
        st_invoice_id: i.st_invoice_id,
        invoice_number: i.invoice_number,
        has_customer: !!i.customer_id,
      })),
      recent_payments: payments?.map(p => ({
        id: p.id,
        st_payment_id: p.st_payment_id,
        invoice_id: p.invoice_id,
        amount: p.amount,
        payment_date: p.payment_date,
      })),
      matching_payments_count: matchingPayments.length,
      total_payments_in_db: payments?.length || 0,
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: 'Debug failed' }, { status: 500 });
  }
}
