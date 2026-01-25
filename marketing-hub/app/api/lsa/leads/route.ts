import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGoogleAdsClient, formatLeadType, formatLeadStatus } from '@/lib/google-ads';
import { hasPermission } from '@/lib/permissions';

/**
 * GET /api/lsa/leads
 * Get LSA leads for a date range
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

  // Check for LSA permission (reuse analytics permission for now)
  if (!hasPermission(role, permissions, 'marketing_hub', 'can_view_analytics')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '30d';
  const customerId = searchParams.get('customer_id') || undefined;

  // Calculate date range
  const endDate = new Date();
  let startDate = new Date();

  switch (period) {
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

    const leads = await client.getLSALeads(startDateStr, endDateStr, customerId);

    // Enhance with formatted values
    const enhancedLeads = leads.map(lead => ({
      ...lead,
      leadTypeFormatted: formatLeadType(lead.leadType),
      leadStatusFormatted: formatLeadStatus(lead.leadStatus),
      creationDate: new Date(lead.creationDateTime).toLocaleDateString(),
      creationTime: new Date(lead.creationDateTime).toLocaleTimeString(),
    }));

    // Calculate summary stats
    const summary = {
      totalLeads: leads.length,
      phoneLeads: leads.filter(l => l.leadType === 'PHONE_CALL').length,
      messageLeads: leads.filter(l => l.leadType === 'MESSAGE').length,
      bookingLeads: leads.filter(l => l.leadType === 'BOOKING').length,
      chargedLeads: leads.filter(l => l.leadCharged).length,
      newLeads: leads.filter(l => l.leadStatus === 'NEW').length,
      bookedLeads: leads.filter(l => l.leadStatus === 'BOOKED').length,
    };

    return NextResponse.json({
      leads: enhancedLeads,
      summary,
      period,
      dateRange: { start: startDateStr, end: endDateStr },
    });
  } catch (error: any) {
    console.error('Failed to fetch LSA leads:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}
