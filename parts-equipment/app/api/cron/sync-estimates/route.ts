import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceTitanClient } from '@/lib/servicetitan';

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

  // Look back 2 hours — cron runs every 30 min, 2h window gives safe overlap
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const sinceStr = formatLocalDateTime(since);

  try {
    const estimates = await st.getSoldEstimates(sinceStr);

    if (estimates.length === 0) {
      return NextResponse.json({ ok: true, scanned: 0, created: 0 });
    }

    // Fetch existing estimate IDs to dedup
    const { data: existing } = await supabase
      .from('pe_orders')
      .select('st_estimate_id')
      .not('st_estimate_id', 'is', null);

    const existingIds = new Set((existing || []).map((r: { st_estimate_id: number }) => r.st_estimate_id));
    const newEstimates = estimates.filter(e => !existingIds.has(e.id));

    let created = 0;
    for (const estimate of newEstimates) {
      try {
        const job = estimate.jobId ? await st.getJob(estimate.jobId) : null;
        const customer = job?.customerId ? await st.getCustomer(job.customerId) : null;

        const buName = (job?.businessUnitName || '').toLowerCase();
        const orderType = buName.includes('install') ? 'install' : 'service';

        const materials = (estimate.items || [])
          .filter(i => i.type === 'Material' || i.type === 'Equipment')
          .map(i => i.skuName || i.displayName || i.description || '')
          .filter(Boolean);

        // soldOn comes from ST as UTC; split on T to get the date portion
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

    console.log(`Estimate sync: scanned=${estimates.length} new=${newEstimates.length} created=${created}`);
    return NextResponse.json({ ok: true, scanned: estimates.length, newFound: newEstimates.length, created });
  } catch (err) {
    console.error('Estimate sync failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
