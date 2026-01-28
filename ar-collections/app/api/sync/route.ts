import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient, ARReportRow, STCustomer } from '@/lib/servicetitan';

interface SyncStats {
  invoicesProcessed: number;
  invoicesCreated: number;
  invoicesUpdated: number;
  invoicesPaid: number;
  customersProcessed: number;
  customersCreated: number;
  customersUpdated: number;
  paymentsProcessed: number;
  paymentsCreated: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Allow cron or authenticated users (manager/owner)
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

    console.log('Starting AR sync using Report 246...');

    // Create sync log entry
    const { data: syncLog } = await supabase
      .from('ar_sync_log')
      .insert({
        sync_type: 'report_246',
        status: 'running',
      })
      .select()
      .single();

    const stats: SyncStats = {
      invoicesProcessed: 0,
      invoicesCreated: 0,
      invoicesUpdated: 0,
      invoicesPaid: 0,
      customersProcessed: 0,
      customersCreated: 0,
      customersUpdated: 0,
      paymentsProcessed: 0,
      paymentsCreated: 0,
      errors: [],
    };

    try {
      // Step 1: Fetch AR data from Report 246
      const arRows = await stClient.getARTransactionsReport();
      stats.invoicesProcessed = arRows.length;

      if (arRows.length === 0) {
        console.log('No open AR found');
        await supabase
          .from('ar_sync_log')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            records_processed: 0,
          })
          .eq('id', syncLog?.id);

        return NextResponse.json({
          success: true,
          message: 'No open AR found',
          stats,
        });
      }

      // Step 2: Get unique customer IDs and fetch contact info
      const customerIds = [...new Set(arRows.map(r => r.customerId).filter(id => id > 0))];
      console.log(`Fetching contact info for ${customerIds.length} customers...`);

      const stCustomers = await stClient.getCustomersInBatches(customerIds);
      stats.customersProcessed = stCustomers.length;

      // Build customer lookup map
      const customerMap = new Map<number, STCustomer>();
      for (const cust of stCustomers) {
        customerMap.set(cust.id, cust);
      }

      // Step 3: Process customers first
      const dbCustomerMap = new Map<number, string>(); // ST ID -> DB ID
      for (const stCustomer of stCustomers) {
        try {
          const { isNew, dbId } = await upsertCustomer(supabase, stCustomer);
          dbCustomerMap.set(stCustomer.id, dbId);
          if (isNew) stats.customersCreated++;
          else stats.customersUpdated++;
        } catch (error) {
          stats.errors.push(`Customer ${stCustomer.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }

      // Step 4: Fetch job info (In-house Financing tags and job status)
      const jobNumbers = arRows.map(r => r.jobNumber).filter((jn): jn is string => jn !== null);
      console.log(`Fetching job info for ${jobNumbers.length} jobs...`);
      const jobInfoMap = await stClient.getJobInfoBatch(jobNumbers);

      // Step 5: Get existing invoice IDs to track what's still open
      const { data: existingInvoices } = await supabase
        .from('ar_invoices')
        .select('id, st_invoice_id, balance')
        .gt('balance', 0);

      const existingByStId = new Map<number, { id: string; balance: number }>();
      for (const inv of existingInvoices || []) {
        if (inv.st_invoice_id && inv.st_invoice_id > 0) {
          existingByStId.set(inv.st_invoice_id, { id: inv.id, balance: inv.balance });
        }
      }

      // Track which ST invoice IDs we see in the report
      const seenStInvoiceIds = new Set<number>();

      // Step 6: Process AR rows (invoices)
      for (const row of arRows) {
        try {
          seenStInvoiceIds.add(row.invoiceId);

          const stCustomer = customerMap.get(row.customerId) ?? null;
          const dbCustomerId = dbCustomerMap.get(row.customerId) ?? null;
          const existing = existingByStId.get(row.invoiceId);
          const jobInfo = row.jobNumber ? jobInfoMap.get(row.jobNumber) : null;
          const hasInhouseFinancing = jobInfo?.hasInhouseFinancing || false;
          const stJobStatus = jobInfo?.jobStatus || null;
          const stJobTypeName = jobInfo?.jobTypeName || null;
          const hasMembership = jobInfo?.hasMembership || false;
          const bookingPaymentType = jobInfo?.bookingPaymentType || null;
          const nextAppointmentDate = jobInfo?.nextAppointmentDate || null;

          const wasCreated = await upsertInvoiceFromReport(supabase, row, dbCustomerId, stCustomer, hasInhouseFinancing, stJobStatus, stJobTypeName, hasMembership, bookingPaymentType, nextAppointmentDate);

          if (existing) {
            stats.invoicesUpdated++;
          } else {
            stats.invoicesCreated++;
          }
        } catch (error) {
          stats.errors.push(`Invoice ${row.invoiceId}: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }

      // Step 7: Mark invoices not in report as paid
      for (const [stInvoiceId, existing] of existingByStId) {
        if (!seenStInvoiceIds.has(stInvoiceId)) {
          // Invoice no longer has balance - mark as paid
          await supabase
            .from('ar_invoices')
            .update({
              balance: 0,
              status: 'paid',
              synced_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          stats.invoicesPaid++;
        }
      }

      // Note: Payment syncing moved to /api/financing/sync endpoint for on-demand refresh

      // Update sync log with success
      const totalAR = arRows.reduce((sum, r) => sum + r.netAmount, 0);
      await supabase
        .from('ar_sync_log')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_processed: stats.invoicesProcessed,
          records_created: stats.invoicesCreated,
          records_updated: stats.invoicesUpdated + stats.invoicesPaid,
          errors: stats.errors.length > 0 ? stats.errors.slice(0, 10).join('; ') : null,
        })
        .eq('id', syncLog?.id);

      return NextResponse.json({
        success: true,
        total_ar: totalAR,
        stats: {
          invoices: {
            processed: stats.invoicesProcessed,
            created: stats.invoicesCreated,
            updated: stats.invoicesUpdated,
            paid: stats.invoicesPaid,
          },
          customers: {
            processed: stats.customersProcessed,
            created: stats.customersCreated,
            updated: stats.customersUpdated,
          },
          payments: {
            processed: stats.paymentsProcessed,
            created: stats.paymentsCreated,
          },
        },
        errors: stats.errors.slice(0, 10),
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

/**
 * Upsert customer record
 */
async function upsertCustomer(
  supabase: ReturnType<typeof getServerSupabase>,
  stCustomer: STCustomer
): Promise<{ isNew: boolean; dbId: string }> {
  // Check if customer exists by ST ID
  const { data: existing } = await supabase
    .from('ar_customers')
    .select('id')
    .eq('st_customer_id', stCustomer.id)
    .single();

  const customerData = {
    st_customer_id: stCustomer.id,
    name: stCustomer.name || 'Unknown',
    email: stCustomer.email || null,
    phone: stCustomer.phoneNumber || null,
  };

  if (existing) {
    // Update existing
    await supabase
      .from('ar_customers')
      .update(customerData)
      .eq('id', existing.id);
    return { isNew: false, dbId: existing.id };
  } else {
    // Create new
    const { data: newCustomer, error } = await supabase
      .from('ar_customers')
      .insert(customerData)
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create customer: ${error.message}`);
    }

    return { isNew: true, dbId: newCustomer?.id || '' };
  }
}

/**
 * Upsert invoice from Report 246 data
 */
async function upsertInvoiceFromReport(
  supabase: ReturnType<typeof getServerSupabase>,
  row: ARReportRow,
  dbCustomerId: string | null,
  stCustomer: STCustomer | null,
  hasInhouseFinancing: boolean = false,
  stJobStatus: string | null = null,
  stJobTypeName: string | null = null,
  hasMembership: boolean = false,
  bookingPaymentType: string | null = null,
  nextAppointmentDate: string | null = null
): Promise<boolean> {
  // Determine job type from business unit name
  const buName = (row.businessUnitName || '').toLowerCase();
  const isInstall =
    buName.includes('install') ||
    buName.includes('replacement') ||
    buName.includes('new construction');
  const jobType = isInstall ? 'install' : 'service';

  // Determine customer type from ST customer data
  const customerTypeLower = (stCustomer?.type || '').toLowerCase();
  const customerType = customerTypeLower.includes('commercial') ? 'commercial' : 'residential';

  // Calculate days outstanding and aging bucket from report data
  let agingBucket: 'current' | '30' | '60' | '90+';
  let daysOutstanding: number;

  if (row.aging121Plus > 0) {
    agingBucket = '90+';
    daysOutstanding = 121;
  } else if (row.aging120 > 0) {
    agingBucket = '90+';
    daysOutstanding = 100;
  } else if (row.aging90 > 0) {
    agingBucket = '90+';
    daysOutstanding = 75;
  } else if (row.aging60 > 0) {
    agingBucket = '60';
    daysOutstanding = 45;
  } else if (row.aging30 > 0) {
    agingBucket = '30';
    daysOutstanding = 15;
  } else {
    agingBucket = 'current';
    daysOutstanding = 0;
  }

  // Parse dates from report
  const invoiceDate = row.createdDate ? row.createdDate.split('T')[0] : new Date().toISOString().split('T')[0];
  const dueDate = row.paymentDueDate ? row.paymentDueDate.split('T')[0] : invoiceDate;

  const invoiceData = {
    st_invoice_id: row.invoiceId,
    invoice_number: row.invoiceNumber || `INV-${row.invoiceId}`,
    customer_id: dbCustomerId,
    customer_name: row.customerName || stCustomer?.name || 'Unknown',
    customer_type: customerType,
    invoice_total: row.total || row.netAmount,
    balance: row.netAmount,
    amount_paid: (row.total || row.netAmount) - row.netAmount,
    invoice_date: invoiceDate,
    due_date: dueDate,
    days_outstanding: daysOutstanding,
    aging_bucket: agingBucket,
    status: row.netAmount > 0 ? 'open' : 'paid',
    business_unit_id: null, // Report doesn't include BU ID
    business_unit_name: row.businessUnitName || null,
    job_type: jobType,
    st_job_id: null, // Would need separate lookup
    job_number: row.jobNumber,
    has_inhouse_financing: hasInhouseFinancing,
    st_job_status: stJobStatus,
    st_job_type_name: stJobTypeName,
    has_membership: hasMembership,
    booking_payment_type: bookingPaymentType,
    next_appointment_date: nextAppointmentDate,
    synced_at: new Date().toISOString(),
  };

  // Check if invoice exists by ST invoice ID
  const { data: existing } = await supabase
    .from('ar_invoices')
    .select('id')
    .eq('st_invoice_id', row.invoiceId)
    .single();

  if (existing) {
    // Update existing
    const { error: updateErr } = await supabase
      .from('ar_invoices')
      .update(invoiceData)
      .eq('id', existing.id);

    if (updateErr) {
      throw new Error(`Update failed: ${updateErr.message}`);
    }
    return false; // Not new
  } else {
    // Create new
    const { data: newInvoice, error: insertErr } = await supabase
      .from('ar_invoices')
      .insert(invoiceData)
      .select('id')
      .single();

    if (insertErr) {
      throw new Error(`Insert failed: ${insertErr.message}`);
    }

    // Create tracking record for new invoice
    if (newInvoice) {
      await supabase
        .from('ar_invoice_tracking')
        .insert({
          invoice_id: newInvoice.id,
          control_bucket: 'ar_collectible',
        });
    }
    return true; // New
  }
}
