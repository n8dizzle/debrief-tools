import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient, formatAddress, STJob } from '@/lib/servicetitan';
import { isValidCronRequest, formatLocalDate } from '@/lib/ap-utils';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const isCron = isValidCronRequest(request);
  if (!isCron) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = session.user.role || 'employee';
    if (role !== 'owner' && role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const supabase = getServerSupabase();
  const st = getServiceTitanClient();

  if (!st.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }

  const { data: syncLog } = await supabase
    .from('ap_sync_log')
    .insert({
      sync_type: 'full',
      started_at: new Date().toISOString(),
      status: 'running',
    })
    .select()
    .single();

  const syncId = syncLog?.id;

  let jobsProcessed = 0;
  let jobsCreated = 0;
  let jobsUpdated = 0;
  const errors: string[] = [];

  try {
    const businessUnits = await st.getBusinessUnits();

    // Load configured BU filter from settings
    const { data: buSetting } = await supabase
      .from('ap_sync_settings')
      .select('value')
      .eq('key', 'sync_business_units')
      .single();
    const allowedBUNames: string[] | undefined = buSetting?.value || undefined;

    // Upcoming jobs come from appointments (which have scheduled dates)
    // Recent completed jobs come from the jobs endpoint filtered by completedOn
    const [upcomingResult, recentJobs] = await Promise.all([
      st.getUpcomingInstallJobs(30, allowedBUNames),
      st.getRecentInstallJobs(7, allowedBUNames),
    ]);

    const { jobs: upcomingJobs, appointmentMap } = upcomingResult;

    // Dedupe by job ID (upcoming takes priority for appointment data)
    const jobMap = new Map<number, STJob>();
    for (const job of [...recentJobs, ...upcomingJobs]) {
      jobMap.set(job.id, job);
    }

    const allJobs = Array.from(jobMap.values());

    // Get existing jobs from DB
    const stJobIds = allJobs.map(j => j.id);
    const { data: existingJobs } = stJobIds.length > 0
      ? await supabase
          .from('ap_install_jobs')
          .select('id, st_job_id, job_status, completed_date, job_total, scheduled_date')
          .in('st_job_id', stJobIds)
      : { data: [] };

    const existingMap = new Map(
      (existingJobs || []).map(j => [j.st_job_id, j])
    );

    // Pre-build BU lookup maps (sync, no API calls)
    const buNameMap = new Map(businessUnits.map(bu => [bu.id, bu.name]));
    const tradeMap = new Map<number, 'hvac' | 'plumbing'>(
      businessUnits.map(bu => [bu.id, bu.name.toLowerCase().includes('plumb') ? 'plumbing' : 'hvac'])
    );

    // Process jobs - insert/update in DB
    for (const job of allJobs) {
      try {
        jobsProcessed++;
        const existing = existingMap.get(job.id);
        const trade = tradeMap.get(job.businessUnitId) || 'hvac';
        const buName = buNameMap.get(job.businessUnitId) || null;

        // Scheduled date comes from appointment start time
        let scheduledDate: string | null = null;
        const apptStart = appointmentMap.get(job.id);
        if (apptStart) {
          scheduledDate = formatLocalDate(new Date(apptStart));
        }

        let completedDate: string | null = null;
        if (job.completedOn) {
          completedDate = formatLocalDate(new Date(job.completedOn));
        }

        if (existing) {
          await supabase
            .from('ap_install_jobs')
            .update({
              job_status: job.jobStatus,
              scheduled_date: scheduledDate || existing.scheduled_date,
              completed_date: completedDate || existing.completed_date,
              job_total: job.total ?? existing.job_total,
              summary: job.summary || undefined,
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
            job_type_name: job.type?.name || job.jobTypeName || null,
            business_unit_id: job.businessUnitId,
            business_unit_name: buName,
            st_customer_id: job.customerId,
            st_location_id: job.locationId,
            scheduled_date: scheduledDate,
            completed_date: completedDate,
            job_total: job.total ?? null,
            summary: job.summary || null,
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

    // Enrich new jobs with customer/location details (best-effort, 10s timeout)
    const newJobs = allJobs.filter(j => !existingMap.has(j.id));
    if (newJobs.length > 0) {
      await enrichJobDetails(st, supabase, newJobs);
    }

    if (syncId) {
      await supabase
        .from('ap_sync_log')
        .update({
          completed_at: new Date().toISOString(),
          jobs_processed: jobsProcessed,
          jobs_created: jobsCreated,
          jobs_updated: jobsUpdated,
          errors: errors.length > 0 ? errors.join('\n') : null,
          status: 'completed',
        })
        .eq('id', syncId);
    }

    return NextResponse.json({
      success: true,
      jobs_processed: jobsProcessed,
      jobs_created: jobsCreated,
      jobs_updated: jobsUpdated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Sync failed:', msg);

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

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Best-effort enrichment: fetch customer/location details for newly created jobs.
 * All fetches run in parallel with a 10s timeout to stay within function limits.
 */
async function enrichJobDetails(
  st: ReturnType<typeof getServiceTitanClient>,
  supabase: ReturnType<typeof getServerSupabase>,
  jobs: STJob[]
) {
  const customerIds = [...new Set(jobs.map(j => j.customerId))];
  const locationIds = [...new Set(jobs.map(j => j.locationId))];

  const timeout = (ms: number) => new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), ms)
  );

  try {
    const [customerResults, locationResults] = await Promise.race([
      Promise.all([
        Promise.allSettled(customerIds.map(id => st.getCustomer(id))),
        Promise.allSettled(locationIds.map(id => st.getLocation(id))),
      ]),
      timeout(10000).then(() => { throw new Error('timeout'); }),
    ]) as [PromiseSettledResult<any>[], PromiseSettledResult<any>[]];

    const customerMap = new Map<number, { name: string; phone: string; email: string }>();
    const locationMap = new Map<number, string>();

    customerResults.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        customerMap.set(customerIds[idx], {
          name: result.value.name || '',
          phone: result.value.phoneNumber || '',
          email: result.value.email || '',
        });
      }
    });

    locationResults.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        locationMap.set(locationIds[idx], formatAddress(result.value));
      }
    });

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
  } catch {
    console.log('Customer/location enrichment timed out - will retry on next sync');
  }
}

// Support both GET and POST for Vercel cron
export async function GET(request: NextRequest) {
  return POST(request);
}
