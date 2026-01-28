import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, FinancingInvoice } from '@/lib/supabase';
import {
  getNextDueDate,
  getProjectedPayoffDate,
  getPaymentsRemaining,
} from '@/lib/financing-utils';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') || 'active'; // active, paid, all
    const search = searchParams.get('search') || '';

    // Fetch all invoices with in-house financing flag
    let query = supabase
      .from('ar_invoices')
      .select(`
        id,
        st_invoice_id,
        invoice_number,
        customer_id,
        customer_name,
        invoice_total,
        balance,
        amount_paid,
        invoice_date
      `)
      .eq('has_inhouse_financing', true)
      .order('invoice_date', { ascending: false });

    // Apply status filter
    if (status === 'active') {
      query = query.gt('balance', 0);
    } else if (status === 'paid') {
      query = query.lte('balance', 0);
    }

    // Apply search filter
    if (search) {
      query = query.or(`invoice_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
    }

    const { data: invoices, error: invoicesError } = await query;

    if (invoicesError) {
      console.error('Error fetching financing invoices:', invoicesError);
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({
        invoices: [],
        summary: {
          total_outstanding: 0,
          active_plans: 0,
          plans_with_settings: 0,
        },
      });
    }

    // Get invoice IDs and customer IDs to fetch related data
    const invoiceIds = invoices.map((inv) => inv.id);
    const customerIds = [...new Set(invoices.map((inv) => inv.customer_id).filter(Boolean))];

    // Fetch customer data to get st_customer_id
    const { data: customersData } = await supabase
      .from('ar_customers')
      .select('id, st_customer_id')
      .in('id', customerIds);

    const customerMap = new Map<string, number>();
    for (const c of customersData || []) {
      if (c.st_customer_id) customerMap.set(c.id, c.st_customer_id);
    }

    // Fetch tracking data for all invoices
    const { data: trackingData } = await supabase
      .from('ar_invoice_tracking')
      .select('invoice_id, financing_monthly_amount, financing_due_day, financing_start_date, financing_notes')
      .in('invoice_id', invoiceIds);

    // Build tracking lookup
    const trackingMap = new Map<string, {
      financing_monthly_amount: number | null;
      financing_due_day: number | null;
      financing_start_date: string | null;
      financing_notes: string | null;
    }>();
    for (const t of trackingData || []) {
      trackingMap.set(t.invoice_id, {
        financing_monthly_amount: t.financing_monthly_amount,
        financing_due_day: t.financing_due_day,
        financing_start_date: t.financing_start_date,
        financing_notes: t.financing_notes,
      });
    }

    // Fetch payments for all invoices
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('ar_payments')
      .select('*')
      .in('invoice_id', invoiceIds)
      .order('payment_date', { ascending: false });

    console.log(`Financing API: Querying payments for ${invoiceIds.length} invoices`);
    console.log(`Financing API: Found ${paymentsData?.length || 0} payments`);
    if (paymentsError) {
      console.error('Payments query error:', paymentsError);
    }

    // Group payments by invoice
    const paymentsByInvoice = new Map<string, typeof paymentsData>();
    for (const payment of paymentsData || []) {
      if (!payment.invoice_id) continue;
      const existing = paymentsByInvoice.get(payment.invoice_id) || [];
      existing.push(payment);
      paymentsByInvoice.set(payment.invoice_id, existing);
    }
    console.log(`Financing API: Grouped payments for ${paymentsByInvoice.size} invoices`);

    // Build response with calculated fields
    const financingInvoices: FinancingInvoice[] = invoices.map((invoice) => {
      const tracking = trackingMap.get(invoice.id);
      const payments = paymentsByInvoice.get(invoice.id) || [];

      const monthlyAmount = tracking?.financing_monthly_amount || null;
      const dueDay = tracking?.financing_due_day || null;
      const lastPaymentDate = payments.length > 0 ? payments[0].payment_date : null;

      // Calculate next due date and payoff
      let nextDueDate: string | null = null;
      let projectedPayoffDate: string | null = null;
      let paymentsRemaining = 0;

      if (monthlyAmount && dueDay && invoice.balance > 0) {
        const nextDue = getNextDueDate(dueDay, lastPaymentDate);
        nextDueDate = nextDue.toISOString().split('T')[0];

        const payoff = getProjectedPayoffDate(invoice.balance, monthlyAmount, dueDay, lastPaymentDate);
        projectedPayoffDate = payoff?.toISOString().split('T')[0] || null;

        paymentsRemaining = getPaymentsRemaining(invoice.balance, monthlyAmount);
      }

      return {
        id: invoice.id,
        st_invoice_id: invoice.st_invoice_id,
        invoice_number: invoice.invoice_number,
        customer_id: invoice.customer_id,
        st_customer_id: invoice.customer_id ? customerMap.get(invoice.customer_id) || null : null,
        customer_name: invoice.customer_name,
        invoice_total: invoice.invoice_total,
        balance: invoice.balance,
        amount_paid: invoice.amount_paid,
        invoice_date: invoice.invoice_date,
        financing_monthly_amount: monthlyAmount,
        financing_due_day: dueDay,
        financing_start_date: tracking?.financing_start_date || null,
        financing_notes: tracking?.financing_notes || null,
        payments_made: payments.length,
        last_payment_date: lastPaymentDate,
        next_due_date: nextDueDate,
        projected_payoff_date: projectedPayoffDate,
        payments_remaining: paymentsRemaining,
        payments: payments,
      };
    });

    // Calculate summary
    const activeInvoices = financingInvoices.filter((inv) => inv.balance > 0);
    const plansWithSettings = activeInvoices.filter(
      (inv) => inv.financing_monthly_amount && inv.financing_due_day
    );

    const summary = {
      total_outstanding: activeInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0),
      total_original: activeInvoices.reduce((sum, inv) => sum + (inv.invoice_total || 0), 0),
      total_paid: activeInvoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0),
      active_plans: activeInvoices.length,
      plans_with_settings: plansWithSettings.length,
    };

    return NextResponse.json({
      invoices: financingInvoices,
      summary,
    });
  } catch (error) {
    console.error('Financing API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financing data' },
      { status: 500 }
    );
  }
}
