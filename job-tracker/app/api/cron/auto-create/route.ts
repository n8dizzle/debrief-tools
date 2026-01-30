import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import {
  getServiceTitanClient,
  determineTrade,
  determineJobType,
} from '@/lib/servicetitan';
import { generateTrackingCode } from '@/lib/tracking-code';
import { notifyTrackerCreated } from '@/lib/notifications';

/**
 * Cron job to auto-create trackers for new install jobs.
 * Runs at 8 AM CT on weekdays.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const st = getServiceTitanClient();
  if (!st.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }

  const supabase = getServerSupabase();

  try {
    // Get install jobs completed in last 24 hours
    const recentJobs = await st.getRecentInstallJobs(24);

    console.log(`Found ${recentJobs.length} recent install jobs`);

    let created = 0;
    let skipped = 0;

    for (const job of recentJobs) {
      // Check if tracker already exists for this job
      const { data: existing } = await supabase
        .from('job_trackers')
        .select('id')
        .eq('st_job_id', job.id)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      // Get customer info
      const customer = await st.getCustomer(job.customerId);
      if (!customer) {
        console.log(`Skipping job ${job.jobNumber}: customer not found`);
        skipped++;
        continue;
      }

      // Get location for address
      const location = await st.getLocation(job.locationId);
      const address = location?.address
        ? `${location.address.street}, ${location.address.city}, ${location.address.state} ${location.address.zip}`
        : null;

      // Determine trade and job type
      const trade = determineTrade(job);
      const jobType = determineJobType(job);

      // Find default template
      const { data: template } = await supabase
        .from('tracker_templates')
        .select('id')
        .eq('trade', trade)
        .eq('job_type', jobType)
        .eq('is_default', true)
        .single();

      // Generate tracking code
      let trackingCode = generateTrackingCode();
      let attempts = 0;
      while (attempts < 5) {
        const { data: exists } = await supabase
          .from('job_trackers')
          .select('id')
          .eq('tracking_code', trackingCode)
          .single();
        if (!exists) break;
        trackingCode = generateTrackingCode();
        attempts++;
      }

      // Create tracker
      const { data: tracker, error: trackerError } = await supabase
        .from('job_trackers')
        .insert({
          tracking_code: trackingCode,
          st_job_id: job.id,
          job_number: job.jobNumber,
          customer_name: customer.name,
          customer_email: customer.email || null,
          customer_phone: customer.phoneNumber || null,
          job_address: address,
          trade,
          job_type: jobType,
          template_id: template?.id || null,
          scheduled_date: job.scheduledOn ? job.scheduledOn.split('T')[0] : null,
          notify_email: !!customer.email,
          notify_sms: !!customer.phoneNumber,
          notification_email: customer.email || null,
          notification_phone: customer.phoneNumber || null,
          auto_created: true,
        })
        .select()
        .single();

      if (trackerError) {
        console.error(`Failed to create tracker for job ${job.jobNumber}:`, trackerError);
        continue;
      }

      // Copy milestones from template
      if (template?.id) {
        const { data: templateMilestones } = await supabase
          .from('tracker_template_milestones')
          .select('*')
          .eq('template_id', template.id)
          .order('sort_order', { ascending: true });

        if (templateMilestones && templateMilestones.length > 0) {
          const milestonesToInsert = templateMilestones.map((tm) => ({
            tracker_id: tracker.id,
            template_milestone_id: tm.id,
            name: tm.name,
            description: tm.description,
            icon: tm.icon,
            sort_order: tm.sort_order,
            is_optional: tm.is_optional,
            status: 'pending',
          }));

          await supabase.from('tracker_milestones').insert(milestonesToInsert);
        }
      }

      // Log activity
      await supabase.from('tracker_activity').insert({
        tracker_id: tracker.id,
        activity_type: 'tracker_auto_created',
        description: `Tracker auto-created from ServiceTitan job ${job.jobNumber}`,
        performed_by_system: true,
      });

      // Send welcome notification
      await notifyTrackerCreated(tracker);

      created++;
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: recentJobs.length,
    });
  } catch (error) {
    console.error('Auto-create cron error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
