import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient, STInvoice } from '@/lib/servicetitan';
import {
  calculateDaysOutstanding,
  getAgingBucket,
  getInvoiceStatus,
  calculateDueDate,
  getTodayDateString,
} from '@/lib/ar-utils';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Allow cron or authenticated users
    const cronSecret = request.headers.get('Authorization')?.replace('Bearer ', '');
    const isCronRequest = cronSecret === process.env.CRON_SECRET;

    if (!isCronRequest && (!session?.user || !['manager', 'owner'].includes(session.user.role))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const stClient = getServiceTitanClient();

    if (!stClient.isConfigured()) {
      return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
    }

    // Start sync log
    const { data: syncLog } = await supabase
      .from('ar_sync_log')
      .insert({
        sync_type: 'full',
        status: 'running',
      })
      .select()
      .single();

    let recordsProcessed = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let errors: string[] = [];

    try {
      // Fetch all open invoices from ServiceTitan
      const stInvoices = await stClient.getAllOpenInvoices(0);
      recordsProcessed = stInvoices.length;

      // Process each invoice
      for (const stInvoice of stInvoices) {
        try {
          // Determine job type based on invoice/job data
          const jobTypeName = stInvoice.job?.type?.name?.toLowerCase() || '';
          const jobType = jobTypeName.includes('install') ? 'install' : 'service';

          // Determine customer type
          const customerType = stInvoice.customer?.type?.toLowerCase() === 'commercial'
            ? 'commercial'
            : 'residential';

          // Calculate dates and aging
          const invoiceDate = stInvoice.createdOn
            ? new Date(stInvoice.createdOn).toISOString().split('T')[0]
            : getTodayDateString();
          const daysOutstanding = calculateDaysOutstanding(invoiceDate);
          const agingBucket = getAgingBucket(daysOutstanding);
          const status = getInvoiceStatus(stInvoice.balance, stInvoice.total);
          const dueDate = calculateDueDate(invoiceDate, customerType);

          // Upsert invoice
          const { data: existingInvoice } = await supabase
            .from('ar_invoices')
            .select('id')
            .eq('st_invoice_id', stInvoice.id)
            .single();

          const invoiceData = {
            st_invoice_id: stInvoice.id,
            invoice_number: stInvoice.invoiceNumber || stInvoice.referenceNumber || String(stInvoice.id),
            customer_id: stInvoice.customer?.id ? await getOrCreateCustomer(supabase, stInvoice.customer) : null,
            customer_name: stInvoice.customer?.name || 'Unknown',
            invoice_total: stInvoice.total,
            balance: stInvoice.balance,
            amount_paid: stInvoice.total - stInvoice.balance,
            invoice_date: invoiceDate,
            due_date: dueDate.toISOString().split('T')[0],
            days_outstanding: daysOutstanding,
            aging_bucket: agingBucket,
            status,
            business_unit_id: stInvoice.businessUnit?.id || null,
            business_unit_name: stInvoice.businessUnit?.name || null,
            job_type: jobType,
            customer_type: customerType,
            synced_at: new Date().toISOString(),
          };

          if (existingInvoice) {
            await supabase
              .from('ar_invoices')
              .update(invoiceData)
              .eq('id', existingInvoice.id);
            recordsUpdated++;
          } else {
            const { data: newInvoice } = await supabase
              .from('ar_invoices')
              .insert(invoiceData)
              .select()
              .single();

            // Create tracking record for new invoice
            if (newInvoice) {
              await supabase
                .from('ar_invoice_tracking')
                .insert({
                  invoice_id: newInvoice.id,
                  control_bucket: 'ar_collectible',
                });
            }
            recordsCreated++;
          }
        } catch (err) {
          errors.push(`Invoice ${stInvoice.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // Update sync log with success
      await supabase
        .from('ar_sync_log')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_processed: recordsProcessed,
          records_created: recordsCreated,
          records_updated: recordsUpdated,
          errors: errors.length > 0 ? errors.slice(0, 10).join('; ') : null,
        })
        .eq('id', syncLog?.id);

      return NextResponse.json({
        success: true,
        records_processed: recordsProcessed,
        records_created: recordsCreated,
        records_updated: recordsUpdated,
        errors: errors.slice(0, 10),
      });

    } catch (error) {
      // Update sync log with failure
      await supabase
        .from('ar_sync_log')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          errors: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', syncLog?.id);

      throw error;
    }

  } catch (error) {
    console.error('Sync API error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function getOrCreateCustomer(
  supabase: ReturnType<typeof getServerSupabase>,
  stCustomer: { id: number; name?: string }
): Promise<string> {
  // Check if customer exists
  const { data: existingCustomer } = await supabase
    .from('ar_customers')
    .select('id')
    .eq('st_customer_id', stCustomer.id)
    .single();

  if (existingCustomer) {
    return existingCustomer.id;
  }

  // Create new customer
  const { data: newCustomer } = await supabase
    .from('ar_customers')
    .insert({
      st_customer_id: stCustomer.id,
      name: stCustomer.name || 'Unknown',
    })
    .select('id')
    .single();

  return newCustomer?.id || '';
}
