import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { fmtMoney } from '@/lib/pe-utils';
import { broadcastChange } from '@/lib/realtime';
import { DB_SCHEMA } from '@/lib/supabase';
import {
  toQueueEstimate, buildQueuePlan,
  isInstallBU, hasInstallKeyword, classifyType, ownerForSubtype,
  type QueueEstimate, type ExistingOrder,
} from '@/lib/queue-sync';

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function soldDateOf(iso: string, fallback: string): string {
  return iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : fallback;
}

async function handle(request: Request) {
  const auth = request.headers.get('Authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryrun') === '1';
  const since = url.searchParams.get('since');

  const st = getServiceTitanClient();
  if (!st.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: DB_SCHEMA } }
  );

  const now = new Date();
  const today = formatLocalDate(now);
  // Year-to-date by default: a sold-but-unbooked estimate still needs ordering no
  // matter how long ago this year it sold.
  const fromDate = since && /^\d{4}-\d{2}-\d{2}/.test(since)
    ? since.slice(0, 10)
    : formatLocalDate(new Date(now.getFullYear(), 0, 1));

  try {
    // ── Source of truth: SOLD estimates whose items aren't invoiced onto a job yet.
    // "Install Job(s) empty" == every line item's invoiceItemId is null. This replaces
    // the hidden-filter report (which silently dropped Opportunity=Dismissed rows).
    const raw = await st.getSoldEstimatesRaw(fromDate);
    const sold: QueueEstimate[] = raw
      .map(toQueueEstimate)
      .filter((x): x is QueueEstimate => x !== null);

    // GUARDRAIL: an empty pull almost always means the ST fetch failed (rate limit /
    // transient error), not "nothing sold." Never reconcile on empty.
    if (sold.length === 0) {
      console.warn('Sold-estimates pull returned 0 — skipping (guardrail).');
      return NextResponse.json({ ok: true, note: 'no sold estimates returned — skipped (guardrail)', from: fromDate, to: today });
    }

    const { data: existingRows } = await supabase
      .from('pe_orders')
      .select('id, st_estimate_id, status, location, warranty, completed_by');
    const existing = (existingRows || []) as ExistingOrder[];

    const plan = buildQueuePlan(sold, existing);

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        from: fromDate,
        to: today,
        soldTotal: sold.length,
        soldUnbooked: sold.filter(e => !e.booked).length,
        toInsert: plan.toInsert.length,
        toSchedule: plan.toSchedule.length,
        toReopen: plan.toReopen.length,
        insertSample: plan.toInsert.slice(0, 15).map(e => ({
          estimateId: e.estimateId, job: e.jobNumber, bu: e.businessUnit,
          subtotal: e.subtotal, warranty: e.warrantyType, name: e.name,
        })),
        reopenOrderIds: plan.toReopen.map(o => o.id),
      });
    }

    // ── Apply ────────────────────────────────────────────────────────
    let scheduled = 0, reopened = 0, created = 0, warrantyClaims = 0;

    // Booked now -> Scheduled (stored as 'completed', shown as "Scheduled").
    for (const o of plan.toSchedule) {
      await supabase.from('pe_orders')
        .update({ status: 'completed', completed_at: today })
        .eq('id', o.id);
      scheduled++;
    }

    // Wrongly auto-completed but still unbooked -> back to the queue.
    for (const o of plan.toReopen) {
      await supabase.from('pe_orders')
        .update({ status: 'open', completed_at: null })
        .eq('id', o.id);
      reopened++;
    }

    // New sold + unbooked estimates -> insert.
    const custCache = new Map<number, string>();
    const techCache = new Map<number, string>();
    const { data: claimRows } = await supabase.from('pe_warranty_claims').select('job');
    const claimJobs = new Set((claimRows || []).map((c: { job: string }) => String(c.job || '').trim()).filter(Boolean));

    for (const e of plan.toInsert) {
      try {
        let customer = '';
        if (e.customerId != null) {
          customer = custCache.get(e.customerId) ?? '';
          if (!customer) {
            try { customer = (await st.getCustomer(e.customerId))?.name || ''; } catch { /* ignore */ }
            if (customer) custCache.set(e.customerId, customer);
          }
        }
        // Sold By: the estimate's soldBy is a technician id — resolve to a name (cached).
        let tech = e.tech || '';
        if (!tech && e.soldById != null) {
          tech = techCache.get(e.soldById) ?? '';
          if (!tech) {
            tech = await st.getTechnicianName(e.soldById);
            if (tech) techCache.set(e.soldById, tech);
          }
        }
        const orderType = (isInstallBU(e.businessUnit) || hasInstallKeyword(e.name)) ? 'install' : 'service';
        const subtype = classifyType(e.businessUnit, e.name);
        const owner = ownerForSubtype(subtype);
        const money = fmtMoney(String(e.subtotal));
        const jobIdNum = e.jobNumber ? parseInt(e.jobNumber, 10) : NaN;
        const stUrl = !isNaN(jobIdNum) ? `https://go.servicetitan.com/#/Job/Index/${jobIdNum}` : '';

        const { error } = await supabase.from('pe_orders').insert({
          st_estimate_id: e.estimateId,
          date: soldDateOf(e.soldOn, today),
          job: e.jobNumber,
          customer,
          tech,
          order_type: orderType,
          subtype,
          part: e.name,
          estimate_cost: money,
          job_cost: orderType === 'install' ? money : '',
          warranty: e.warrantyType ? 'Yes' : 'No',
          warranty_type: e.warrantyType || '',
          tech_type: e.warrantyType ? 'Parts' : '',
          note_wh: '',
          st_url: stUrl,
          status: 'open',
          needs_order: true,
          stage: 'needs_order',
          owner,
        });
        if (error) { console.error(`Insert failed (job ${e.jobNumber}):`, error.message); continue; }
        created++;

        // Warranty estimate -> start a Warranty-tab claim if none exists for the job.
        if (e.warrantyType && e.jobNumber && !claimJobs.has(e.jobNumber.trim())) {
          const { error: cErr } = await supabase.from('pe_warranty_claims').insert({
            last_name: '', mfgr: '', fail_date: null, repair_date: null,
            main_model_num: '', main_unit_sn: '', failed_part_num: '', failed_part_serial: '',
            mfg_invoice_num: '', repl_part_num: '', repl_part_serial: '',
            date_of_claim: today, claim_num: '', credit_approved: '', return_required: '',
            amt_charged: '', amt_refunded: '', paid: '',
            job: e.jobNumber, tech, customer, status: 'active',
          });
          if (!cErr) { warrantyClaims++; claimJobs.add(e.jobNumber.trim()); }
        }
      } catch (err) {
        console.error(`Error inserting estimate ${e.estimateId}:`, err);
      }
    }

    console.log(`Estimates sync: sold=${sold.length} created=${created} scheduled=${scheduled} reopened=${reopened} warrantyClaims=${warrantyClaims}`);
    if (created || scheduled || reopened || warrantyClaims) {
      await broadcastChange({ source: 'sync' });
    }
    return NextResponse.json({
      ok: true, source: 'estimates-api', from: fromDate, to: today,
      soldTotal: sold.length, created, scheduled, reopened, warrantyClaims,
    });
  } catch (err) {
    console.error('Estimates sync failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
