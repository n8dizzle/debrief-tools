import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import {
  sendLeadAssignmentDM,
  sendTechConfirmationDM,
  sendEmptyQueueAlert,
  isSlackConfigured,
} from '@/lib/slack';
import {
  authenticateServiceTitan,
  getServiceTitanConfigFromEnv,
  isServiceTitanConfigured,
} from '@/lib/serviceTitan';

// 30-day dedup window (ms)
const DEDUP_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// Business Unit and Job Type IDs for marketed leads
const HVAC_SALES_BU_ID = '33643795';
const MKTG_LEAD_JOB_TYPE_ID = '52687000';

// TGL Form name in ServiceTitan
const TGL_FORM_NAME = 'TGL Form';

// Status ordering for forward-only progression
const STATUS_ORDER = ['New Lead', 'Assigned', 'Quoted', 'Sold', 'Install Scheduled', 'Completed'];

interface ServiceTitanJob {
  id: number;
  jobNumber: string;
  customerId: number;
  locationId: number;
  businessUnitId: number;
  jobTypeId: number;
  jobStatus: string;
  createdOn: string;
  modifiedOn: string;
  summary?: string;
  tagTypeIds?: number[];
}

interface ServiceTitanCustomer {
  id: number;
  name: string;
}

interface ServiceTitanLocation {
  id: number;
  name?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  contacts?: {
    type: string;
    value: string;
  }[];
}

interface ServiceTitanAppointment {
  id: number;
  jobId: number;
  start: string;
  end: string;
  status: string;
}

interface ServiceTitanFormSubmission {
  id: number;
  jobId?: number;
  createdOn: string;
}

/**
 * Find a comfort advisor in our DB whose name matches the ST-assigned technician name.
 * Tries exact match first, then first-name / last-name word match.
 */
async function findAdvisorByName(
  name: string,
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<{ id: string; name: string; phone: string; email: string; marketed_queue_position: number; tgl_queue_position: number } | null> {
  if (!name) return null;
  const nameLower = name.toLowerCase().trim();

  const { data: advisors } = await supabase
    .from('comfort_advisors')
    .select('id, name, phone, email, marketed_queue_position, tgl_queue_position')
    .eq('active', true);

  if (!advisors || advisors.length === 0) return null;

  // Exact match
  const exact = advisors.find((a) => a.name.toLowerCase() === nameLower);
  if (exact) return exact;

  // Word-level partial match (any significant word in common)
  const stWords = nameLower.split(/\s+/).filter((w) => w.length > 2);
  const partial = advisors.find((a) => {
    const advisorWords = a.name.toLowerCase().split(/\s+/);
    return stWords.some((sw) => advisorWords.some((aw: string) => aw === sw));
  });

  return partial || null;
}

// Helper function to fetch job details (customer, location, appointment)
async function fetchJobDetails(
  job: ServiceTitanJob,
  config: { tenantId: string; appKey: string },
  token: string
): Promise<{
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  scheduledDate: string;
  techName: string;
}> {
  let customerName = `Customer #${job.customerId}`;
  let customerPhone = '';
  let customerAddress = '';
  let scheduledDate = '';
  let techName = '';

  // Fetch customer name
  try {
    const customerResponse = await fetch(
      `https://api.servicetitan.io/crm/v2/tenant/${config.tenantId}/customers/${job.customerId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'ST-App-Key': config.appKey,
        },
      }
    );

    if (customerResponse.ok) {
      const customerData: ServiceTitanCustomer = await customerResponse.json();
      customerName = customerData.name || customerName;
    }
  } catch (custError) {
    console.error(`Failed to fetch customer ${job.customerId}:`, custError);
  }

  // Fetch service location details (address and phone from location, not bill-to)
  try {
    const locationResponse = await fetch(
      `https://api.servicetitan.io/crm/v2/tenant/${config.tenantId}/locations/${job.locationId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'ST-App-Key': config.appKey,
        },
      }
    );

    if (locationResponse.ok) {
      const locationData: ServiceTitanLocation = await locationResponse.json();

      // Get phone from location contacts
      const phoneContact = locationData.contacts?.find(
        (c) => c.type === 'Phone' || c.type === 'MobilePhone'
      );
      if (phoneContact) {
        customerPhone = phoneContact.value;
      }

      // Build address from location
      if (locationData.address) {
        const addr = locationData.address;
        customerAddress = [addr.street, addr.city, addr.state, addr.zip]
          .filter(Boolean)
          .join(', ');
      }
    }
  } catch (locError) {
    console.error(`Failed to fetch location ${job.locationId}:`, locError);
  }

  // Fetch first appointment for scheduled date and tech name
  try {
    const apptResponse = await fetch(
      `https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/appointments?` +
        new URLSearchParams({
          jobId: job.id.toString(),
          pageSize: '1',
        }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'ST-App-Key': config.appKey,
        },
      }
    );

    if (apptResponse.ok) {
      const apptData = await apptResponse.json();
      if (apptData.data && apptData.data.length > 0) {
        scheduledDate = apptData.data[0].start;
        // Try to get tech name from appointment
        if (apptData.data[0].assignedTechnicians?.length > 0) {
          techName = apptData.data[0].assignedTechnicians[0].name || '';
        }
      }
    }
  } catch (apptError) {
    console.error(`Failed to fetch appointments for job ${job.id}:`, apptError);
  }

  return { customerName, customerPhone, customerAddress, scheduledDate, techName };
}

/**
 * Fetch estimates for a specific ST job and determine what pipeline status it should have.
 * Returns the new status and estimated value (if available).
 */
async function getStatusFromEstimates(
  jobId: string,
  customerId: number,
  currentStatus: string,
  config: { tenantId: string; appKey: string },
  token: string
): Promise<{ status: string; estimatedValue?: number } | null> {
  try {
    const estRes = await fetch(
      `https://api.servicetitan.io/sales/v2/tenant/${config.tenantId}/estimates?` +
        new URLSearchParams({ jobId, pageSize: '50' }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'ST-App-Key': config.appKey,
        },
      }
    );

    if (!estRes.ok) return null;

    const estData = await estRes.json();
    const estimates: any[] = estData.data || [];

    if (estimates.length === 0) return null;

    const stCustomerId = (estimates[0].customerId || customerId)?.toString();

    // Check for sold estimate first (highest priority)
    const soldEst = estimates.find(
      (e) => e.status?.name === 'Sold' || e.status?.name === 'sold'
    );

    if (soldEst) {
      const estimatedValue = soldEst.total || soldEst.subtotal || 0;

      // Check for install job at this customer (only if not already past Sold)
      if (currentStatus !== 'Install Scheduled' && currentStatus !== 'Completed') {
        const installStatus = await getInstallJobStatus(
          stCustomerId,
          jobId,
          soldEst.soldOn,
          config,
          token
        );
        if (installStatus) {
          return { status: installStatus, estimatedValue };
        }
      }

      return { status: 'Sold', estimatedValue };
    }

    // Has open/pending estimate — move to Quoted if not already further
    const currentIdx = STATUS_ORDER.indexOf(currentStatus);
    const quotedIdx = STATUS_ORDER.indexOf('Quoted');
    if (currentIdx < quotedIdx) {
      const est = estimates[0];
      return {
        status: 'Quoted',
        estimatedValue: est.total || est.subtotal || 0,
      };
    }

    return null;
  } catch (err) {
    console.error(`Error fetching estimates for job ${jobId}:`, err);
    return null;
  }
}

/**
 * Check if a customer has an install job created after the estimate was sold.
 * Returns 'Install Scheduled' or 'Completed' if found, null otherwise.
 */
async function getInstallJobStatus(
  customerId: string,
  originalJobId: string,
  soldOn: string | undefined,
  config: { tenantId: string; appKey: string },
  token: string
): Promise<string | null> {
  try {
    // Look back from 1 day before the estimate was sold (or 90 days if no soldOn)
    const lookbackDate = soldOn
      ? new Date(new Date(soldOn).getTime() - 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const jobsRes = await fetch(
      `https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/jobs?` +
        new URLSearchParams({
          customerId,
          createdOnOrAfter: lookbackDate.toISOString(),
          pageSize: '20',
        }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'ST-App-Key': config.appKey,
        },
      }
    );

    if (!jobsRes.ok) return null;

    const jobsData = await jobsRes.json();
    const customerJobs: ServiceTitanJob[] = jobsData.data || [];

    // Find jobs that are NOT the original sales/lead job
    const relatedJobs = customerJobs.filter(
      (j) =>
        j.id.toString() !== originalJobId &&
        j.jobTypeId?.toString() !== MKTG_LEAD_JOB_TYPE_ID
    );

    if (relatedJobs.length === 0) return null;

    // Completed install takes priority
    const completedJob = relatedJobs.find(
      (j) =>
        j.jobStatus === 'Complete' ||
        j.jobStatus === 'Completed' ||
        j.jobStatus === 'Closed'
    );
    if (completedJob) return 'Completed';

    // Then check for scheduled/in-progress install
    const activeJob = relatedJobs.find(
      (j) =>
        j.jobStatus === 'Scheduled' ||
        j.jobStatus === 'Dispatched' ||
        j.jobStatus === 'InProgress' ||
        j.jobStatus === 'OnSite' ||
        j.jobStatus === 'Pending'
    );
    if (activeJob) return 'Install Scheduled';

    return null;
  } catch (err) {
    console.error(`Error checking install job for customer ${customerId}:`, err);
    return null;
  }
}

/**
 * Sync pipeline status for all active ST-linked leads based on estimates and install jobs.
 * Also retroactively fixes advisor assignments for marketed leads by checking the ST appointment.
 * Only moves status forward (no backwards movement).
 */
async function syncExistingLeadStatuses(
  config: { tenantId: string; appKey: string },
  token: string,
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<{ synced: number; details: any[] }> {
  // Get all active leads with ST IDs (skip Completed — nothing to progress)
  const { data: activeLeads, error } = await supabase
    .from('leads')
    .select('id, service_titan_id, status, estimated_value')
    .not('service_titan_id', 'is', null)
    .neq('status', 'Completed');

  if (error || !activeLeads || activeLeads.length === 0) {
    return { synced: 0, details: [] };
  }

  // Fix "New Lead" leads that already have an advisor assigned → bump to "Assigned"
  const newLeadsWithAdvisor = await supabase
    .from('leads')
    .select('id')
    .eq('status', 'New Lead')
    .not('assigned_advisor_id', 'is', null);

  if (newLeadsWithAdvisor.data && newLeadsWithAdvisor.data.length > 0) {
    await supabase
      .from('leads')
      .update({ status: 'Assigned' })
      .in('id', newLeadsWithAdvisor.data.map((l) => l.id));
  }

  // ── Retroactive advisor fix ────────────────────────────────────────────────
  // For ALL lead types, check who ST actually has assigned and correct our DB.
  //
  // • Marketed leads: CA is the "technician" on the marketing-lead job's appointment.
  // • TGL leads:      CA is on the SEPARATE sales-BU follow-up job the office creates.
  //                   We find that job by looking at the customer's HVAC-Sales-BU jobs.
  try {
    const { data: leadsToCheck } = await supabase
      .from('leads')
      .select('id, service_titan_id, assigned_advisor_id, lead_type')
      .in('status', ['New Lead', 'Assigned', 'Quoted'])
      .not('service_titan_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20); // Cap ST API calls per poll cycle

    for (const lead of leadsToCheck || []) {
      try {
        let jobIdForAppt = lead.service_titan_id;

        // For TGL leads, find the CA's sales job rather than the tech's original job
        if (lead.lead_type === 'TGL') {
          const techJobRes = await fetch(
            `https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/jobs/${lead.service_titan_id}`,
            { headers: { Authorization: `Bearer ${token}`, 'ST-App-Key': config.appKey } }
          );
          if (!techJobRes.ok) continue;

          const techJob = await techJobRes.json();
          const customerId: number | undefined = techJob.customerId;
          if (!customerId) continue;

          const salesJobsRes = await fetch(
            `https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/jobs?` +
              new URLSearchParams({
                customerId: customerId.toString(),
                businessUnitId: HVAC_SALES_BU_ID,
                pageSize: '5',
              }),
            { headers: { Authorization: `Bearer ${token}`, 'ST-App-Key': config.appKey } }
          );
          if (!salesJobsRes.ok) continue;

          const salesJobsData = await salesJobsRes.json();
          const salesJob = (salesJobsData.data || []).find(
            (j: any) => j.id.toString() !== lead.service_titan_id
          );
          if (!salesJob) continue; // No CA job yet — nothing to fix
          jobIdForAppt = salesJob.id.toString();
        }

        // Fetch the appointment for that job to get the assigned CA
        const apptRes = await fetch(
          `https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/appointments?` +
            new URLSearchParams({ jobId: jobIdForAppt, pageSize: '1' }),
          { headers: { Authorization: `Bearer ${token}`, 'ST-App-Key': config.appKey } }
        );
        if (!apptRes.ok) continue;

        const apptData = await apptRes.json();
        const assignedName: string | undefined =
          apptData.data?.[0]?.assignedTechnicians?.[0]?.name;
        if (!assignedName) continue;

        const matchedAdvisor = await findAdvisorByName(assignedName, supabase);
        if (!matchedAdvisor || matchedAdvisor.id === lead.assigned_advisor_id) continue;

        // Advisor in ST doesn't match what we have — fix it
        await supabase
          .from('leads')
          .update({ assigned_advisor_id: matchedAdvisor.id })
          .eq('id', lead.id);

        console.log(`Fixed advisor for lead ${lead.id} (${lead.lead_type}): "${assignedName}" → ${matchedAdvisor.name}`);
      } catch (err) {
        console.error(`Error fixing advisor for lead ${lead.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Error in retroactive advisor sync:', err);
  }

  // For leads in Assigned, Quoted, or Sold status — check estimates in parallel
  const leadsToCheck = activeLeads.filter((l) =>
    ['Assigned', 'New Lead', 'Quoted', 'Sold', 'Install Scheduled'].includes(l.status)
  );

  const syncResults = await Promise.all(
    leadsToCheck.map(async (lead) => {
      const result = await getStatusFromEstimates(
        lead.service_titan_id,
        0,
        lead.status,
        config,
        token
      );

      if (!result) return null;

      const currentIdx = STATUS_ORDER.indexOf(lead.status);
      const newIdx = STATUS_ORDER.indexOf(result.status);

      // Only move forward
      const statusChanged = newIdx > currentIdx;
      const valueChanged =
        result.estimatedValue !== undefined &&
        result.estimatedValue > 0 &&
        result.estimatedValue !== lead.estimated_value;

      if (!statusChanged && !valueChanged) return null;

      const updatePayload: Record<string, any> = {};
      if (statusChanged) updatePayload.status = result.status;
      if (valueChanged) updatePayload.estimated_value = result.estimatedValue;

      const { error: updateError } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', lead.id);

      if (updateError) {
        console.error(`Failed to update lead ${lead.id}:`, updateError);
        return null;
      }

      return {
        leadId: lead.id,
        stJobId: lead.service_titan_id,
        from: lead.status,
        to: result.status,
        estimatedValue: result.estimatedValue,
      };
    })
  );

  const details = syncResults.filter(Boolean);
  return { synced: details.length, details };
}

/**
 * Rotate queue positions entirely in application code, filtering only in-queue advisors.
 * Replaces the rotate_queue_positions SQL RPC which didn't respect in_queue.
 */
async function rotateQueue(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  assignedAdvisorId: string,
  queueType: 'marketed' | 'tgl',
  advisors: any[]
) {
  const posField = queueType === 'marketed' ? 'marketed_queue_position' : 'tgl_queue_position';
  const inQueue = advisors.filter((a) => a.active && a.in_queue);
  if (inQueue.length === 0) return;

  const maxPos = Math.max(...inQueue.map((a) => a[posField]));

  await Promise.all(
    inQueue.map((a) => {
      const newPos = a.id === assignedAdvisorId
        ? maxPos
        : a[posField] > 1
          ? a[posField] - 1
          : a[posField];
      return supabase
        .from('comfort_advisors')
        .update({ [posField]: newPos })
        .eq('id', a.id);
    })
  );
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();

  try {
    // Allow requests from cron (CRON_SECRET header) or authenticated sessions
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── CRON LOCK: Prevent overlapping poll runs ────────────────────────────
    const lockCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5-min stale lock
    const { data: lockData } = await supabase
      .from('cron_lock')
      .select('locked_at')
      .eq('id', 'poll')
      .single();

    if (lockData?.locked_at && lockData.locked_at > lockCutoff) {
      return NextResponse.json({
        success: false,
        message: 'Poll already running (locked)',
        lockedAt: lockData.locked_at,
      });
    }

    // Acquire lock
    const lockId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await supabase
      .from('cron_lock')
      .update({ locked_at: new Date().toISOString(), locked_by: lockId })
      .eq('id', 'poll');

    // Check if Service Titan is configured
    if (!isServiceTitanConfigured()) {
      await releaseLock(supabase);
      return NextResponse.json({
        success: false,
        error: 'Service Titan not configured',
      });
    }

    const config = getServiceTitanConfigFromEnv()!;
    const token = await authenticateServiceTitan(config);

    // ── DEBUG: List available forms ────────────────────────────────────────────
    const body = await request.json().catch(() => ({}));
    if (body?.action === 'getForms') {
      const paths = [
        `https://api.servicetitan.io/forms/v2/tenant/${config.tenantId}/forms?pageSize=100`,
        `https://api.servicetitan.io/forms/v2/tenant/${config.tenantId}/form-definitions?pageSize=100`,
        `https://api.servicetitan.io/forms/v1/tenant/${config.tenantId}/forms?pageSize=100`,
        `https://api.servicetitan.io/service/v2/tenant/${config.tenantId}/forms?pageSize=100`,
      ];
      const results: Record<string, any> = {};
      for (const path of paths) {
        try {
          const res = await fetch(path, {
            headers: { Authorization: `Bearer ${token}`, 'ST-App-Key': config.appKey },
          });
          const text = await res.text();
          try { results[path] = { status: res.status, data: JSON.parse(text) }; }
          catch { results[path] = { status: res.status, raw: text.slice(0, 300) }; }
        } catch (e: any) {
          results[path] = { error: e.message };
        }
      }
      return NextResponse.json({ success: true, results });
    }

    // ── STEP 1: Sync existing lead statuses from ST estimates ──────────────────
    const syncResult = await syncExistingLeadStatuses(config, token, supabase);

    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // ── STEP 2: Find "TGL Form" and fetch recent submissions ──────────────────
    // Form submissions are a one-time event, eliminating duplicate notifications
    // that occurred with the tag-based approach (tags persist through job updates).
    const tglJobIdsFromForms: string[] = [];
    let tglFormFound = false;

    try {
      const formsResponse = await fetch(
        `https://api.servicetitan.io/forms/v2/tenant/${config.tenantId}/forms?` +
          new URLSearchParams({ pageSize: '100' }),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'ST-App-Key': config.appKey,
          },
        }
      );

      if (formsResponse.ok) {
        const formsData = await formsResponse.json();
        // Exact match only — excludes "TGL Form - Luke", "TGL Form - Christina Commercial", etc.
        const tglForms = (formsData.data || []).filter(
          (f: { id: number; name: string; published: boolean }) =>
            f.name.trim() === TGL_FORM_NAME && f.published
        );

        if (tglForms.length > 0) {
          tglFormFound = true;

          // Fetch submissions for each matching TGL form
          for (const tglForm of tglForms) {
            const subsResponse = await fetch(
              `https://api.servicetitan.io/forms/v2/tenant/${config.tenantId}/submissions?` +
                new URLSearchParams({
                  formId: tglForm.id.toString(),
                  createdOnOrAfter: startDate.toISOString(),
                  pageSize: '200',
                }),
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'ST-App-Key': config.appKey,
                },
              }
            );

            if (subsResponse.ok) {
              const subsData = await subsResponse.json();
              for (const sub of (subsData.data || []) as ServiceTitanFormSubmission[]) {
                if (sub.jobId) {
                  tglJobIdsFromForms.push(sub.jobId.toString());
                }
              }
            }
          }
        }
      }
    } catch (formError) {
      console.error('Failed to fetch TGL form submissions:', formError);
    }

    // ── STEP 3: Fetch recent jobs from Service Titan ───────────────────────────
    const jobsResponse = await fetch(
      `https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/jobs?` +
        new URLSearchParams({
          pageSize: '200',
          modifiedOnOrAfter: startDate.toISOString(),
        }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'ST-App-Key': config.appKey,
        },
      }
    );

    if (!jobsResponse.ok) {
      const errorText = await jobsResponse.text();
      throw new Error(`Failed to fetch jobs: ${jobsResponse.status} - ${errorText}`);
    }

    const jobsData = await jobsResponse.json();
    const allJobs: ServiceTitanJob[] = jobsData.data || [];

    // ── STEP 4: Separate marketed lead jobs and TGL jobs ──────────────────────
    const marketedLeadJobs = allJobs.filter(
      (job) =>
        job.businessUnitId?.toString() === HVAC_SALES_BU_ID &&
        job.jobTypeId?.toString() === MKTG_LEAD_JOB_TYPE_ID
    );

    // TGL: build job objects from form submission job IDs.
    // Some jobs won't be in allJobs (job itself wasn't recently modified), so fetch those individually.
    const tglJobMap = new Map<string, ServiceTitanJob>();
    for (const job of allJobs) {
      if (tglJobIdsFromForms.includes(job.id.toString())) {
        tglJobMap.set(job.id.toString(), job);
      }
    }

    const missingTglJobIds = tglJobIdsFromForms.filter((id) => !tglJobMap.has(id));
    for (const jobId of missingTglJobIds) {
      try {
        const jobRes = await fetch(
          `https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/jobs/${jobId}`,
          { headers: { Authorization: `Bearer ${token}`, 'ST-App-Key': config.appKey } }
        );
        if (jobRes.ok) {
          tglJobMap.set(jobId, await jobRes.json());
        }
      } catch (err) {
        console.error(`Failed to fetch TGL job ${jobId}:`, err);
      }
    }

    // Exclude HVAC - Sales BU (those are marketed leads, not TGLs)
    const tglJobs = [...tglJobMap.values()].filter(
      (job) => job.businessUnitId?.toString() !== HVAC_SALES_BU_ID
    );

    // ── STEP 5: Skip jobs already in our system (30-day dedup window) ────────
    const allJobIds = [...marketedLeadJobs, ...tglJobs].map((j) => j.id.toString());
    const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('service_titan_id')
      .in('service_titan_id', allJobIds)
      .gte('created_at', dedupCutoff);

    const existingJobIds = new Set((existingLeads || []).map((l) => l.service_titan_id));

    const newMarketedJobs = marketedLeadJobs.filter((j) => !existingJobIds.has(j.id.toString()));
    const newTglJobs = tglJobs.filter((j) => !existingJobIds.has(j.id.toString()));

    // ── STEP 6: Get advisors for both queues ──────────────────────────────────
    const { data: marketedAdvisors } = await supabase
      .from('comfort_advisors')
      .select('*')
      .eq('active', true)
      .eq('in_queue', true)
      .not('marketed_queue_position', 'is', null)
      .order('marketed_queue_position', { ascending: true });

    const { data: tglAdvisors } = await supabase
      .from('comfort_advisors')
      .select('*')
      .eq('active', true)
      .eq('in_queue', true)
      .not('tgl_queue_position', 'is', null)
      .order('tgl_queue_position', { ascending: true });

    const results: any[] = [];
    const slackConfigured = isSlackConfigured();
    const allNewJobs = [...newMarketedJobs, ...newTglJobs];

    // ── EMPTY QUEUE CHECK: DM Scott if no advisors available ────────────────
    if (allNewJobs.length > 0 && (!marketedAdvisors || marketedAdvisors.length === 0) && (!tglAdvisors || tglAdvisors.length === 0)) {
      // Check for leads that haven't notified Scott yet
      for (const job of allNewJobs) {
        // Insert as unassigned "New Lead" so it doesn't get lost
        const isMarketed = marketedLeadJobs.some(m => m.id === job.id);
        const details = await fetchJobDetails(job, config, token);

        const { data: newLead } = await supabase
          .from('leads')
          .insert({
            client_name: details.customerName,
            lead_type: isMarketed ? 'Marketed' : 'TGL',
            source: 'Service Titan',
            status: 'New Lead',
            phone: details.customerPhone,
            address: details.customerAddress,
            service_titan_id: job.id.toString(),
            tech_name: details.techName,
            notes: `Job #${job.jobNumber} - No advisors in queue at time of import`,
          })
          .select()
          .single();

        if (newLead && slackConfigured) {
          await sendEmptyQueueAlert(details.customerName, job.jobNumber, isMarketed ? 'Marketed' : 'TGL');
          await supabase.from('leads').update({ scott_notified_at: new Date().toISOString() }).eq('id', newLead.id);
        }

        results.push({
          jobId: job.id,
          type: isMarketed ? 'Marketed' : 'TGL',
          customerName: details.customerName,
          assignedTo: 'NONE - empty queue',
          success: true,
        });
      }
    }

    // ── STEP 7: Process new marketed leads ────────────────────────────────────
    if (newMarketedJobs.length > 0 && marketedAdvisors && marketedAdvisors.length > 0) {
      // Round-robin index — only increments when ST has no assignment and we fall back
      let rrIdx = 0;

      for (let i = 0; i < newMarketedJobs.length; i++) {
        const job = newMarketedJobs[i];

        try {
          const details = await fetchJobDetails(job, config, token);

          // ── Advisor resolution ──────────────────────────────────────────────
          // For marketed lead jobs, the "technician" in the ST appointment IS
          // the comfort advisor assigned by the office. Use them directly instead
          // of our local round-robin queue.
          let advisor = marketedAdvisors[rrIdx % marketedAdvisors.length];
          let stAssigned = false;

          if (details.techName) {
            const matchedCA = await findAdvisorByName(details.techName, supabase);
            if (matchedCA) {
              advisor = matchedCA as typeof advisor;
              stAssigned = true;
            }
          }

          if (!stAssigned) {
            // No ST match — use round-robin and rotate the queue
            rrIdx++;
          }

          const { data: newLead, error: insertError } = await supabase
            .from('leads')
            .insert({
              client_name: details.customerName,
              lead_type: 'Marketed',
              source: 'Service Titan',
              status: 'Assigned',
              assigned_advisor_id: advisor.id,
              phone: details.customerPhone,
              address: details.customerAddress,
              service_titan_id: job.id.toString(),
              notes: `Job #${job.jobNumber} - Auto-imported from Service Titan`,
            })
            .select()
            .single();

          if (insertError) {
            console.error(`Failed to create marketed lead for job ${job.id}:`, insertError);
            results.push({ jobId: job.id, type: 'Marketed', success: false, error: insertError.message });
            continue;
          }

          // Send Slack DM to assigned advisor (one DM per lead)
          let slackSent = false;
          if (slackConfigured) {
            const slackResult = await sendLeadAssignmentDM({
              jobId: job.id.toString(),
              jobNumber: job.jobNumber,
              leadType: 'Marketed',
              customerName: details.customerName,
              customerPhone: details.customerPhone,
              customerAddress: details.customerAddress,
              scheduledDate: details.scheduledDate,
              leadId: newLead.id,
              advisor: {
                name: advisor.name,
                email: advisor.email,
                phone: advisor.phone,
              },
            });
            slackSent = slackResult.ok;

            // Mark DM sent + log assignment
            await supabase.from('leads').update({
              dm_sent_at: new Date().toISOString(),
              assigned_at: new Date().toISOString(),
            }).eq('id', newLead.id);

            await supabase.from('lead_assignment_log').insert({
              lead_id: newLead.id,
              advisor_id: advisor.id,
              lead_type: 'Marketed',
              assigned_via: stAssigned ? 'service-titan' : 'round-robin',
              queue_position: advisor.marketed_queue_position,
              notification_status: slackResult.ok ? 'sent' : 'failed',
              notification_error: slackResult.error || null,
            });
          }

          // Only rotate queue when we used round-robin (not when ST assigned)
          if (!stAssigned) {
            await rotateQueue(supabase, advisor.id, 'marketed', marketedAdvisors || []);
          }

          results.push({
            jobId: job.id,
            jobNumber: job.jobNumber,
            type: 'Marketed',
            customerName: details.customerName,
            assignedTo: advisor.name,
            assignedVia: stAssigned ? 'service-titan' : 'round-robin',
            leadId: newLead.id,
            slackNotified: slackSent,
            success: true,
          });
        } catch (jobError: any) {
          console.error(`Error processing marketed job ${job.id}:`, jobError);
          results.push({ jobId: job.id, type: 'Marketed', success: false, error: jobError.message });
        }
      }
    }

    // ── STEP 8: Process new TGL leads ─────────────────────────────────────────
    if (newTglJobs.length > 0 && tglAdvisors && tglAdvisors.length > 0) {
      for (let i = 0; i < newTglJobs.length; i++) {
        const job = newTglJobs[i];
        const advisorIndex = i % tglAdvisors.length;
        const advisor = tglAdvisors[advisorIndex];

        try {
          const details = await fetchJobDetails(job, config, token);

          const { data: newLead, error: insertError } = await supabase
            .from('leads')
            .insert({
              client_name: details.customerName,
              lead_type: 'TGL',
              source: 'Service Titan',
              status: 'Assigned',                    // ← Fixed: was 'New Lead'
              assigned_advisor_id: advisor.id,
              phone: details.customerPhone,
              address: details.customerAddress,
              service_titan_id: job.id.toString(),
              tech_name: details.techName,
              notes: `Job #${job.jobNumber} - TGL Request from ${details.techName || 'Tech'}`,
            })
            .select()
            .single();

          if (insertError) {
            console.error(`Failed to create TGL lead for job ${job.id}:`, insertError);
            results.push({ jobId: job.id, type: 'TGL', success: false, error: insertError.message });
            continue;
          }

          // Send Slack DM to assigned advisor + confirmation to tech
          let slackSent = false;
          if (slackConfigured) {
            const slackResult = await sendLeadAssignmentDM({
              jobId: job.id.toString(),
              jobNumber: job.jobNumber,
              leadType: 'TGL',
              customerName: details.customerName,
              customerPhone: details.customerPhone,
              customerAddress: details.customerAddress,
              scheduledDate: details.scheduledDate,
              leadId: newLead.id,
              techName: details.techName,
              advisor: {
                name: advisor.name,
                email: advisor.email,
                phone: advisor.phone,
              },
            });
            slackSent = slackResult.ok;

            // Send confirmation DM to the tech who submitted the TGL
            if (details.techName) {
              // Try to find the tech's email via ST employees (best effort)
              try {
                const techEmail = await findTechEmail(details.techName, config, token);
                if (techEmail) {
                  await sendTechConfirmationDM(
                    techEmail,
                    advisor.name,
                    details.customerName,
                    job.jobNumber
                  );
                }
              } catch (techDmErr) {
                console.warn(`Could not DM tech ${details.techName}:`, techDmErr);
              }
            }

            // Mark DM sent + log assignment
            await supabase.from('leads').update({
              dm_sent_at: new Date().toISOString(),
              assigned_at: new Date().toISOString(),
            }).eq('id', newLead.id);

            await supabase.from('lead_assignment_log').insert({
              lead_id: newLead.id,
              advisor_id: advisor.id,
              lead_type: 'TGL',
              assigned_via: 'round-robin',
              queue_position: advisor.tgl_queue_position,
              notification_status: slackResult.ok ? 'sent' : 'failed',
              notification_error: slackResult.error || null,
            });
          }

          // Rotate TGL queue
          await rotateQueue(supabase, advisor.id, 'tgl', tglAdvisors || []);

          results.push({
            jobId: job.id,
            jobNumber: job.jobNumber,
            type: 'TGL',
            customerName: details.customerName,
            techName: details.techName,
            assignedTo: advisor.name,
            leadId: newLead.id,
            slackNotified: slackSent,
            success: true,
          });
        } catch (jobError: any) {
          console.error(`Error processing TGL job ${job.id}:`, jobError);
          results.push({ jobId: job.id, type: 'TGL', success: false, error: jobError.message });
        }
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const marketedCount = results.filter((r) => r.type === 'Marketed' && r.success).length;
    const tglCount = results.filter((r) => r.type === 'TGL' && r.success).length;

    return NextResponse.json({
      success: true,
      message: [
        syncResult.synced > 0 ? `Updated ${syncResult.synced} lead status(es)` : null,
        successful > 0
          ? `Imported ${marketedCount} marketed lead(s) and ${tglCount} TGL(s)`
          : 'No new leads to import',
        failed > 0 ? `${failed} failed` : null,
      ]
        .filter(Boolean)
        .join('. '),
      statusSync: {
        updated: syncResult.synced,
        details: syncResult.details,
      },
      newLeads: {
        marketed: marketedCount,
        tgl: tglCount,
        failed,
        details: results,
      },
      totalMarketedJobs: marketedLeadJobs.length,
      totalTglJobs: tglJobs.length,
      tglFormFound,
      tglFormSubmissions: tglJobIdsFromForms.length,
      slackConfigured,
    });
  } catch (error: any) {
    console.error('Error in poll endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  } finally {
    // Always release the cron lock
    await releaseLock(supabase);
  }
}

/** Release the cron poll lock */
async function releaseLock(supabase: ReturnType<typeof createServerSupabaseClient>) {
  try {
    await supabase
      .from('cron_lock')
      .update({ locked_at: null, locked_by: null })
      .eq('id', 'poll');
  } catch (err) {
    console.error('Failed to release cron lock:', err);
  }
}

/** Try to find a tech's email from Service Titan employees list */
async function findTechEmail(
  techName: string,
  config: { tenantId: string; appKey: string },
  token: string
): Promise<string | null> {
  if (!techName) return null;

  try {
    const response = await fetch(
      `https://api.servicetitan.io/settings/v2/tenant/${config.tenantId}/technicians?` +
        new URLSearchParams({ pageSize: '200', active: 'true' }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'ST-App-Key': config.appKey,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const nameLower = techName.toLowerCase().trim();

    for (const tech of data.data || []) {
      const fullName = (tech.name || `${tech.firstName || ''} ${tech.lastName || ''}`).trim().toLowerCase();
      if (fullName === nameLower || fullName.includes(nameLower) || nameLower.includes(fullName)) {
        return tech.email || null;
      }
    }
  } catch (err) {
    console.warn(`Failed to look up tech email for ${techName}:`, err);
  }

  return null;
}

export async function GET() {
  return NextResponse.json({
    message: 'Lead polling endpoint',
    usage: 'POST to import new leads and sync pipeline status from Service Titan',
    configured: {
      serviceTitan: isServiceTitanConfigured(),
      slack: isSlackConfigured(),
    },
    statusSync: {
      description: 'Each poll also syncs pipeline status for existing leads based on ST estimates',
      progression: STATUS_ORDER.join(' → '),
    },
    leadTypes: {
      marketed: {
        trigger: `Business Unit ${HVAC_SALES_BU_ID} + Job Type ${MKTG_LEAD_JOB_TYPE_ID}`,
        slackChannel: 'Uses SLACK_WEBHOOK_URL',
      },
      tgl: {
        trigger: `ServiceTitan form submission: "${TGL_FORM_NAME}"`,
        slackChannel: 'Uses SLACK_TGL_WEBHOOK_URL',
      },
    },
  });
}
