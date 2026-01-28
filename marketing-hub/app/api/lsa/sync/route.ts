import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGoogleAdsClient, getLeadTrade } from '@/lib/google-ads';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/lsa/sync
 * Sync LSA leads from Google Ads API to Supabase
 */
export async function POST(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '90');

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

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

    // Get performance data
    const performance = await client.getLSAPerformance(startDateStr, endDateStr);
    console.log(`[LSA Sync] Fetched performance data for ${performance.length} accounts`);

    // Upsert accounts
    const accountsToUpsert = performance.map(p => ({
      customer_id: p.customerId,
      customer_name: p.customerName,
      is_active: true,
      last_synced_at: new Date().toISOString(),
    }));

    if (accountsToUpsert.length > 0) {
      const { error: accountsError } = await supabase
        .from('lsa_accounts')
        .upsert(accountsToUpsert, {
          onConflict: 'customer_id',
        });

      if (accountsError) {
        console.error('[LSA Sync] Error upserting accounts:', accountsError);
      } else {
        console.log(`[LSA Sync] Upserted ${accountsToUpsert.length} accounts`);
      }
    }

    // Upsert leads
    let leadsInserted = 0;
    let leadsUpdated = 0;
    let leadErrors = 0;

    for (const lead of leads) {
      const trade = getLeadTrade(lead.categoryId);

      const leadData = {
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
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('lsa_leads')
        .upsert(leadData, {
          onConflict: 'google_lead_id',
        });

      if (error) {
        console.error(`[LSA Sync] Error upserting lead ${lead.id}:`, error.message);
        leadErrors++;
      } else {
        leadsInserted++;
      }
    }

    console.log(`[LSA Sync] Leads: ${leadsInserted} synced, ${leadErrors} errors`);

    return NextResponse.json({
      success: true,
      summary: {
        dateRange: { start: startDateStr, end: endDateStr },
        leadsFromApi: leads.length,
        leadsSynced: leadsInserted,
        leadErrors,
        accountsSynced: accountsToUpsert.length,
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
