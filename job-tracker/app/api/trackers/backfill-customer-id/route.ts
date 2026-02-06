import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';

/**
 * Backfill st_customer_id for trackers that have st_job_id but no st_customer_id.
 * POST /api/trackers/backfill-customer-id
 */
export async function POST(request: NextRequest) {
  // Verify cron secret or admin auth
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
    // Get trackers with st_job_id but no st_customer_id
    const { data: trackers, error: fetchError } = await supabase
      .from('job_trackers')
      .select('id, st_job_id, customer_name')
      .not('st_job_id', 'is', null)
      .is('st_customer_id', null);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!trackers || trackers.length === 0) {
      return NextResponse.json({ message: 'No trackers to backfill', updated: 0 });
    }

    let updated = 0;
    let failed = 0;

    for (const tracker of trackers) {
      try {
        // Look up job in ServiceTitan
        const job = await st.getJob(tracker.st_job_id);

        if (job?.customerId) {
          // Update tracker with customer ID
          const { error: updateError } = await supabase
            .from('job_trackers')
            .update({ st_customer_id: job.customerId })
            .eq('id', tracker.id);

          if (updateError) {
            console.error(`Failed to update tracker ${tracker.id}:`, updateError);
            failed++;
          } else {
            console.log(`Updated tracker ${tracker.id} (${tracker.customer_name}) with customer ID ${job.customerId}`);
            updated++;
          }
        } else {
          console.warn(`Job ${tracker.st_job_id} not found or has no customer ID`);
          failed++;
        }
      } catch (error) {
        console.error(`Error processing tracker ${tracker.id}:`, error);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      total: trackers.length,
      updated,
      failed,
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
