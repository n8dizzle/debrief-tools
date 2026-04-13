import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { isValidCronRequest, formatLocalDate, hasAPPermission } from '@/lib/ap-utils';

export const maxDuration = 300;

/**
 * Enrich jobs that are missing invoice data.
 * Step 1: For jobs missing st_invoice_id, fetch from ST Jobs API.
 * Step 2: For jobs with st_invoice_id but no invoice_number, fetch from Invoices API.
 *
 * Returns: { done, enriched_ids, enriched_numbers, total_missing }
 */
export async function POST(request: NextRequest) {
  const isCron = isValidCronRequest(request);
  if (!isCron) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAPPermission(session, 'can_sync_data')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const supabase = getServerSupabase();
  const st = getServiceTitanClient();

  if (!st.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }

  // Step 1: Find jobs missing st_invoice_id and fetch from ST Jobs API
  const { data: jobsMissingId } = await supabase
    .from('ap_install_jobs')
    .select('id, st_job_id')
    .is('st_invoice_id', null)
    .eq('job_status', 'Completed')
    .limit(500);

  let enrichedIds = 0;
  if (jobsMissingId && jobsMissingId.length > 0) {
    const stJobIds = jobsMissingId.map(j => j.st_job_id);
    const stJobMap = await st.getJobsByIds(stJobIds);

    for (const dbJob of jobsMissingId) {
      const stJob = stJobMap.get(dbJob.st_job_id);
      if (stJob?.invoiceId) {
        await supabase
          .from('ap_install_jobs')
          .update({ st_invoice_id: stJob.invoiceId })
          .eq('id', dbJob.id);
        enrichedIds++;
      }
    }
  }

  // Step 2: Find jobs with st_invoice_id but missing invoice_number, invoice_exported_status, or invoice_date
  const { data: jobsMissingData, count } = await supabase
    .from('ap_install_jobs')
    .select('id, st_invoice_id', { count: 'exact' })
    .not('st_invoice_id', 'is', null)
    .or('invoice_number.is.null,invoice_exported_status.is.null,invoice_date.is.null')
    .limit(500);

  let enrichedNumbers = 0;
  if (jobsMissingData && jobsMissingData.length > 0) {
    const invoiceIds = [...new Set(jobsMissingData.map(j => j.st_invoice_id as number))];
    const invoiceMap = await st.getInvoicesByIds(invoiceIds);

    for (const job of jobsMissingData) {
      const invoice = invoiceMap.get(job.st_invoice_id as number);
      if (invoice) {
        const invNum = invoice.referenceNumber || invoice.invoiceNumber;
        const updates: Record<string, unknown> = {};
        if (invNum) updates.invoice_number = invNum;
        if (invoice.syncStatus) updates.invoice_exported_status = invoice.syncStatus;
        if (invoice.invoiceDate) {
          updates.invoice_date = formatLocalDate(new Date(invoice.invoiceDate));
        }

        if (Object.keys(updates).length > 0) {
          await supabase
            .from('ap_install_jobs')
            .update(updates)
            .eq('id', job.id);
          enrichedNumbers++;
        }
      }
    }
  }

  const totalMissing = (count || 0) + (jobsMissingId?.length || 0);
  console.log(`Invoice enrichment: ${enrichedIds} IDs, ${enrichedNumbers} details enriched (${totalMissing} were missing)`);

  return NextResponse.json({
    done: true,
    enriched_ids: enrichedIds,
    enriched_details: enrichedNumbers,
    total_missing: totalMissing,
  });
}
