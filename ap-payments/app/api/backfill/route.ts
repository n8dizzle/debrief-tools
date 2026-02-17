import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient, formatAddress, STJob, STGrossPayItem } from '@/lib/servicetitan';
import { formatLocalDate, isValidCronRequest } from '@/lib/ap-utils';

export const maxDuration = 300;

/**
 * Backfill endpoint — processes one 2-week chunk at a time.
 * The UI calls this repeatedly until all chunks are done.
 *
 * Query params:
 *   chunk=0  (0-indexed chunk number, default 0)
 *
 * Returns:
 *   { done: boolean, chunk, chunks_total, jobs_processed, jobs_created, jobs_updated }
 */
export async function POST(request: NextRequest) {
  const isCron = isValidCronRequest(request);
  if (!isCron) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any).role || 'employee';
    if (role !== 'owner' && role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const supabase = getServerSupabase();
  const st = getServiceTitanClient();

  if (!st.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }

  // Build 2-week chunks from Jan 1 to today
  const startDate = new Date('2026-01-01');
  const today = new Date();
  today.setHours(23, 59, 59, 0);

  const CHUNK_DAYS = 14;
  const chunks: { start: string; end: string }[] = [];
  let cursor = new Date(startDate);
  while (cursor < today) {
    const chunkEnd = new Date(cursor.getTime() + CHUNK_DAYS * 24 * 60 * 60 * 1000);
    const end = chunkEnd > today ? today : chunkEnd;
    chunks.push({
      start: formatLocalDate(cursor),
      end: formatLocalDate(end),
    });
    cursor = new Date(chunkEnd.getTime());
  }

  const { searchParams } = new URL(request.url);
  const chunkIndex = parseInt(searchParams.get('chunk') || '0', 10);

  if (chunkIndex >= chunks.length) {
    return NextResponse.json({ done: true, chunk: chunkIndex, chunks_total: chunks.length });
  }

  const chunk = chunks[chunkIndex];
  let jobsProcessed = 0;
  let jobsCreated = 0;
  let jobsUpdated = 0;
  const errors: string[] = [];

  // Only create sync log on first chunk
  let syncId: string | null = null;
  if (chunkIndex === 0) {
    const { data: syncLog } = await supabase
      .from('ap_sync_log')
      .insert({
        sync_type: 'backfill',
        started_at: new Date().toISOString(),
        status: 'running',
      })
      .select()
      .single();
    syncId = syncLog?.id || null;
  }

  try {
    const [businessUnits, jobTypes] = await Promise.all([
      st.getAllBusinessUnits(),
      st.getJobTypes(),
    ]);

    const { data: mappingRow } = await supabase
      .from('ap_sync_settings')
      .select('value')
      .eq('key', 'bu_trade_mapping')
      .single();

    const buTradeMapping: Record<string, string> = mappingRow?.value || {};

    // Build technician lookup: st_technician_id → { id, hourly_rate }
    const { data: dbTechs } = await supabase
      .from('ap_technicians')
      .select('id, st_technician_id, hourly_rate');
    const techLookup = new Map(
      (dbTechs || []).map(t => [t.st_technician_id, { id: t.id, hourly_rate: t.hourly_rate }])
    );

    // Fetch just this chunk's date range
    // Pad gross pay items query ±7 days to avoid chunk boundaries splitting a job's timesheet data
    const padStart = new Date(new Date(chunk.start).getTime() - 7 * 24 * 60 * 60 * 1000);
    const padEnd = new Date(new Date(chunk.end).getTime() + 7 * 24 * 60 * 60 * 1000);
    const grossPayStart = formatLocalDate(padStart);
    const grossPayEnd = formatLocalDate(padEnd);

    const [installResult, grossPayMap] = await Promise.all([
      st.getInstallJobsSince(chunk.start, chunk.end),
      st.getGrossPayItems(grossPayStart, grossPayEnd),
    ]);
    const { jobs: allJobs, appointmentMap, appointmentDetails } = installResult;

    // Fetch appointment assignments from dispatch API to get technician data
    const allApptIds = Array.from(appointmentDetails.values()).map(a => a.id);
    const apptAssignments = await st.getAppointmentAssignments(allApptIds);

    // Build appointmentId → jobId reverse lookup
    const apptToJob = new Map<number, number>();
    for (const [jobId, appt] of appointmentDetails) {
      apptToJob.set(appt.id, jobId);
    }

    // Build jobId → technicianIds from assignments
    const jobTechMap = new Map<number, number[]>();
    for (const [apptId, techIds] of apptAssignments) {
      const jobId = apptToJob.get(apptId);
      if (jobId) {
        jobTechMap.set(jobId, techIds);
      }
    }

    // Get existing jobs from DB
    const stJobIds = allJobs.map(j => j.id);
    const { data: existingJobs } = stJobIds.length > 0
      ? await supabase
          .from('ap_install_jobs')
          .select('id, st_job_id, job_status, completed_date, job_total, scheduled_date, job_type_name, st_invoice_id, labor_hours')
          .in('st_job_id', stJobIds)
      : { data: [] };

    const existingMap = new Map(
      (existingJobs || []).map(j => [j.st_job_id, j])
    );

    const buNameMap = new Map(businessUnits.map(bu => [bu.id, bu.name]));
    const tradeMap = new Map<number, 'hvac' | 'plumbing'>(
      businessUnits.map(bu => {
        const mappedTrade = buTradeMapping[bu.name];
        if (mappedTrade === 'hvac' || mappedTrade === 'plumbing') return [bu.id, mappedTrade];
        return [bu.id, bu.name.toLowerCase().includes('plumb') ? 'plumbing' : 'hvac'];
      })
    );

    for (const job of allJobs) {
      try {
        jobsProcessed++;
        const existing = existingMap.get(job.id);
        const buName = buNameMap.get(job.businessUnitId) || job.businessUnitName || null;
        const trade = tradeMap.get(job.businessUnitId)
          || (buName?.toLowerCase().includes('plumb') ? 'plumbing' : 'hvac');

        let scheduledDate: string | null = null;
        const apptStart = appointmentMap.get(job.id);
        if (apptStart) {
          scheduledDate = formatLocalDate(new Date(apptStart));
        }

        let completedDate: string | null = null;
        if (job.completedOn) {
          completedDate = formatLocalDate(new Date(job.completedOn));
        }

        // Labor hours from gross pay items (actual timesheet data)
        let stTechId: number | null = null;
        let techDbId: string | null = null;
        let laborHours: number | null = null;
        let laborCost: number | null = null;
        let techCount: number | null = null;

        // Get technician assignment from dispatch API (for primary tech tracking)
        const techIds = jobTechMap.get(job.id) || [];
        stTechId = techIds[0] || null;

        if (stTechId) {
          const techInfo = techLookup.get(stTechId);
          if (techInfo) {
            techDbId = techInfo.id;
          }
        }

        // Use gross pay items for actual hours (preferred over appointment windows)
        const jobPayItems = grossPayMap.get(job.id) || [];
        if (jobPayItems.length > 0) {
          laborHours = jobPayItems.reduce((sum, item) => sum + (item.paidDurationHours || 0), 0);
          laborHours = Math.round(laborHours * 100) / 100;

          const uniqueTechs = new Set(jobPayItems.map(i => i.employeeId));
          techCount = uniqueTechs.size;

          // Use first tech from pay items if we don't have one from dispatch
          if (!stTechId) {
            const firstPayTechId = jobPayItems[0].employeeId;
            stTechId = firstPayTechId;
            const techInfo = techLookup.get(firstPayTechId);
            if (techInfo) techDbId = techInfo.id;
          }

          // Calculate cost per tech using their hourly rates
          let totalCost = 0;
          for (const empId of uniqueTechs) {
            const techItems = jobPayItems.filter(i => i.employeeId === empId);
            const techHours = techItems.reduce((s, i) => s + (i.paidDurationHours || 0), 0);
            const techInfo = techLookup.get(empId);
            if (techInfo?.hourly_rate) {
              totalCost += techHours * techInfo.hourly_rate;
            }
          }
          if (totalCost > 0) laborCost = Math.round(totalCost * 100) / 100;
        } else {
          // Fallback: appointment-based estimate for jobs without timesheet data yet
          const appt = appointmentDetails.get(job.id);
          if (appt?.start && appt?.end) {
            const startMs = new Date(appt.start).getTime();
            const endMs = new Date(appt.end).getTime();
            const rawHours = (endMs - startMs) / (1000 * 60 * 60);
            const apptHours = Math.round(rawHours * 4) / 4;
            if (apptHours > 0) {
              if (techIds.length > 0) {
                laborHours = Math.round(apptHours * techIds.length * 100) / 100;
                techCount = techIds.length;
                let totalCost = 0;
                let allHaveRates = true;
                for (const tid of techIds) {
                  const techInfo = techLookup.get(tid);
                  if (techInfo?.hourly_rate) {
                    totalCost += apptHours * techInfo.hourly_rate;
                  } else {
                    allHaveRates = false;
                  }
                }
                if (allHaveRates && totalCost > 0) laborCost = Math.round(totalCost * 100) / 100;
              } else {
                laborHours = apptHours;
              }
            }
          }
        }

        if (existing) {
          const resolvedTypeName = job.type?.name || job.jobTypeName || jobTypes.get(job.jobTypeId) || null;

          await supabase
            .from('ap_install_jobs')
            .update({
              job_status: job.jobStatus,
              scheduled_date: scheduledDate || existing.scheduled_date,
              completed_date: completedDate || existing.completed_date,
              job_total: job.total ?? existing.job_total,
              job_type_name: resolvedTypeName || existing.job_type_name,
              st_invoice_id: job.invoiceId || existing.st_invoice_id,
              summary: job.summary || undefined,
              ...(laborHours != null && { labor_hours: laborHours }),
              ...(stTechId != null && { st_technician_id: stTechId }),
              ...(techDbId != null && { technician_id: techDbId }),
              ...(laborCost != null && { labor_cost: laborCost }),
              ...(techCount != null && { technician_count: techCount }),
              synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          jobsUpdated++;
        } else {
          await supabase.from('ap_install_jobs').insert({
            st_job_id: job.id,
            job_number: job.jobNumber,
            job_status: job.jobStatus,
            trade,
            job_type_name: job.type?.name || job.jobTypeName || jobTypes.get(job.jobTypeId) || null,
            business_unit_id: job.businessUnitId,
            business_unit_name: buName,
            st_customer_id: job.customerId,
            st_location_id: job.locationId,
            scheduled_date: scheduledDate,
            completed_date: completedDate,
            job_total: job.total ?? null,
            summary: job.summary || null,
            st_invoice_id: job.invoiceId || null,
            labor_hours: laborHours,
            st_technician_id: stTechId,
            technician_id: techDbId,
            labor_cost: laborCost,
            technician_count: techCount,
            synced_at: new Date().toISOString(),
          });

          jobsCreated++;
        }
      } catch (err) {
        const msg = `Error processing job ${job.id}: ${err instanceof Error ? err.message : 'Unknown'}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // Enrich new jobs with customer/location details (skip if no new jobs to save time)
    const newJobs = allJobs.filter(j => !existingMap.has(j.id));
    if (newJobs.length > 0) {
      await enrichJobDetails(st, supabase, newJobs);
    }

    // Enrich invoice numbers for jobs that have invoiceId
    await enrichInvoiceNumbers(st, supabase, allJobs);

    const isDone = chunkIndex >= chunks.length - 1;

    // Update sync log on last chunk or first chunk
    if (syncId) {
      await supabase
        .from('ap_sync_log')
        .update({
          completed_at: isDone ? new Date().toISOString() : null,
          jobs_processed: jobsProcessed,
          jobs_created: jobsCreated,
          jobs_updated: jobsUpdated,
          errors: errors.length > 0 ? errors.join('\n') : null,
          status: isDone ? 'completed' : 'running',
        })
        .eq('id', syncId);
    }

    return NextResponse.json({
      done: isDone,
      chunk: chunkIndex,
      chunks_total: chunks.length,
      chunk_range: `${chunk.start} to ${chunk.end}`,
      jobs_processed: jobsProcessed,
      jobs_created: jobsCreated,
      jobs_updated: jobsUpdated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Backfill chunk ${chunkIndex} failed:`, msg);

    if (syncId) {
      await supabase
        .from('ap_sync_log')
        .update({
          completed_at: new Date().toISOString(),
          jobs_processed: jobsProcessed,
          jobs_created: jobsCreated,
          jobs_updated: jobsUpdated,
          errors: msg,
          status: 'failed',
        })
        .eq('id', syncId);
    }

    return NextResponse.json({ error: msg, chunk: chunkIndex }, { status: 500 });
  }
}

/**
 * Best-effort enrichment: fetch invoice numbers for jobs that have invoiceId.
 * Uses the ST invoices API directly rather than Report 246.
 */
async function enrichInvoiceNumbers(
  st: ReturnType<typeof getServiceTitanClient>,
  supabase: ReturnType<typeof getServerSupabase>,
  jobs: STJob[]
) {
  const jobsWithInvoice = jobs.filter(j => j.invoiceId);
  if (jobsWithInvoice.length === 0) return;

  const invoiceIds = [...new Set(jobsWithInvoice.map(j => j.invoiceId!))];

  try {
    const invoiceMap = await st.getInvoicesByIds(invoiceIds);

    let updated = 0;
    for (const job of jobsWithInvoice) {
      const invoice = invoiceMap.get(job.invoiceId!);
      const invNum = invoice?.referenceNumber || invoice?.invoiceNumber;
      if (invNum) {
        const invDate = invoice?.invoiceDate ? formatLocalDate(new Date(invoice.invoiceDate)) : null;
        await supabase
          .from('ap_install_jobs')
          .update({
            invoice_number: invNum,
            invoice_exported_status: invoice?.syncStatus || null,
            ...(invDate && { invoice_date: invDate }),
          })
          .eq('st_job_id', job.id);
        updated++;
      }
    }

    console.log(`Invoice number enrichment: ${updated}/${jobsWithInvoice.length} jobs`);
  } catch (error) {
    console.error('Invoice number enrichment failed:', error);
  }
}

/**
 * Best-effort enrichment: fetch customer/location details for newly created jobs.
 * Processes in small batches to avoid rate limits and timeouts.
 */
async function enrichJobDetails(
  st: ReturnType<typeof getServiceTitanClient>,
  supabase: ReturnType<typeof getServerSupabase>,
  jobs: STJob[]
) {
  const customerIds = [...new Set(jobs.map(j => j.customerId))];
  const locationIds = [...new Set(jobs.map(j => j.locationId))];

  const customerMap = new Map<number, { name: string; phone: string; email: string }>();
  const locationMap = new Map<number, string>();

  const BATCH_SIZE = 5;

  // Fetch customers in batches of 5
  for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
    const batch = customerIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(id => st.getCustomer(id)));
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        customerMap.set(batch[idx], {
          name: result.value.name || '',
          phone: result.value.phoneNumber || '',
          email: result.value.email || '',
        });
      }
    });
  }

  // Fetch locations in batches of 5
  for (let i = 0; i < locationIds.length; i += BATCH_SIZE) {
    const batch = locationIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(id => st.getLocation(id)));
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        locationMap.set(batch[idx], formatAddress(result.value));
      }
    });
  }

  console.log(`Enriched ${customerMap.size}/${customerIds.length} customers, ${locationMap.size}/${locationIds.length} locations`);

  // Update jobs with enriched data
  for (const job of jobs) {
    const customer = customerMap.get(job.customerId);
    const address = locationMap.get(job.locationId);
    if (customer || address) {
      const updates: Record<string, unknown> = {};
      if (customer?.name) updates.customer_name = customer.name;
      if (customer?.phone) updates.customer_phone = customer.phone;
      if (customer?.email) updates.customer_email = customer.email;
      if (address) updates.job_address = address;

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('ap_install_jobs')
          .update(updates)
          .eq('st_job_id', job.id);
      }
    }
  }
}
