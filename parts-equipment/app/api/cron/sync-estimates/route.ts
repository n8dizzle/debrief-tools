import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceTitanClient, isJobTerminal } from '@/lib/servicetitan';

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatLocalDateTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${formatLocalDate(date)}T${h}:${min}:00`;
}

export async function GET(request: Request) {
  const auth = request.headers.get('Authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const st = getServiceTitanClient();
  if (!st.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Optional ?since=YYYY-MM-DDTHH:MM:SS for manual backfill; defaults to 2h ago
  const url = new URL(request.url);
  const sinceParam = url.searchParams.get('since');
  const sinceStr = sinceParam || formatLocalDateTime(new Date(Date.now() - 2 * 60 * 60 * 1000));

  try {
    // --- Part A: close out open orders whose jobs are now complete ---
    let closed = 0;
    const { data: openOrders } = await supabase
      .from('pe_orders')
      .select('id, st_estimate_id, job')
      .eq('status', 'open')
      .not('st_estimate_id', 'is', null);

    if (openOrders && openOrders.length > 0) {
      for (const order of openOrders) {
        try {
          // We need the job ID — parse it from the job number or look up via estimate
          const jobIdNum = order.job ? parseInt(String(order.job), 10) : null;
          if (!jobIdNum || isNaN(jobIdNum)) continue;
          const job = await st.getJob(jobIdNum);
          if (isJobTerminal(job)) {
            await supabase
              .from('pe_orders')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('id', order.id);
            closed++;
          }
        } catch {
          // Skip if job lookup fails
        }
      }
    }

    // --- Part B: add new estimates sold since `sinceStr` ---
    const estimates = await st.getSoldEstimates(sinceStr);
    let created = 0;

    if (estimates.length > 0) {
      // Fetch existing estimate IDs to dedup
      const { data: existing } = await supabase
        .from('pe_orders')
        .select('st_estimate_id')
        .not('st_estimate_id', 'is', null);

      const existingIds = new Set((existing || []).map((r: { st_estimate_id: number }) => r.st_estimate_id));
      const newEstimates = estimates.filter(e => !existingIds.has(e.id));

      for (const estimate of newEstimates) {
        try {
          const job = estimate.jobId ? await st.getJob(estimate.jobId) : null;

          // Skip estimates whose jobs are already completed/cancelled
          if (isJobTerminal(job)) continue;

          const customer = job?.customerId ? await st.getCustomer(job.customerId) : null;

          const buName = (job?.businessUnitName || '').toLowerCase();
          const orderType = buName.includes('install') ? 'install' : 'service';

          const materials = (estimate.items || [])
            .filter(i => i.type === 'Material' || i.type === 'Equipment')
            .map(i => i.skuName || i.displayName || i.description || '')
            .filter(Boolean);

          const soldDate = estimate.soldOn
            ? estimate.soldOn.split('T')[0]
            : formatLocalDate(new Date());

          const { error } = await supabase.from('pe_orders').insert({
            st_estimate_id: estimate.id,
            date: soldDate,
            job: job?.jobNumber || '',
            customer: customer?.name || '',
            order_type: orderType,
            part: materials.join(', '),
            estimate_cost: estimate.total != null ? String(estimate.total) : '',
            note_wh: estimate.name || estimate.summary || '',
            st_url: job ? `https://go.servicetitan.com/#/Job/Index/${job.id}` : '',
            status: 'open',
            needs_order: true,
            location: 'Place Order',
            owner: 'Unassigned',
          });

          if (error) {
            console.error(`Failed to insert estimate ${estimate.id}:`, error.message);
          } else {
            created++;
          }
        } catch (err) {
          console.error(`Error processing estimate ${estimate.id}:`, err);
        }
      }
    }

    console.log(`Estimate sync: scanned=${estimates.length} created=${created} closed=${closed}`);
    return NextResponse.json({ ok: true, scanned: estimates.length, created, closed });
  } catch (err) {
    console.error('Estimate sync failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
