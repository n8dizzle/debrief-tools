import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { authenticateServiceTitan, getServiceTitanConfigFromEnv, isServiceTitanConfigured } from '@/lib/serviceTitan';

// HVAC Sales Business Unit ID — the CA's sales follow-up jobs live here
const HVAC_SALES_BU_ID = '33643795';

export interface STEstimate {
  id: string;
  name: string;
  status: string;
  subtotal: number;
  total: number;
  createdOn: string;
  soldOn: string | null;
}

function mapEstimate(e: any): STEstimate {
  return {
    id: e.id?.toString(),
    name: e.name || 'Estimate',
    status: e.status?.name || e.status || 'Unknown',
    subtotal: e.subtotal || 0,
    total: e.total || e.subtotal || 0,
    createdOn: e.createdOn,
    soldOn: e.soldOn || null,
  };
}

async function fetchEstimatesForJob(
  jobId: string,
  config: { tenantId: string; appKey: string },
  token: string
): Promise<STEstimate[]> {
  const response = await fetch(
    `https://api.servicetitan.io/sales/v2/tenant/${config.tenantId}/estimates?` +
      new URLSearchParams({ jobId, pageSize: '50' }),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'ST-App-Key': config.appKey,
      },
    }
  );
  if (!response.ok) return [];
  const data = await response.json();
  return (data.data || []).map(mapEstimate);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();

    // Include lead_type so we know whether to search for a CA sales job (TGL)
    const { data: lead, error } = await supabase
      .from('leads')
      .select('id, service_titan_id, client_name, lead_type')
      .eq('id', params.id)
      .single();

    if (error || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (!lead.service_titan_id) {
      return NextResponse.json({ estimates: [], message: 'No Service Titan job linked' });
    }

    if (!isServiceTitanConfigured()) {
      return NextResponse.json({ estimates: [], message: 'Service Titan not configured' });
    }

    const config = getServiceTitanConfigFromEnv()!;
    const token = await authenticateServiceTitan(config);

    // ── Marketed leads ────────────────────────────────────────────────────────
    // service_titan_id IS the sales job → fetch estimates directly from it.
    if (lead.lead_type !== 'TGL') {
      const estimates = await fetchEstimatesForJob(lead.service_titan_id, config, token);
      return NextResponse.json({ estimates });
    }

    // ── TGL leads ─────────────────────────────────────────────────────────────
    // service_titan_id is the tech's SERVICE job (where the TGL tag was placed).
    // The CA creates estimates on a SEPARATE sales job for the same customer.
    // Strategy:
    //   1. Fetch the original tech job → get customerId
    //   2. Find jobs at that customer in the HVAC Sales BU (the CA's job)
    //   3. Fetch estimates from those sales jobs

    let salesJobIds: string[] = [];

    try {
      // Step 1: Get original tech job to find the customer
      const jobRes = await fetch(
        `https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/jobs/${lead.service_titan_id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'ST-App-Key': config.appKey,
          },
        }
      );

      if (jobRes.ok) {
        const job = await jobRes.json();
        const customerId: number | undefined = job.customerId;

        if (customerId) {
          // Step 2: Find sales-BU jobs for that customer (excluding the original tech job)
          const salesJobsRes = await fetch(
            `https://api.servicetitan.io/jpm/v2/tenant/${config.tenantId}/jobs?` +
              new URLSearchParams({
                customerId: customerId.toString(),
                businessUnitId: HVAC_SALES_BU_ID,
                pageSize: '10',
              }),
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'ST-App-Key': config.appKey,
              },
            }
          );

          if (salesJobsRes.ok) {
            const salesJobsData = await salesJobsRes.json();
            salesJobIds = (salesJobsData.data || [])
              .filter((j: any) => j.id.toString() !== lead.service_titan_id)
              .map((j: any) => j.id.toString());
          }
        }
      }
    } catch (err) {
      console.error('Error finding CA sales job for TGL lead:', err);
    }

    // Step 3: Fetch estimates from all found sales jobs
    if (salesJobIds.length === 0) {
      // No separate CA job found yet — return empty (CA hasn't created a sales job)
      return NextResponse.json({
        estimates: [],
        message: 'No CA sales job found yet for this TGL lead',
      });
    }

    const allEstimates: STEstimate[] = [];
    for (const jobId of salesJobIds) {
      const ests = await fetchEstimatesForJob(jobId, config, token);
      allEstimates.push(...ests);
    }

    return NextResponse.json({ estimates: allEstimates });
  } catch (error: any) {
    console.error('Error fetching estimates:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
