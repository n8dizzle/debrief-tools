import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { PARTS } from '@/lib/processes';

// Pull sold ServiceTitan estimates and create ONE WORK ITEM PER PART.
//
// The difference from parts-equipment: that app creates one row per estimate, so an
// estimate holding twelve parts gets one status. Measured 2026-08-05: 44 of 114
// queue-worthy estimates hold more than one unbilled part, so 39% of the queue
// cannot be described correctly there.
//
// Rules, deliberately few:
//   - estimate must be Sold
//   - a line item becomes an item when its invoiceItemId is null (not yet billed
//     onto a job = still needs ordering)
//   - keyed on the ServiceTitan line-item id, so re-syncs update instead of duplicate
//   - nothing is guessed. No install-vs-service, no subtype, no owner. Items arrive
//     at step `needs_order`, held by the Parts Coordinator because the process
//     definition says that step is theirs — not because a keyword matched.

const QUEUE_START = '2026-01-01';

function nameOf(s: unknown): string {
  if (typeof s === 'string') return s;
  if (s && typeof s === 'object' && 'name' in s) return String((s as { name: unknown }).name);
  return '';
}

async function handle(request: Request) {
  const auth = request.headers.get('Authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryrun') === '1';
  const since = url.searchParams.get('since');
  const from = since && /^\d{4}-\d{2}-\d{2}/.test(since) ? since.slice(0, 10) : QUEUE_START;

  const st = getServiceTitanClient();
  if (!st.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }
  const supabase = getServerSupabase();

  try {
    const raw = await st.getSoldEstimatesRaw(from);

    // GUARDRAIL: an empty pull is almost always a failed fetch, not "nothing sold".
    // Never reconcile against nothing.
    if (raw.length === 0) {
      return NextResponse.json({ ok: true, note: 'ST returned 0 estimates — skipped (guardrail)', from });
    }

    type Incoming = {
      source_id: string;
      data: Record<string, unknown>;
    };
    const incoming: Incoming[] = [];
    const custCache = new Map<number, string>();

    for (const e of raw as Array<Record<string, any>>) {
      if (nameOf(e.status) !== 'Sold') continue;
      const items = (e.items || []) as Array<Record<string, any>>;
      const unbilled = items.filter(i => i.invoiceItemId == null);
      if (unbilled.length === 0) continue;

      let customer = '';
      if (e.customerId != null) {
        customer = custCache.get(Number(e.customerId)) ?? '';
        if (!customer) {
          try { customer = (await st.getCustomer(Number(e.customerId)))?.name || ''; } catch { /* non-fatal */ }
          if (customer) custCache.set(Number(e.customerId), customer);
        }
      }

      const job = String(e.jobNumber ?? e.jobId ?? '').trim();
      const jobNum = job ? parseInt(job, 10) : NaN;

      for (const i of unbilled) {
        if (i.id == null) continue; // no stable key, can't dedupe — skip rather than duplicate
        incoming.push({
          source_id: String(i.id),
          data: {
            job,
            customer,
            sku: i.sku?.name || '',
            description: i.description || i.sku?.displayName || i.sku?.name || '',
            qty: Number(i.qty ?? i.quantity ?? 1),
            unit_cost: Number(i.unitCost ?? 0),
            estimate_id: Number(e.id),
            estimate_name: e.name || '',
            sold_on: String(e.soldOn || '').slice(0, 10),
            st_url: !isNaN(jobNum) ? `https://go.servicetitan.com/#/Job/Index/${jobNum}` : '',
          },
        });
      }
    }

    const { data: existingRows, error: exErr } = await supabase
      .from('rg_work_items')
      .select('id, source_id')
      .eq('process', 'parts')
      .eq('source', 'st_estimate_item');
    if (exErr) throw new Error(`read failed: ${exErr.message}`);

    const known = new Set((existingRows || []).map(r => String(r.source_id)));
    const toCreate = incoming.filter(i => !known.has(i.source_id));

    if (dryRun) {
      return NextResponse.json({
        ok: true, dryRun: true, from,
        estimatesScanned: raw.length,
        partsFound: incoming.length,
        alreadyTracked: incoming.length - toCreate.length,
        toCreate: toCreate.length,
        sample: toCreate.slice(0, 12).map(i => i.data),
      });
    }

    let created = 0;
    for (const item of toCreate) {
      const { data: row, error } = await supabase
        .from('rg_work_items')
        .insert({
          process: 'parts',
          source: 'st_estimate_item',
          source_id: item.source_id,
          step: PARTS.entry,
          owner_role: 'Parts Coordinator',
          data: item.data,
        })
        .select('id')
        .single();
      if (error) { console.error('insert failed', item.source_id, error.message); continue; }
      created++;
      await supabase.from('rg_events').insert({
        work_item_id: row.id,
        actor: 'sync',
        kind: 'created',
        to_value: PARTS.entry,
        note: `from ServiceTitan estimate ${item.data.estimate_id}`,
      });
    }

    return NextResponse.json({
      ok: true, from,
      estimatesScanned: raw.length,
      partsFound: incoming.length,
      created,
      alreadyTracked: incoming.length - toCreate.length,
    });
  } catch (err) {
    console.error('rigor sync failed', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
