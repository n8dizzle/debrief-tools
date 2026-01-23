import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId } = params;
    const supabase = getServerSupabase();

    // Get customer
    const { data: customer, error: customerError } = await supabase
      .from('ar_customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get invoices
    const { data: invoices } = await supabase
      .from('ar_invoices')
      .select('*')
      .eq('customer_id', customerId)
      .gt('balance', 0)
      .order('invoice_date', { ascending: false });

    // Get payments
    const { data: payments } = await supabase
      .from('ar_payments')
      .select('*')
      .eq('customer_id', customerId)
      .order('payment_date', { ascending: false });

    // Get tasks
    const { data: tasks } = await supabase
      .from('ar_collection_tasks')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    // Get notes
    const { data: notes } = await supabase
      .from('ar_collection_notes')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      ...customer,
      invoices: invoices || [],
      payments: payments || [],
      tasks: tasks || [],
      notes: notes || [],
    });
  } catch (error) {
    console.error('Customer detail API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
