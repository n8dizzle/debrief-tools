import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGoogleAdsClient, getLeadTrade, getLSAAccountName } from '@/lib/google-ads';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/lsa/sync
 * Sync LSA leads + daily performance from Google Ads API to Supabase
 * Supports both session auth (manual) and cron auth (scheduled)
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

    const { role, permissions } = session.user as {
      role: 'employee' | 'manager' | 'owner';
      permissions: any;
    };

    // Only owners can sync
    if (role !== 'owner' && !hasPermission(role, permissions, 'marketing_hub', 'can_sync_data')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
  }

  const syncSource = isCronAuth ? 'cron' : 'manual';
  console.log(`[LSA Sync] Starting ${syncSource} sync at ${new Date().toISOString()}`);

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '90');

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  // Use local date components to avoid UTC timezone shift (CLAUDE.md rule #1)
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const startDateStr = formatLocalDate(startDate);
  const endDateStr = formatLocalDate(endDate);

  try {
    const client = getGoogleAdsClient();

    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: 'Google Ads API not configured' },
        { status: 500 }
      );
    }

    console.log(`[LSA Sync] Starting sync - fetching ALL leads (no date filter)`);

    // Get ALL leads from Google Ads (sync stores everything, filter on display)
    const leads = await client.getAllLSALeads();
    console.log(`[LSA Sync] Fetched ${leads.length} leads from Google Ads API`);

    // Get daily performance data (per-day-per-account for caching)
    const dailyPerformance = await client.getLSADailyPerformance(startDateStr, endDateStr);
    console.log(`[LSA Sync] Fetched ${dailyPerformance.length} daily performance rows`);

    // Derive unique accounts from daily performance AND leads, using friendly names
    const accountMap = new Map<string, { customer_id: string; customer_name: string }>();
    for (const row of dailyPerformance) {
      if (!accountMap.has(row.customerId)) {
        accountMap.set(row.customerId, {
          customer_id: row.customerId,
          customer_name: getLSAAccountName(row.customerId),
        });
      }
    }
    // Also add accounts from leads (covers new accounts with no ad spend yet)
    for (const lead of leads) {
      const cid = lead.customerId || '';
      if (cid && !accountMap.has(cid)) {
        accountMap.set(cid, {
          customer_id: cid,
          customer_name: getLSAAccountName(cid),
        });
      }
    }

    // Upsert accounts
    const accountsToUpsert = Array.from(accountMap.values()).map(a => ({
      ...a,
      is_active: true,
      last_synced_at: new Date().toISOString(),
    }));

    if (accountsToUpsert.length > 0) {
      const { error: accountsError } = await supabase
        .from('lsa_accounts')
        .upsert(accountsToUpsert, { onConflict: 'customer_id' });

      if (accountsError) {
        console.error('[LSA Sync] Error upserting accounts:', accountsError);
      } else {
        console.log(`[LSA Sync] Upserted ${accountsToUpsert.length} accounts`);
      }
    }

    // Upsert daily performance data to lsa_daily_performance (batched)
    let perfSynced = 0;
    let perfErrors = 0;
    if (dailyPerformance.length > 0) {
      const perfRows = dailyPerformance.map(row => ({
        customer_id: row.customerId,
        customer_name: getLSAAccountName(row.customerId),
        date: row.date,
        impressions: row.impressions,
        clicks: row.clicks,
        cost_micros: row.costMicros,
        phone_calls: row.phoneCalls,
        all_conversions: row.allConversions,
        search_top_impression_share: row.searchTopImpressionShare || 0,
        search_abs_top_impression_share: row.searchAbsTopImpressionShare || 0,
        synced_at: new Date().toISOString(),
      }));

      const BATCH_SIZE = 500;
      for (let i = 0; i < perfRows.length; i += BATCH_SIZE) {
        const batch = perfRows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('lsa_daily_performance')
          .upsert(batch, { onConflict: 'customer_id,date' });

        if (error) {
          console.error(`[LSA Sync] Error upserting performance batch ${i / BATCH_SIZE + 1}:`, error.message);
          perfErrors += batch.length;
        } else {
          perfSynced += batch.length;
        }
      }
      console.log(`[LSA Sync] Performance: ${perfSynced} synced, ${perfErrors} errors`);
    }

    // Upsert leads (batched in groups of 500 instead of one-at-a-time)
    let leadsSynced = 0;
    let leadErrors = 0;
    const now = new Date().toISOString();

    const leadRows = leads.map(lead => {
      const trade = getLeadTrade(lead.categoryId);
      return {
        google_lead_id: lead.id,
        customer_id: lead.customerId || '',
        lead_type: lead.leadType,
        category_id: lead.categoryId,
        service_id: lead.serviceName,
        trade,
        phone_number: lead.contactDetails.phoneNumber || null,
        consumer_phone_number: lead.contactDetails.consumerPhoneNumber || null,
        lead_status: lead.leadStatus,
        lead_charged: lead.leadCharged,
        credit_state: lead.creditDetails?.creditState || null,
        credit_state_updated_at: lead.creditDetails?.creditStateLastUpdateDateTime || null,
        lead_created_at: lead.creationDateTime,
        locale: lead.locale,
        synced_at: now,
        updated_at: now,
      };
    });

    const LEAD_BATCH_SIZE = 500;
    for (let i = 0; i < leadRows.length; i += LEAD_BATCH_SIZE) {
      const batch = leadRows.slice(i, i + LEAD_BATCH_SIZE);
      const { error } = await supabase
        .from('lsa_leads')
        .upsert(batch, { onConflict: 'google_lead_id' });

      if (error) {
        console.error(`[LSA Sync] Error upserting lead batch ${i / LEAD_BATCH_SIZE + 1}:`, error.message);
        leadErrors += batch.length;
      } else {
        leadsSynced += batch.length;
      }
    }

    console.log(`[LSA Sync] Leads: ${leadsSynced} synced, ${leadErrors} errors`);

    return NextResponse.json({
      success: true,
      summary: {
        dateRange: { start: startDateStr, end: endDateStr },
        leadsFromApi: leads.length,
        leadsSynced,
        leadErrors,
        accountsSynced: accountsToUpsert.length,
        performanceSynced: perfSynced,
        performanceErrors: perfErrors,
      },
    });
  } catch (error: any) {
    console.error('[LSA Sync] Failed:', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/lsa/sync
 * Get sync status
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get counts from Supabase
    const [leadsResult, accountsResult, latestSync] = await Promise.all([
      supabase.from('lsa_leads').select('id', { count: 'exact', head: true }),
      supabase.from('lsa_accounts').select('id', { count: 'exact', head: true }),
      supabase
        .from('lsa_leads')
        .select('synced_at')
        .order('synced_at', { ascending: false })
        .limit(1),
    ]);

    // Get date range of synced leads
    const [earliest, latest] = await Promise.all([
      supabase
        .from('lsa_leads')
        .select('lead_created_at')
        .order('lead_created_at', { ascending: true })
        .limit(1),
      supabase
        .from('lsa_leads')
        .select('lead_created_at')
        .order('lead_created_at', { ascending: false })
        .limit(1),
    ]);

    return NextResponse.json({
      totalLeads: leadsResult.count || 0,
      totalAccounts: accountsResult.count || 0,
      lastSyncedAt: latestSync.data?.[0]?.synced_at || null,
      dateRange: {
        earliest: earliest.data?.[0]?.lead_created_at || null,
        latest: latest.data?.[0]?.lead_created_at || null,
      },
    });
  } catch (error: any) {
    console.error('Failed to get sync status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
