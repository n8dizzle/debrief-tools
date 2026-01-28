import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, FinancingExpectedPayment } from '@/lib/supabase';

// GET - Get expected payment schedule for an invoice
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

    const { data: payments, error } = await supabase
      .from('ar_financing_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Error fetching schedule:', error);
      return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
    }

    return NextResponse.json({ payments: payments || [] });
  } catch (error) {
    console.error('Schedule API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST - Generate expected payment schedule for an invoice
export async function POST(
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

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('ar_invoices')
      .select('id, invoice_total, balance, invoice_date')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get financing settings from tracking
    const { data: tracking } = await supabase
      .from('ar_invoice_tracking')
      .select('financing_monthly_amount, financing_due_day, financing_start_date')
      .eq('invoice_id', invoiceId)
      .single();

    if (!tracking?.financing_monthly_amount || !tracking?.financing_due_day) {
      return NextResponse.json(
        { error: 'Financing settings not configured. Set monthly amount and due day first.' },
        { status: 400 }
      );
    }

    const monthlyAmount = tracking.financing_monthly_amount;
    const dueDay = tracking.financing_due_day;
    const startDate = tracking.financing_start_date
      ? new Date(tracking.financing_start_date)
      : new Date(invoice.invoice_date);

    // Get existing payments from ServiceTitan (sorted by payment date)
    const { data: existingPayments } = await supabase
      .from('ar_payments')
      .select('payment_date, amount, st_payment_id, payment_type')
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: true });

    // Calculate number of payments needed
    const totalAmount = invoice.invoice_total;
    const numPayments = Math.ceil(totalAmount / monthlyAmount);

    // Generate expected payment dates
    const expectedPayments: Partial<FinancingExpectedPayment>[] = [];
    let currentDate = new Date(startDate);

    // Set to the first due day on or after start date
    currentDate.setDate(dueDay);
    if (currentDate < startDate) {
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Create a queue of payments to apply in order received
    const paymentQueue = [...(existingPayments || [])];

    let remainingAmount = totalAmount;
    for (let i = 0; i < numPayments && remainingAmount > 0; i++) {
      const amount = Math.min(monthlyAmount, remainingAmount);
      const dueDateStr = currentDate.toISOString().split('T')[0];

      let status: FinancingExpectedPayment['status'] = 'pending';
      let paymentDate: string | null = null;
      let stPaymentId: number | null = null;
      let amountPaid: number | null = null;
      let paymentType: string | null = null;

      // Apply next payment in queue (in order received)
      if (paymentQueue.length > 0) {
        const nextPayment = paymentQueue.shift()!;
        paymentDate = nextPayment.payment_date;
        stPaymentId = nextPayment.st_payment_id;
        amountPaid = nextPayment.amount;
        paymentType = nextPayment.payment_type;

        const paidDate = new Date(paymentDate);
        const dueDate = new Date(dueDateStr);

        if (paidDate <= dueDate) {
          status = 'paid';
        } else {
          status = 'late';
        }

        if (amountPaid < amount * 0.99) {
          status = 'partial';
        }
      } else {
        // No payment for this slot - check if overdue
        const today = new Date();
        const dueDate = new Date(dueDateStr);
        if (dueDate < today) {
          status = 'missed';
        }
      }

      expectedPayments.push({
        invoice_id: invoiceId,
        due_date: dueDateStr,
        amount,
        status,
        payment_date: paymentDate,
        st_payment_id: stPaymentId,
        amount_paid: amountPaid,
        payment_type: paymentType,
      });

      remainingAmount -= amount;
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Delete existing schedule and insert new one
    await supabase
      .from('ar_financing_payments')
      .delete()
      .eq('invoice_id', invoiceId);

    const { data: inserted, error: insertError } = await supabase
      .from('ar_financing_payments')
      .insert(expectedPayments)
      .select();

    if (insertError) {
      console.error('Error inserting schedule:', insertError);
      return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      payments: inserted,
      summary: {
        total_payments: expectedPayments.length,
        paid: expectedPayments.filter((p) => p.status === 'paid').length,
        late: expectedPayments.filter((p) => p.status === 'late').length,
        missed: expectedPayments.filter((p) => p.status === 'missed').length,
        pending: expectedPayments.filter((p) => p.status === 'pending').length,
      },
    });
  } catch (error) {
    console.error('Schedule generation error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
