import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { formatLocalDate } from '@/lib/sd-utils';

export const maxDuration = 300;

async function runSync() {
  const supabase = getServerSupabase();
  const st = getServiceTitanClient();

  const syncLogId = crypto.randomUUID();
  const errors: string[] = [];
  let techsSynced = 0;
  let jobsSynced = 0;
  let leadsSynced = 0;
  let estimatesSynced = 0;
  let membershipsSynced = 0;

  // Insert sync log
  await supabase.from('sd_sync_log').insert({
    id: syncLogId,
    started_at: new Date().toISOString(),
    status: 'running',
    technicians_synced: 0,
    jobs_synced: 0,
    leads_synced: 0,
    memberships_synced: 0,
  });

  try {
    // ============================================
    // 1. SYNC TECHNICIANS
    // ============================================
    console.log('Syncing technicians...');
    const serviceBUIds = await st.getServiceBusinessUnitIds();
    const allBUs = await st.getBusinessUnits();
    const buMap = new Map(allBUs.map(bu => [bu.id, bu]));

    const allTechs = await st.getTechnicians();
    // Filter to service BUs
    const serviceTechs = allTechs.filter(t => t.businessUnitId && serviceBUIds.includes(t.businessUnitId));

    // Fetch existing team_members for review matching
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('id, name')
      .eq('is_active', true);

    const teamMemberMap = new Map<string, string>();
    if (teamMembers) {
      for (const tm of teamMembers) {
        // Normalize name for matching
        teamMemberMap.set(tm.name.toLowerCase().trim(), tm.id);
      }
    }

    for (const tech of serviceTechs) {
      const bu = tech.businessUnitId ? buMap.get(tech.businessUnitId) : null;
      const buName = bu?.name || null;
      const trade = buName ? st.getTradeFromBUName(buName) : 'hvac';

      // Match to team_members by name
      const teamMemberId = teamMemberMap.get(tech.name.toLowerCase().trim()) || null;

      const { error } = await supabase
        .from('sd_technicians')
        .upsert({
          st_technician_id: tech.id,
          name: tech.name,
          is_active: tech.active,
          business_unit_id: tech.businessUnitId || null,
          business_unit_name: buName,
          trade,
          team_member_id: teamMemberId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'st_technician_id' });

      if (error) {
        errors.push(`Tech ${tech.id}: ${error.message}`);
      } else {
        techsSynced++;
      }
    }
    console.log(`Synced ${techsSynced} technicians`);

    // ============================================
    // 2. SYNC COMPLETED JOBS (last 30 days)
    // ============================================
    console.log('Syncing completed jobs...');
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = formatLocalDate(thirtyDaysAgo);
    const endDate = formatLocalDate(now);

    const completedJobs = await st.getCompletedJobs(startDate, endDate, serviceBUIds);
    console.log(`Found ${completedJobs.length} completed service jobs`);

    // Get tech assignments via appointment-assignments (by date range per BU)
    // Fetched outside the if-block because step 3 (opportunities) also needs it
    const techAssignments = await st.getAppointmentAssignmentsForDateRange(startDate, endDate, serviceBUIds);

    if (completedJobs.length > 0) {
      // Get invoice subtotals (pre-tax revenue) for completed jobs
      const invoiceSubtotals = await st.getInvoiceSubtotalsByJob(startDate, endDate);

      // Get estimate counts per job (all estimates, not just sold)
      const estimateCounts = await st.getEstimateCountsByJob(startDate, endDate);

      // Build tech ID set for filtering
      const serviceTechIds = new Set(serviceTechs.map(t => t.id));

      for (const job of completedJobs) {
        const techId = techAssignments.get(job.id);
        if (!techId || !serviceTechIds.has(techId)) continue;

        const bu = buMap.get(job.businessUnitId);
        const buName = bu?.name || '';
        const trade = st.getTradeFromBUName(buName);

        const completedDate = job.completedOn
          ? formatLocalDate(new Date(job.completedOn))
          : endDate;

        // Use invoice subtotal (pre-tax) if available, fall back to job total
        const revenue = invoiceSubtotals.get(job.id) ?? job.total ?? 0;

        const { error } = await supabase
          .from('sd_completed_jobs')
          .upsert({
            st_job_id: job.id,
            st_technician_id: techId,
            job_total: revenue,
            completed_date: completedDate,
            business_unit_name: buName,
            trade,
            customer_name: null,
            estimate_count: estimateCounts.get(job.id) ?? 0,
          }, { onConflict: 'st_job_id' });

        if (error) {
          errors.push(`Job ${job.id}: ${error.message}`);
        } else {
          jobsSynced++;
        }
      }
    }
    console.log(`Synced ${jobsSynced} jobs`);

    // ============================================
    // 3. SYNC TECH-GENERATED LEADS / "Leads Set" (last 30 days)
    // Per ST definition: count unique source jobs where the tech is the
    // Lead Setting Employee. Date filter = source job completion date.
    // ============================================
    console.log('Syncing tech-generated leads (TGLs)...');
    const tgls = await st.getTechGeneratedLeads(startDate, endDate);
    console.log(`Found ${tgls.length} TGLs`);

    const serviceTechIdSet = new Set(serviceTechs.map(t => t.id));

    // Deduplicate by source job — one lead per unique source job per tech
    const seenSourceJobs = new Set<string>();

    for (const tgl of tgls) {
      // Only count if employee is one of our service techs
      if (!serviceTechIdSet.has(tgl.employeeId)) continue;

      // Dedupe key: sourceJobId + employeeId
      const key = `${tgl.sourceJobId}-${tgl.employeeId}`;
      if (seenSourceJobs.has(key)) continue;
      seenSourceJobs.add(key);

      // Use source job completion date (this is what ST filters on)
      const completedDate = tgl.sourceJobCompletedOn
        ? formatLocalDate(new Date(tgl.sourceJobCompletedOn))
        : formatLocalDate(new Date()); // fallback to today if no completion date

      const { error } = await supabase
        .from('sd_tgl_leads')
        .upsert({
          st_lead_id: tgl.sourceJobId,  // keyed on source job ID (one lead per source job)
          created_by_id: tgl.employeeId,
          source_job_id: tgl.sourceJobId,
          customer_name: null,
          status: completedDate ? 'completed' : 'pending',
          created_on: completedDate,  // source job completion date for date filtering
        }, { onConflict: 'st_lead_id' });

      if (error) {
        errors.push(`TGL ${tgl.sourceJobId}: ${error.message}`);
      } else {
        leadsSynced++;
      }
    }
    console.log(`Synced ${leadsSynced} TGLs (unique source jobs)`);

    // ============================================
    // 4. SYNC SOLD ESTIMATES / Sales (last 30 days)
    // "Total Sales" = sum of sold estimate subtotals on completed service BU jobs.
    // Tech credit goes to `soldBy` on the estimate.
    // Only estimates from completed jobs in service BUs.
    // ============================================
    console.log('Syncing sold estimates (Sales)...');
    const soldEstimates = await st.getSoldEstimates(startDate, endDate);
    console.log(`Found ${soldEstimates.length} sold estimates`);

    // Build set of completed service BU job IDs
    const completedJobIds = new Set(completedJobs.map(j => j.id));

    for (const est of soldEstimates) {
      if (!est.jobId || !est.soldBy) continue;

      // Only completed service BU jobs
      if (!completedJobIds.has(est.jobId)) continue;
      // soldBy must be a service tech
      if (!serviceTechIdSet.has(est.soldBy)) continue;

      const soldOnDate = est.soldOn
        ? formatLocalDate(new Date(est.soldOn))
        : endDate;

      const { error } = await supabase
        .from('sd_estimates')
        .upsert({
          st_estimate_id: est.id,
          st_job_id: est.jobId,
          sold_by_id: est.soldBy,
          subtotal: est.subtotal || 0,
          sold_on: soldOnDate,
          status: est.status?.name || 'Sold',
        }, { onConflict: 'st_estimate_id' });

      if (error) {
        errors.push(`Estimate ${est.id}: ${error.message}`);
      } else {
        estimatesSynced++;
      }
    }
    console.log(`Synced ${estimatesSynced} estimates`);

    // ============================================
    // 5. SYNC MEMBERSHIPS SOLD (last 30 days)
    // ============================================
    console.log('Syncing memberships sold...');
    const memberships = await st.getMembershipsSold(startDate, endDate);
    console.log(`Found ${memberships.length} memberships`);

    for (const mem of memberships) {
      if (!mem.soldById || !serviceTechIdSet.has(mem.soldById)) continue;

      const soldOnDate = mem.createdOn
        ? formatLocalDate(new Date(mem.createdOn))
        : endDate;

      const { error } = await supabase
        .from('sd_memberships_sold')
        .upsert({
          st_membership_id: mem.id,
          sold_by_id: mem.soldById,
          membership_type_name: mem.membershipTypeName || null,
          sold_on: soldOnDate,
        }, { onConflict: 'st_membership_id' });

      if (error) {
        errors.push(`Membership ${mem.id}: ${error.message}`);
      } else {
        membershipsSynced++;
      }
    }
    console.log(`Synced ${membershipsSynced} memberships`);

    // Update sync log
    await supabase
      .from('sd_sync_log')
      .update({
        completed_at: new Date().toISOString(),
        status: errors.length > 0 ? 'error' : 'success',
        technicians_synced: techsSynced,
        jobs_synced: jobsSynced,
        leads_synced: leadsSynced,
        memberships_synced: membershipsSynced,
        errors: errors.length > 0 ? errors.slice(0, 20) : null,
      })
      .eq('id', syncLogId);

    return {
      success: true,
      technicians_synced: techsSynced,
      jobs_synced: jobsSynced,
      leads_synced: leadsSynced,
      memberships_synced: membershipsSynced,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    };
  } catch (error: any) {
    console.error('Sync error:', error);

    await supabase
      .from('sd_sync_log')
      .update({
        completed_at: new Date().toISOString(),
        status: 'error',
        technicians_synced: techsSynced,
        jobs_synced: jobsSynced,
        leads_synced: leadsSynced,
        memberships_synced: membershipsSynced,
        errors: [error.message, ...errors].slice(0, 20),
      })
      .eq('id', syncLogId);

    throw error;
  }
}

export async function GET(request: NextRequest) {
  // Check for cron secret or session auth
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (authHeader === `Bearer ${cronSecret}` && cronSecret) {
    // Cron auth
  } else {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await runSync();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
