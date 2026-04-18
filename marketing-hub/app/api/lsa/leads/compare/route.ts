import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLSAAccountName } from '@/lib/google-ads';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@supabase/supabase-js';
import { stClient } from '@/lib/servicetitan';

// Map LSA account customer IDs to their ServiceTitan tracking numbers
// These are the dedicated phone numbers for each LSA location
const LSA_TRACKING_NUMBERS: Record<string, string> = {
  '5362286439': '4695279002',   // Argyle (HVAC)
  '3320714390': '8179611234',   // Argyle (PLMBG)
  '3704224172': '4695279030',   // Justin
  '6799775782': '4695275550',   // Flower Mound
  '8265257082': '4695275665',   // Lewisville (Bart's)
  '5778669762': '4695279050',   // Lewisville (Xmas)
  '6930068549': '4695279060',   // Prosper
  '1807327952': '9402802422',   // Denton (HVAC)
  '4070893201': '9402151522',   // Denton (PLMBG)
};

// Reverse map: tracking number -> LSA customer ID
const TRACKING_TO_LSA = new Map(
  Object.entries(LSA_TRACKING_NUMBERS).map(([cid, tn]) => [tn, cid])
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LocationBreakdown {
  customerId: string;
  customerName: string;
  total: number;
  charged: number;
  nonCharged: number;
  booked: number;
  hvac: number;
  plumbing: number;
  other: number;
}

function aggregateLeads(leads: any[]): {
  locations: LocationBreakdown[];
  totals: { total: number; charged: number; booked: number; hvac: number; plumbing: number };
} {
  const locationMap = new Map<string, LocationBreakdown>();

  for (const lead of leads) {
    const cid = lead.customer_id || 'unknown';
    const existing = locationMap.get(cid) || {
      customerId: cid,
      customerName: '',
      total: 0,
      charged: 0,
      nonCharged: 0,
      booked: 0,
      hvac: 0,
      plumbing: 0,
      other: 0,
    };

    existing.total++;
    if (lead.lead_charged) existing.charged++;
    else existing.nonCharged++;
    if (lead.lead_status === 'BOOKED') existing.booked++;

    if (lead.trade === 'HVAC') existing.hvac++;
    else if (lead.trade === 'Plumbing') existing.plumbing++;
    else existing.other++;

    locationMap.set(cid, existing);
  }

  const locations = Array.from(locationMap.values()).sort((a, b) => b.total - a.total);
  const totals = locations.reduce(
    (acc, loc) => ({
      total: acc.total + loc.total,
      charged: acc.charged + loc.charged,
      booked: acc.booked + loc.booked,
      hvac: acc.hvac + loc.hvac,
      plumbing: acc.plumbing + loc.plumbing,
    }),
    { total: 0, charged: 0, booked: 0, hvac: 0, plumbing: 0 }
  );

  return { locations, totals };
}

/**
 * GET /api/lsa/leads/compare
 * Compare LSA leads across periods: current, YoY (same period last year), MoM (same-length prev period)
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
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end params required' }, { status: 400 });
  }

  try {
    // Calculate comparison date ranges
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    const periodMs = endDate.getTime() - startDate.getTime();
    const periodDays = Math.ceil(periodMs / (1000 * 60 * 60 * 24));

    // YoY: same dates last year
    const yoyStart = new Date(startDate);
    yoyStart.setFullYear(yoyStart.getFullYear() - 1);
    const yoyEnd = new Date(endDate);
    yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);

    // MoM: previous period of same length
    const momEnd = new Date(startDate);
    momEnd.setDate(momEnd.getDate() - 1);
    const momStart = new Date(momEnd);
    momStart.setDate(momStart.getDate() - periodDays + 1);

    const formatLocalDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const yoyStartStr = formatLocalDate(yoyStart);
    const yoyEndStr = formatLocalDate(yoyEnd);
    const momStartStr = formatLocalDate(momStart);
    const momEndStr = formatLocalDate(momEnd);

    // Fetch all three periods in parallel from lsa_leads cache
    const [currentRes, yoyRes, momRes, accountsRes] = await Promise.all([
      supabase
        .from('lsa_leads')
        .select('customer_id, trade, lead_charged, lead_status')
        .gte('lead_created_at', `${start}T00:00:00`)
        .lte('lead_created_at', `${end}T23:59:59`),
      supabase
        .from('lsa_leads')
        .select('customer_id, trade, lead_charged, lead_status')
        .gte('lead_created_at', `${yoyStartStr}T00:00:00`)
        .lte('lead_created_at', `${yoyEndStr}T23:59:59`),
      supabase
        .from('lsa_leads')
        .select('customer_id, trade, lead_charged, lead_status')
        .gte('lead_created_at', `${momStartStr}T00:00:00`)
        .lte('lead_created_at', `${momEndStr}T23:59:59`),
      supabase
        .from('lsa_accounts')
        .select('customer_id, customer_name'),
    ]);

    if (currentRes.error) throw currentRes.error;
    if (yoyRes.error) throw yoyRes.error;
    if (momRes.error) throw momRes.error;

    // Build account name map
    const accountNameMap = new Map(
      accountsRes.data?.map(a => [a.customer_id, a.customer_name]) || []
    );

    const current = aggregateLeads(currentRes.data || []);
    const yoy = aggregateLeads(yoyRes.data || []);
    const mom = aggregateLeads(momRes.data || []);

    // Enrich with account names
    for (const loc of current.locations) {
      loc.customerName = getLSAAccountName(loc.customerId);
    }

    // Also fetch performance cache for spend data
    const [currentPerfRes, yoyPerfRes, momPerfRes] = await Promise.all([
      supabase
        .from('lsa_daily_performance')
        .select('customer_id, cost_micros, impressions, search_top_impression_share, search_abs_top_impression_share')
        .gte('date', start)
        .lte('date', end),
      supabase
        .from('lsa_daily_performance')
        .select('customer_id, cost_micros, impressions, search_top_impression_share, search_abs_top_impression_share')
        .gte('date', yoyStartStr)
        .lte('date', yoyEndStr),
      supabase
        .from('lsa_daily_performance')
        .select('customer_id, cost_micros, impressions, search_top_impression_share, search_abs_top_impression_share')
        .gte('date', momStartStr)
        .lte('date', momEndStr),
    ]);

    // Aggregate spend per account
    const aggregateSpend = (rows: any[] | null) => {
      const map = new Map<string, number>();
      for (const row of rows || []) {
        map.set(row.customer_id, (map.get(row.customer_id) || 0) + (row.cost_micros || 0) / 1000000);
      }
      return map;
    };

    // Aggregate impressions per account
    const aggregateImpressions = (rows: any[] | null) => {
      const map = new Map<string, number>();
      for (const row of rows || []) {
        map.set(row.customer_id, (map.get(row.customer_id) || 0) + (row.impressions || 0));
      }
      return map;
    };

    const currentSpend = aggregateSpend(currentPerfRes.data);
    const yoySpend = aggregateSpend(yoyPerfRes.data);
    const momSpend = aggregateSpend(momPerfRes.data);

    const currentImpressions = aggregateImpressions(currentPerfRes.data);
    const yoyImpressions = aggregateImpressions(yoyPerfRes.data);
    const momImpressions = aggregateImpressions(momPerfRes.data);

    // Aggregate impression share per account (weighted average by impressions)
    const aggregateImpressionShare = (rows: any[] | null) => {
      const map = new Map<string, { topShareSum: number; absTopShareSum: number; imprSum: number }>();
      for (const row of rows || []) {
        const cid = row.customer_id;
        const existing = map.get(cid) || { topShareSum: 0, absTopShareSum: 0, imprSum: 0 };
        const impr = row.impressions || 0;
        existing.topShareSum += (row.search_top_impression_share || 0) * impr;
        existing.absTopShareSum += (row.search_abs_top_impression_share || 0) * impr;
        existing.imprSum += impr;
        map.set(cid, existing);
      }
      const result: Record<string, { topShare: number; absTopShare: number }> = {};
      for (const [cid, data] of map) {
        result[cid] = {
          topShare: data.imprSum > 0 ? data.topShareSum / data.imprSum : 0,
          absTopShare: data.imprSum > 0 ? data.absTopShareSum / data.imprSum : 0,
        };
      }
      return result;
    };

    const currentImprShare = aggregateImpressionShare(currentPerfRes.data);
    const yoyImprShare = aggregateImpressionShare(yoyPerfRes.data);
    const momImprShare = aggregateImpressionShare(momPerfRes.data);

    // Fetch ServiceTitan completed jobs attributed to the LSA campaign
    // Campaign ID 23483018 = "06 - Google LSA"
    // ST attributes revenue to the campaign based on the customer's first touchpoint,
    // so we query completed jobs directly (not just booked calls)
    const LSA_CAMPAIGN_ID = 23483018;
    let stMetrics: Record<string, { booked: number; revenue: number; avgTicket: number; jobCount: number }> = {};
    try {
      if (stClient.isConfigured()) {
        const completedJobs = await (stClient as any).getCompletedJobsByCampaign(
          LSA_CAMPAIGN_ID,
          start,
          end
        );

        // Get unique customer IDs from completed jobs to trace back to LSA locations
        const customerIds = [...new Set(completedJobs.map((j: any) => j.customerId).filter(Boolean))];

        // Load attribution overrides (customers we know should be LSA but ST has wrong)
        const { data: overrides } = await supabase
          .from('lsa_attribution_overrides')
          .select('customer_id, lsa_location');

        const overrideMap = new Map<number, string>();
        const overrideLSAMap: Record<string, string> = {
          'Argyle': '5362286439',
          'Argyle (HVAC)': '5362286439',
          'Argyle (PLMBG)': '3320714390',
          'Justin': '3704224172',
          'Flower Mound': '6799775782',
          'Lewisville (Barts)': '8265257082',
          'Lewisville (Xmas)': '5778669762',
          'Prosper': '6930068549',
          'Denton': '1807327952',
        };
        if (overrides) {
          for (const o of overrides) {
            const lsaId = overrideLSAMap[o.lsa_location] || o.lsa_location;
            overrideMap.set(o.customer_id, lsaId);
          }
        }

        // Look up which tracking number each customer ever called from
        // Match by tracking number (LSA phone numbers), not by campaign name
        const customerToLSA = new Map<number, string>();

        // Apply overrides first (these take priority)
        for (const [custId, lsaId] of overrideMap) {
          customerToLSA.set(custId, lsaId);
        }

        if (customerIds.length > 0) {
          const allTrackingNumbers = [...TRACKING_TO_LSA.keys()];

          // Query in batches of 100 customer IDs to avoid URL length limits
          const BATCH_SIZE = 100;
          for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
            const batch = customerIds.slice(i, i + BATCH_SIZE);
            const { data: historicalCalls } = await supabase
              .from('st_calls')
              .select('customer_id, tracking_number')
              .in('tracking_number', allTrackingNumbers)
              .in('customer_id', batch)
              .order('received_at', { ascending: true });

            if (historicalCalls) {
              for (const call of historicalCalls) {
                // Don't override if we already have a mapping (overrides take priority)
                if (!customerToLSA.has(call.customer_id)) {
                  const lsaId = TRACKING_TO_LSA.get(call.tracking_number);
                  if (lsaId) customerToLSA.set(call.customer_id, lsaId);
                }
              }
            }
          }
          console.log(`[LSA Compare] Mapped ${customerToLSA.size}/${customerIds.length} customers (${overrideMap.size} from overrides)`);
        }

        // Aggregate per-location revenue from completed jobs
        let grandRevenue = 0;
        const locationRevenue = new Map<string, { revenue: number; jobCount: number }>();

        for (const job of completedJobs) {
          grandRevenue += job.total;
          const lsaId = customerToLSA.get(job.customerId) || '_unattributed';
          const existing = locationRevenue.get(lsaId) || { revenue: 0, jobCount: 0 };
          existing.revenue += job.total;
          existing.jobCount++;
          locationRevenue.set(lsaId, existing);
        }

        // Build per-location stMetrics
        for (const [lsaId, data] of locationRevenue) {
          stMetrics[lsaId] = {
            booked: 0, // will be filled from calls below
            revenue: data.revenue,
            avgTicket: data.jobCount > 0 ? data.revenue / data.jobCount : 0,
            jobCount: data.jobCount,
          };
        }

        // Also get per-location booked calls from st_calls for the current period
        const allTrackingNumbers = [...TRACKING_TO_LSA.keys()];
        const { data: stCalls } = await supabase
          .from('st_calls')
          .select('call_type, tracking_number')
          .eq('direction', 'Inbound')
          .eq('campaign_name', '06 - Google LSA')
          .in('tracking_number', allTrackingNumbers)
          .gte('received_at', `${start}T00:00:00`)
          .lte('received_at', `${end}T23:59:59`);

        if (stCalls) {
          for (const call of stCalls) {
            if (call.call_type !== 'Booked') continue;
            const lsaCustomerId = TRACKING_TO_LSA.get(call.tracking_number) || '_unknown';
            if (!stMetrics[lsaCustomerId]) {
              stMetrics[lsaCustomerId] = { booked: 0, revenue: 0, avgTicket: 0, jobCount: 0 };
            }
            stMetrics[lsaCustomerId].booked++;
          }
        }

        // Set totals from per-location attributed data (not raw campaign total)
        // This ensures the total row matches the sum of per-location rows
        const attributedJobs = Array.from(locationRevenue.values())
          .filter((_, i) => [...locationRevenue.keys()][i] !== '_unattributed')
          .reduce((sum, d) => sum + d.jobCount, 0);
        const attributedRevenue = Array.from(locationRevenue.entries())
          .filter(([key]) => key !== '_unattributed')
          .reduce((sum, [, d]) => sum + d.revenue, 0);
        const unattributed = locationRevenue.get('_unattributed');

        stMetrics._total = {
          booked: attributedJobs,
          revenue: attributedRevenue,
          avgTicket: attributedJobs > 0 ? attributedRevenue / attributedJobs : 0,
          jobCount: attributedJobs,
        };

        if (unattributed && unattributed.jobCount > 0) {
          stMetrics._unattributed = {
            booked: unattributed.jobCount,
            revenue: unattributed.revenue,
            avgTicket: unattributed.jobCount > 0 ? unattributed.revenue / unattributed.jobCount : 0,
            jobCount: unattributed.jobCount,
          };
        }

        console.log(`[LSA Compare] ST campaign: ${completedJobs.length} completed jobs, ${attributedJobs} attributed, $${attributedRevenue.toFixed(0)} revenue, ${unattributed?.jobCount || 0} unattributed`);
      }
    } catch (err) {
      console.error('[LSA Compare] Failed to fetch ST metrics:', err);
    }

    return NextResponse.json({
      current: {
        ...current,
        dateRange: { start, end },
        spend: currentSpend,
      },
      yoy: {
        ...yoy,
        dateRange: { start: yoyStartStr, end: yoyEndStr },
        spend: yoySpend,
      },
      mom: {
        ...mom,
        dateRange: { start: momStartStr, end: momEndStr },
        spend: momSpend,
      },
      // Serializable spend maps
      spendByPeriod: {
        current: Object.fromEntries(currentSpend),
        yoy: Object.fromEntries(yoySpend),
        mom: Object.fromEntries(momSpend),
      },
      impressionsByPeriod: {
        current: Object.fromEntries(currentImpressions),
        yoy: Object.fromEntries(yoyImpressions),
        mom: Object.fromEntries(momImpressions),
      },
      impressionShareByPeriod: {
        current: currentImprShare,
        yoy: yoyImprShare,
        mom: momImprShare,
      },
      stMetrics,
    });
  } catch (error: any) {
    console.error('Failed to fetch LSA comparison data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch comparison data' },
      { status: 500 }
    );
  }
}
