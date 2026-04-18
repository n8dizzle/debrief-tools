import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { stClient } from '@/lib/servicetitan';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Normalize phone number to last 10 digits
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/**
 * POST /api/leads/fix-attribution
 *
 * Fixes unattributed ServiceTitan calls by matching their destination phone
 * number to known campaign tracking numbers, then updating the campaign in
 * ServiceTitan via the API and in the local st_calls table.
 *
 * Supports both session auth (manual) and cron auth (scheduled).
 */
export async function POST(request: NextRequest) {
  // Check for cron secret (for scheduled jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  // If not cron auth, check session
  if (!isCronAuth) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const syncSource = isCronAuth ? 'cron' : 'manual';
  console.log(`[Attribution Fix] Starting ${syncSource} run at ${new Date().toISOString()}`);

  try {
    // Step 1: Load all campaigns from campaign_channel_map that have tracking_numbers
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaign_channel_map')
      .select('st_campaign_id, st_campaign_name, tracking_numbers')
      .not('tracking_numbers', 'is', null);

    if (campaignError) {
      console.error('[Attribution Fix] Error loading campaign map:', campaignError);
      return NextResponse.json({ error: 'Failed to load campaign map' }, { status: 500 });
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('[Attribution Fix] No campaigns with tracking numbers found');
      return NextResponse.json({
        message: 'No campaigns with tracking numbers configured',
        stats: { totalUnattributed: 0, matched: 0, fixed: 0, errors: 0 },
      });
    }

    // Step 2: Build reverse map: normalized phone number -> campaign info
    const phoneToCampaign = new Map<string, { st_campaign_id: number; st_campaign_name: string }>();

    for (const campaign of campaigns) {
      if (!campaign.st_campaign_id || !campaign.st_campaign_name) continue;

      const numbers: string[] = Array.isArray(campaign.tracking_numbers)
        ? campaign.tracking_numbers
        : [];

      for (const num of numbers) {
        const normalized = normalizePhone(num);
        if (normalized) {
          phoneToCampaign.set(normalized, {
            st_campaign_id: campaign.st_campaign_id,
            st_campaign_name: campaign.st_campaign_name,
          });
        }
      }
    }

    console.log(`[Attribution Fix] Built phone map with ${phoneToCampaign.size} tracking numbers across ${campaigns.length} campaigns`);

    // Step 3: Query st_calls where campaign_name IS NULL and direction = 'Inbound'
    const { data: unattributedCalls, error: callsError } = await supabase
      .from('st_calls')
      .select('id, st_call_id, to_phone, from_phone, received_at')
      .is('campaign_name', null)
      .eq('direction', 'Inbound')
      .order('received_at', { ascending: false })
      .limit(500);

    if (callsError) {
      console.error('[Attribution Fix] Error loading unattributed calls:', callsError);
      return NextResponse.json({ error: 'Failed to load unattributed calls' }, { status: 500 });
    }

    const totalUnattributed = unattributedCalls?.length || 0;
    console.log(`[Attribution Fix] Found ${totalUnattributed} unattributed inbound calls`);

    if (totalUnattributed === 0) {
      return NextResponse.json({
        message: 'No unattributed calls to fix',
        stats: { totalUnattributed: 0, matched: 0, fixed: 0, errors: 0 },
      });
    }

    // Step 4: Match and fix calls
    let matched = 0;
    let fixed = 0;
    let errors = 0;

    for (const call of unattributedCalls!) {
      const normalizedTo = normalizePhone(call.to_phone);
      if (!normalizedTo) continue;

      const campaign = phoneToCampaign.get(normalizedTo);
      if (!campaign) continue;

      // Exact 10-digit match found
      matched++;

      try {
        // Update in ServiceTitan
        await (stClient as any).updateCallCampaign(call.st_call_id, campaign.st_campaign_id);

        // Update local st_calls row
        const { error: updateError } = await supabase
          .from('st_calls')
          .update({
            campaign_id: campaign.st_campaign_id,
            campaign_name: campaign.st_campaign_name,
          })
          .eq('id', call.id);

        if (updateError) {
          console.error(`[Attribution Fix] DB update failed for call ${call.st_call_id}:`, updateError);
          errors++;
          continue;
        }

        fixed++;
        console.log(
          `[Attribution Fix] Fixed call ${call.st_call_id}: ${normalizedTo} -> ${campaign.st_campaign_name} (ID: ${campaign.st_campaign_id})`
        );
      } catch (err) {
        errors++;
        console.error(
          `[Attribution Fix] ST API update failed for call ${call.st_call_id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    const stats = { totalUnattributed, matched, fixed, errors };
    console.log(`[Attribution Fix] Complete:`, stats);

    return NextResponse.json({
      message: `Fixed ${fixed} of ${matched} matched calls (${totalUnattributed} unattributed total)`,
      stats,
    });
  } catch (err) {
    console.error('[Attribution Fix] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Attribution fix failed', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
