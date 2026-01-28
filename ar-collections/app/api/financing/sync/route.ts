import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const stClient = getServiceTitanClient();

    if (!stClient.isConfigured()) {
      return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
    }

    console.log('Syncing payments for in-house financing invoices...');

    // Get all in-house financing invoices (include invoice_number for lookup)
    const { data: financingInvoices, error: invoicesError } = await supabase
      .from('ar_invoices')
      .select('id, st_invoice_id, invoice_number, customer_id, invoice_date')
      .eq('has_inhouse_financing', true)
      .gt('st_invoice_id', 0)
      .not('customer_id', 'is', null);

    if (invoicesError) {
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }

    if (!financingInvoices || financingInvoices.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No in-house financing invoices found',
        stats: { invoices: 0, payments_processed: 0, payments_created: 0 },
      });
    }

    console.log(`Found ${financingInvoices.length} in-house financing invoices`);

    let paymentsProcessed = 0;
    let paymentsCreated = 0;
    let paymentsSkippedDupe = 0;
    let invoicesWithPayments = 0;
    const errors: string[] = [];

    // Build a map of customer_id -> st_customer_id for filtering
    const customerIds = [...new Set(financingInvoices.map(i => i.customer_id).filter(Boolean))];
    const { data: customers } = await supabase
      .from('ar_customers')
      .select('id, st_customer_id')
      .in('id', customerIds);
    const customerMap = new Map<string, number>();
    for (const c of customers || []) {
      if (c.st_customer_id) customerMap.set(c.id, c.st_customer_id);
    }

    for (const inv of financingInvoices) {
      try {
        // Look up the actual invoice ID using the invoice number
        // (Report 246's TransactionId doesn't match the actual invoice ID)
        let actualInvoiceId = inv.st_invoice_id;

        if (inv.invoice_number) {
          const stInvoice = await stClient.getInvoiceByNumber(inv.invoice_number);
          if (stInvoice?.id) {
            actualInvoiceId = stInvoice.id;
            if (actualInvoiceId !== inv.st_invoice_id) {
              console.log(`Invoice ${inv.invoice_number}: actual ID ${actualInvoiceId} (stored: ${inv.st_invoice_id})`);
            }
          }
        }

        // Get the ST customer ID for this invoice
        const stCustomerId = inv.customer_id ? customerMap.get(inv.customer_id) : null;

        if (!stCustomerId) {
          console.log(`Invoice ${inv.invoice_number}: no ST customer ID found, skipping`);
          continue;
        }

        // Fetch payments BY CUSTOMER (invoiceId filter is ignored by ST API)
        // Then filter to payments applied to this specific invoice
        const customerPaymentsResult = await stClient.getCustomerPayments(stCustomerId, {
          pageSize: 200, // Get more payments per customer
        });
        const allPayments = customerPaymentsResult.payments;

        // Filter to only payments applied to this specific invoice
        const stPayments = allPayments.filter((payment) => {
          const paymentAny = payment as any;
          const appliedTo = paymentAny.appliedTo;

          if (Array.isArray(appliedTo)) {
            return appliedTo.some((app: any) => {
              // Match by invoice ID
              if (app.appliedTo === actualInvoiceId) return true;
              // Match by invoice number (appliedToReferenceNumber field)
              if (inv.invoice_number && app.appliedToReferenceNumber === inv.invoice_number) return true;
              return false;
            });
          }
          // Fallback: check direct invoiceId field
          return payment.invoiceId === actualInvoiceId;
        });

        console.log(`Invoice ${inv.invoice_number} (ST customer: ${stCustomerId}, ID: ${actualInvoiceId}): ${stPayments.length} of ${allPayments.length} customer payments match`);

        if (stPayments.length > 0) {
          invoicesWithPayments++;
        }
        paymentsProcessed += stPayments.length;

        for (const payment of stPayments) {
          // Skip if no customer_id (required FK)
          if (!inv.customer_id) {
            console.warn(`Skipping payment ${payment.id} - invoice ${inv.st_invoice_id} has no customer_id`);
            continue;
          }

          // Extract amount - try different possible field names
          const paymentAny = payment as any;
          const amount = payment.amount ?? paymentAny.total ?? paymentAny.appliedAmount ?? paymentAny.paymentAmount ?? 0;

          // Skip payments with no amount
          if (!amount || amount === 0) {
            console.warn(`Skipping payment ${payment.id} - no amount found`);
            continue;
          }

          // Check if payment already exists
          const { data: existingPayments, error: checkError } = await supabase
            .from('ar_payments')
            .select('id')
            .eq('st_payment_id', payment.id);

          if (checkError) {
            console.error(`Error checking payment ${payment.id}:`, checkError.message);
            errors.push(`Check payment ${payment.id}: ${checkError.message}`);
            continue;
          }

          if (existingPayments && existingPayments.length > 0) {
            paymentsSkippedDupe++;
            continue;
          }

          // Extract payment date
          const paymentDate = payment.date ?? paymentAny.paidOn ?? paymentAny.createdOn;

          // Extract payment type - handle both string and object formats
          let paymentType = 'Unknown';
          if (typeof paymentAny.type === 'string') {
            paymentType = paymentAny.type;
          } else if (paymentAny.type?.name) {
            paymentType = paymentAny.type.name;
          } else if (paymentAny.paymentType?.name) {
            paymentType = paymentAny.paymentType.name;
          }

          // Insert new payment
          const { error: paymentError } = await supabase
            .from('ar_payments')
            .insert({
              st_payment_id: payment.id,
              invoice_id: inv.id,
              customer_id: inv.customer_id,
              amount: amount,
              payment_type: paymentType,
              payment_date: paymentDate ? paymentDate.split('T')[0] : new Date().toISOString().split('T')[0],
            });

          if (!paymentError) {
            paymentsCreated++;
          } else {
            console.error(`Failed to insert payment ${payment.id}:`, paymentError.message);
            errors.push(`Payment ${payment.id}: ${paymentError.message}`);
          }
        }
      } catch (error) {
        const errMsg = `Invoice ${inv.st_invoice_id}: ${error instanceof Error ? error.message : 'Unknown'}`;
        errors.push(errMsg);
        console.error(errMsg);
      }
    }

    console.log(`Synced ${paymentsCreated} new payments from ${paymentsProcessed} total`);

    return NextResponse.json({
      success: true,
      stats: {
        invoices_checked: financingInvoices.length,
        invoices_with_payments: invoicesWithPayments,
        payments_found: paymentsProcessed,
        payments_created: paymentsCreated,
        payments_already_synced: paymentsSkippedDupe,
      },
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error('Financing sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
