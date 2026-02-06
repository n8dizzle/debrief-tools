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

    const { searchParams } = new URL(request.url);
    const jobType = searchParams.get('job_type');
    const status = searchParams.get('status');
    const agingBucket = searchParams.get('aging_bucket');
    const ownerId = searchParams.get('owner_id');
    const controlBucket = searchParams.get('control_bucket');
    const invoiceType = searchParams.get('invoice_type'); // 'membership' | 'service' | null (all)

    const supabase = getServerSupabase();

    let query = supabase
      .from('ar_invoices')
      .select(`
        *,
        tracking:ar_invoice_tracking(*)
      `)
      .gt('balance', 0)
      .neq('status', 'written_off')
      .order('balance', { ascending: false });

    if (jobType) {
      query = query.eq('job_type', jobType);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (agingBucket) {
      query = query.eq('aging_bucket', agingBucket);
    }
    if (invoiceType === 'membership') {
      query = query.eq('is_membership_invoice', true);
    } else if (invoiceType === 'service') {
      query = query.eq('is_membership_invoice', false);
    }

    const { data: invoices, error } = await query;

    if (error) {
      console.error('Error fetching invoices:', error);
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }

    // Fetch customer ST IDs for linking
    const customerIds = [...new Set((invoices || []).map(inv => inv.customer_id).filter(Boolean))];
    let customerMap = new Map<string, number>();

    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('ar_customers')
        .select('id, st_customer_id')
        .in('id', customerIds);

      for (const cust of customers || []) {
        if (cust.st_customer_id) {
          customerMap.set(cust.id, cust.st_customer_id);
        }
      }
    }

    // Merge customer ST IDs into invoices
    let filteredInvoices = (invoices || []).map(inv => ({
      ...inv,
      st_customer_id: inv.customer_id ? customerMap.get(inv.customer_id) || null : null,
    }));
    if (ownerId) {
      filteredInvoices = filteredInvoices.filter(inv =>
        inv.tracking?.owner_id === ownerId
      );
    }
    if (controlBucket) {
      filteredInvoices = filteredInvoices.filter(inv =>
        inv.tracking?.control_bucket === controlBucket
      );
    }

    return NextResponse.json({ invoices: filteredInvoices });
  } catch (error) {
    console.error('Invoices API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
