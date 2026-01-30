import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGoogleAdsClient, formatLeadType, formatLeadStatus, getLeadTrade, formatCategoryId } from '@/lib/google-ads';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/lsa/leads
 * Get LSA leads - reads from Supabase cache, falls back to live API if empty
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role, permissions } = session.user as {
    role: 'employee' | 'manager' | 'owner';
    permissions: any;
  };

  if (!hasPermission(role, permissions, 'marketing_hub', 'can_view_analytics')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period');
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');
  const source = searchParams.get('source') || 'cache'; // 'cache' or 'live'

  // Calculate date range - support both period and explicit start/end
  let endDate: Date;
  let startDate: Date;

  if (startParam && endParam) {
    // Use explicit date range
    startDate = new Date(startParam + 'T00:00:00');
    endDate = new Date(endParam + 'T23:59:59');
  } else {
    // Use period-based range
    endDate = new Date();
    startDate = new Date();
    const p = period || '30d';

    switch (p) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }
  }

  const startDateStr = startDate.toISOString();
  const endDateStr = endDate.toISOString();

  try {
    // Try to read from Supabase cache first
    if (source === 'cache') {
      const { data: cachedLeads, error: cacheError } = await supabase
        .from('lsa_leads')
        .select('*')
        .gte('lead_created_at', startDateStr)
        .lte('lead_created_at', endDateStr)
        .order('lead_created_at', { ascending: false });

      if (!cacheError && cachedLeads && cachedLeads.length > 0) {
        console.log(`[LSA] Returning ${cachedLeads.length} leads from Supabase cache`);

        // Get account names
        const { data: accounts } = await supabase
          .from('lsa_accounts')
          .select('customer_id, customer_name');

        const accountMap = new Map(accounts?.map(a => [a.customer_id, a.customer_name]) || []);

        // Transform to match expected format
        const leads = cachedLeads.map(lead => ({
          id: lead.google_lead_id,
          leadType: lead.lead_type,
          leadTypeFormatted: formatLeadType(lead.lead_type),
          categoryId: lead.category_id || '',
          categoryFormatted: formatCategoryId(lead.category_id || ''),
          trade: lead.trade as 'HVAC' | 'Plumbing' | 'Other',
          serviceName: lead.service_id || '',
          contactDetails: {
            phoneNumber: lead.phone_number || '',
            consumerPhoneNumber: lead.consumer_phone_number || '',
          },
          leadStatus: lead.lead_status,
          leadStatusFormatted: formatLeadStatus(lead.lead_status),
          creationDateTime: lead.lead_created_at,
          creationDate: new Date(lead.lead_created_at).toLocaleDateString(),
          creationTime: new Date(lead.lead_created_at).toLocaleTimeString(),
          locale: lead.locale || '',
          leadCharged: lead.lead_charged,
          customerId: lead.customer_id,
          customerName: accountMap.get(lead.customer_id) || `Account ${lead.customer_id.slice(-4)}`,
          creditDetails: lead.credit_state ? {
            creditState: lead.credit_state,
            creditStateLastUpdateDateTime: lead.credit_state_updated_at || '',
          } : undefined,
        }));

        return buildResponse(leads, period || 'custom', startDateStr.split('T')[0], endDateStr.split('T')[0], 'cache');
      }

      console.log('[LSA] No cached data found, falling back to live API');
    }

    // Fall back to live API
    const client = getGoogleAdsClient();

    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: 'Google Ads API not configured' },
        { status: 500 }
      );
    }

    const apiLeads = await client.getLSALeads(
      startDateStr.split('T')[0],
      endDateStr.split('T')[0]
    );

    // Transform API response
    const leads = apiLeads.map(lead => {
      const trade = getLeadTrade(lead.categoryId);
      return {
        id: lead.id,
        leadType: lead.leadType,
        leadTypeFormatted: formatLeadType(lead.leadType),
        categoryId: lead.categoryId,
        categoryFormatted: formatCategoryId(lead.categoryId),
        trade,
        serviceName: lead.serviceName,
        contactDetails: lead.contactDetails,
        leadStatus: lead.leadStatus,
        leadStatusFormatted: formatLeadStatus(lead.leadStatus),
        creationDateTime: lead.creationDateTime,
        creationDate: new Date(lead.creationDateTime).toLocaleDateString(),
        creationTime: new Date(lead.creationDateTime).toLocaleTimeString(),
        locale: lead.locale,
        leadCharged: lead.leadCharged,
        customerId: lead.customerId || '',
        customerName: `Account ${(lead.customerId || '').slice(-4)}`,
        creditDetails: lead.creditDetails,
      };
    });

    return buildResponse(leads, period || 'custom', startDateStr.split('T')[0], endDateStr.split('T')[0], 'live');
  } catch (error: any) {
    console.error('Failed to fetch LSA leads:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

function buildResponse(
  leads: any[],
  period: string,
  startDate: string,
  endDate: string,
  source: string
) {
  // Calculate summary stats
  const chargedLeads = leads.filter(l => l.leadCharged);
  const nonChargedLeads = leads.filter(l => !l.leadCharged);

  const summary = {
    totalLeads: leads.length,
    phoneLeads: leads.filter(l => l.leadType === 'PHONE_CALL').length,
    messageLeads: leads.filter(l => l.leadType === 'MESSAGE').length,
    bookingLeads: leads.filter(l => l.leadType === 'BOOKING').length,
    chargedLeads: chargedLeads.length,
    nonChargedLeads: nonChargedLeads.length,
    newLeads: leads.filter(l => l.leadStatus === 'NEW').length,
    bookedLeads: leads.filter(l => l.leadStatus === 'BOOKED').length,
  };

  // Trade breakdown
  const tradeBreakdown = {
    hvac: {
      total: leads.filter(l => l.trade === 'HVAC').length,
      charged: leads.filter(l => l.trade === 'HVAC' && l.leadCharged).length,
      nonCharged: leads.filter(l => l.trade === 'HVAC' && !l.leadCharged).length,
    },
    plumbing: {
      total: leads.filter(l => l.trade === 'Plumbing').length,
      charged: leads.filter(l => l.trade === 'Plumbing' && l.leadCharged).length,
      nonCharged: leads.filter(l => l.trade === 'Plumbing' && !l.leadCharged).length,
    },
    other: {
      total: leads.filter(l => l.trade === 'Other').length,
      charged: leads.filter(l => l.trade === 'Other' && l.leadCharged).length,
      nonCharged: leads.filter(l => l.trade === 'Other' && !l.leadCharged).length,
    },
  };

  // Location breakdown
  const locationMap = new Map<string, {
    customerId: string;
    customerName: string;
    total: number;
    charged: number;
    nonCharged: number;
    hvac: number;
    plumbing: number;
    other: number;
  }>();

  for (const lead of leads) {
    const cid = lead.customerId || 'unknown';
    const existing = locationMap.get(cid) || {
      customerId: cid,
      customerName: lead.customerName || `Account ${cid.slice(-4)}`,
      total: 0,
      charged: 0,
      nonCharged: 0,
      hvac: 0,
      plumbing: 0,
      other: 0,
    };

    existing.total++;
    if (lead.leadCharged) existing.charged++;
    else existing.nonCharged++;

    if (lead.trade === 'HVAC') existing.hvac++;
    else if (lead.trade === 'Plumbing') existing.plumbing++;
    else existing.other++;

    locationMap.set(cid, existing);
  }

  const locationBreakdown = Array.from(locationMap.values())
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    leads,
    summary,
    tradeBreakdown,
    locationBreakdown,
    period,
    dateRange: { start: startDate, end: endDate },
    source, // 'cache' or 'live'
  });
}
