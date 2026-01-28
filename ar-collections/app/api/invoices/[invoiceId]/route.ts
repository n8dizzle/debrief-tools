import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceId } = await params;
    const supabase = getServerSupabase();

    // Get invoice with tracking
    const { data: invoice, error: invoiceError } = await supabase
      .from('ar_invoices')
      .select(`
        *,
        tracking:ar_invoice_tracking(*)
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get customer ST ID for linking
    let stCustomerId = null;
    if (invoice.customer_id) {
      const { data: customer } = await supabase
        .from('ar_customers')
        .select('st_customer_id')
        .eq('id', invoice.customer_id)
        .single();
      stCustomerId = customer?.st_customer_id || null;
    }

    // Get notes for this invoice
    const { data: notes } = await supabase
      .from('ar_collection_notes')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });

    // Get payments for this invoice
    const { data: payments } = await supabase
      .from('ar_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: false });

    return NextResponse.json({
      ...invoice,
      st_customer_id: stCustomerId,
      notes: notes || [],
      payments: payments || [],
    });
  } catch (error) {
    console.error('Invoice detail API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
