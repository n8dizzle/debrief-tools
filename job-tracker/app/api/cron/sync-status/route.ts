import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { notifyTrackerComplete } from '@/lib/notifications';

/**
 * Cron job to sync tracker status from ServiceTitan.
 * Runs daily.
 * - Marks trackers as completed when ST job is completed
 * - Updates scheduled dates if changed
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

  // Create sync log entry
  const { data: syncLog } = await supabase
    .from('tracker_sync_logs')
    .insert({
      sync_type: 'sync_status',
      status: 'running',
    })
    .select()
    .single();

  const logId = syncLog?.id;

  try {
    // Get active trackers with ServiceTitan job IDs
    const { data: trackers, error: trackersError } = await supabase
      .from('job_trackers')
      .select('*')
      .eq('status', 'active')
      .not('st_job_id', 'is', null);

    if (trackersError) {
      throw trackersError;
    }

    console.log(`Syncing status for ${trackers?.length || 0} active trackers`);

    let updated = 0;
    let completed = 0;
    const errors: string[] = [];

    for (const tracker of trackers || []) {
      if (!tracker.st_job_id) continue;

      try {
        const job = await st.getJob(tracker.st_job_id);
        if (!job) continue;

        const updates: Record<string, unknown> = {};
        let shouldComplete = false;

        // Check if job is completed in ServiceTitan
        if (job.jobStatus === 'Completed' && tracker.status !== 'completed') {
          updates.status = 'completed';
          updates.actual_completion = job.completedOn
            ? job.completedOn.split('T')[0]
            : new Date().toISOString().split('T')[0];
          updates.progress_percent = 100;
          shouldComplete = true;
        }

        // Update scheduled date if changed
        if (job.scheduledOn) {
          const jobScheduledDate = job.scheduledOn.split('T')[0];
          if (jobScheduledDate !== tracker.scheduled_date) {
            updates.scheduled_date = jobScheduledDate;
          }
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          await supabase.from('job_trackers').update(updates).eq('id', tracker.id);

          // Log the sync
          await supabase.from('tracker_activity').insert({
            tracker_id: tracker.id,
            activity_type: 'status_synced',
            description: shouldComplete
              ? 'Tracker marked complete (synced from ServiceTitan)'
              : 'Tracker updated from ServiceTitan',
            performed_by_system: true,
            metadata: { job_status: job.jobStatus },
          });

          if (shouldComplete) {
            // Mark all milestones as completed
            await supabase
              .from('tracker_milestones')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
              })
              .eq('tracker_id', tracker.id)
              .eq('status', 'pending');

            // Fetch updated tracker for notification
            const { data: updatedTracker } = await supabase
              .from('job_trackers')
              .select('*')
              .eq('id', tracker.id)
              .single();

            if (updatedTracker) {
              await notifyTrackerComplete(updatedTracker);
            }

            completed++;
          } else {
            updated++;
          }
        }
      } catch (error) {
        console.error(`Failed to sync tracker ${tracker.id}:`, error);
        errors.push(`Tracker ${tracker.tracking_code}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Update sync log
    if (logId) {
      await supabase
        .from('tracker_sync_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_processed: trackers?.length || 0,
          records_created: 0,
          records_updated: updated + completed,
          errors: errors.length > 0 ? errors.join('\n') : null,
          metadata: { completed_count: completed, updated_count: updated },
        })
        .eq('id', logId);
    }

    return NextResponse.json({
      success: true,
      checked: trackers?.length || 0,
      updated,
      completed,
    });
  } catch (error) {
    console.error('Sync status cron error:', error);

    // Update sync log with error
    if (logId) {
      await supabase
        .from('tracker_sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          errors: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', logId);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
