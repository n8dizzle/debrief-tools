import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, FinancingInvoice } from '@/lib/supabase';
import {
  getNextDueDate,
  getProjectedPayoffDate,
  getPaymentsRemaining,
  generatePaymentSchedule,
} from '@/lib/financing-utils';

interface RouteParams {
  params: Promise<{ invoiceId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceId } = await params;
    const supabase = getServerSupabase();

    // Fetch invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('ar_invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Fetch tracking
    const { data: tracking } = await supabase
      .from('ar_invoice_tracking')
      .select('*')
      .eq('invoice_id', invoiceId)
      .single();

    // Fetch payments
    const { data: payments } = await supabase
      .from('ar_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: false });

    const monthlyAmount = tracking?.financing_monthly_amount || null;
    const dueDay = tracking?.financing_due_day || null;
    const lastPaymentDate = payments && payments.length > 0 ? payments[0].payment_date : null;

    // Calculate schedule
    let schedule = null;
    let nextDueDate: string | null = null;
    let projectedPayoffDate: string | null = null;
    let paymentsRemaining = 0;

    if (monthlyAmount && dueDay && invoice.balance > 0) {
      const nextDue = getNextDueDate(dueDay, lastPaymentDate);
      nextDueDate = nextDue.toISOString().split('T')[0];

      const payoff = getProjectedPayoffDate(invoice.balance, monthlyAmount, dueDay, lastPaymentDate);
      projectedPayoffDate = payoff?.toISOString().split('T')[0] || null;

      paymentsRemaining = getPaymentsRemaining(invoice.balance, monthlyAmount);

      schedule = generatePaymentSchedule(invoice.balance, monthlyAmount, dueDay, lastPaymentDate);
    }

    const financingInvoice: FinancingInvoice = {
      id: invoice.id,
      st_invoice_id: invoice.st_invoice_id,
      invoice_number: invoice.invoice_number,
      customer_id: invoice.customer_id,
      customer_name: invoice.customer_name,
      invoice_total: invoice.invoice_total,
      balance: invoice.balance,
      amount_paid: invoice.amount_paid,
      invoice_date: invoice.invoice_date,
      financing_monthly_amount: monthlyAmount,
      financing_due_day: dueDay,
      financing_start_date: tracking?.financing_start_date || null,
      financing_notes: tracking?.financing_notes || null,
      payments_made: payments?.length || 0,
      last_payment_date: lastPaymentDate,
      next_due_date: nextDueDate,
      projected_payoff_date: projectedPayoffDate,
      payments_remaining: paymentsRemaining,
      payments: payments || [],
    };

    return NextResponse.json({
      invoice: financingInvoice,
      schedule,
    });
  } catch (error) {
    console.error('Financing detail API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financing details' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceId } = await params;
    const body = await request.json();
    const supabase = getServerSupabase();

    // Validate input
    const {
      financing_monthly_amount,
      financing_due_day,
      financing_start_date,
      financing_notes,
    } = body;

    // Validate due day if provided
    if (financing_due_day !== undefined && financing_due_day !== null) {
      if (financing_due_day < 1 || financing_due_day > 28) {
        return NextResponse.json(
          { error: 'Due day must be between 1 and 28' },
          { status: 400 }
        );
      }
    }

    // Check if tracking record exists
    const { data: existing } = await supabase
      .from('ar_invoice_tracking')
      .select('id')
      .eq('invoice_id', invoiceId)
      .single();

    const updateData: Record<string, unknown> = {};

    if (financing_monthly_amount !== undefined) {
      updateData.financing_monthly_amount = financing_monthly_amount;
    }
    if (financing_due_day !== undefined) {
      updateData.financing_due_day = financing_due_day;
    }
    if (financing_start_date !== undefined) {
      updateData.financing_start_date = financing_start_date;
    }
    if (financing_notes !== undefined) {
      updateData.financing_notes = financing_notes;
    }

    let result;
    if (existing) {
      // Update existing tracking
      result = await supabase
        .from('ar_invoice_tracking')
        .update(updateData)
        .eq('invoice_id', invoiceId)
        .select()
        .single();
    } else {
      // Create new tracking record
      result = await supabase
        .from('ar_invoice_tracking')
        .insert({
          invoice_id: invoiceId,
          control_bucket: 'ar_collectible',
          ...updateData,
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error('Error updating financing:', result.error);
      return NextResponse.json({ error: 'Failed to update financing' }, { status: 500 });
    }

    return NextResponse.json({ tracking: result.data });
  } catch (error) {
    console.error('Financing update API error:', error);
    return NextResponse.json(
      { error: 'Failed to update financing settings' },
      { status: 500 }
    );
  }
}
