import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { fmtMoney } from '@/lib/pe-utils';

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseSinceParam(sinceParam: string): string {
  // Accept YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS — reports use date-only params.
  if (/^\d{4}-\d{2}-\d{2}/.test(sinceParam)) return sinceParam.slice(0, 10);
  const d = new Date(sinceParam);
  if (isNaN(d.getTime())) return formatLocalDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  return formatLocalDate(d);
}

function isInstallBU(bu: string): boolean {
  const lower = bu.toLowerCase();
  return lower.includes('install') || lower.includes('sales');
}

// Some HVAC *service* estimates are really install-team work and belong on the
// Install tab. Route by keyword in the estimate title.
const INSTALL_KEYWORDS = ['txv', 'evaporator coil', 'evap coil'];
function hasInstallKeyword(title: string): boolean {
  const t = (title || '').toLowerCase();
  return INSTALL_KEYWORDS.some(k => t.includes(k));
}

// Type column value (subtype) from the business unit + estimate title:
//   - title contains "Christmas List" -> Membership (memberships are ~99% a
//     standalone estimate; if other work is bundled in, staff reclassify to Service)
//   - title contains "Duct Cleaning" -> Duct Cleaning
//   - BU starts with "HVAC" -> Service (Parts vs Repair is set manually in the
//     adjacent column). HVAC-Sales still routes to the Install tab via isInstallBU.
//   - BU starts with "Plumbing" -> Plumbing
function classifyType(businessUnit: string, estimateTitle: string): string {
  const bu = (businessUnit || '').trim().toLowerCase();
  const title = (estimateTitle || '').toLowerCase();
  if (title.includes('christmas list')) return 'Membership';
  if (title.includes('duct cleaning')) return 'Duct Cleaning';
  if (bu.startsWith('hvac')) return 'Service';
  if (bu.startsWith('plumbing')) return 'Plumbing';
  return '';
}

export async function GET(request: Request) {
  const auth = request.headers.get('Authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const sinceParam = url.searchParams.get('since');
  const probe = url.searchParams.get('probe') === '1';

  const st = getServiceTitanClient();
  if (!st.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const today = formatLocalDate(now);
  // Default to year-to-date: a sold-but-unbooked estimate still needs ordering
  // no matter how long ago it was sold this year, so we scan from Jan 1.
  const fromDate = sinceParam
    ? parseSinceParam(sinceParam)
    : formatLocalDate(new Date(now.getFullYear(), 0, 1));

  try {
    if (probe) {
      const probeResult = await st.probePartsReport(fromDate, today);
      return NextResponse.json({ ok: true, from: fromDate, to: today, ...probeResult });
    }

    // The report is the source of truth for sold, unbooked estimates.
    // Its saved filters guarantee: Opportunity=won, Estimate=sold, Install Job(s) empty.
    // An order is OPEN while it appears in the report; it is CLOSED once it drops out
    // (i.e., it got booked / an install job was created). We do NOT look at the parent
    // job's status — for sold-but-unbooked estimates the parent job is usually complete.
    const { rows: reportRows } = await st.getPartsOrdersReport(fromDate, today);
    const currentEstimateIds = new Set(
      reportRows.map(r => r.estimateId).filter((id): id is number => id != null)
    );

    // --- Part A: close in-window open orders that dropped out of the report ---
    // Only touch orders inside the report window; the windowed report cannot speak to
    // older orders, so those are left alone.
    let closed = 0;
    const { data: openOrders } = await supabase
      .from('pe_orders')
      .select('id, st_estimate_id, date')
      .eq('status', 'open')
      .not('st_estimate_id', 'is', null)
      .gte('date', fromDate)
      .lte('date', today);

    if (openOrders && openOrders.length > 0) {
      for (const order of openOrders) {
        if (order.st_estimate_id != null && !currentEstimateIds.has(order.st_estimate_id)) {
          await supabase
            .from('pe_orders')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', order.id);
          closed++;
        }
      }
    }

    // --- Part B: insert report rows not already tracked ---
    let created = 0;
    let skipped = 0;

    if (reportRows.length > 0) {
      const { data: existing } = await supabase
        .from('pe_orders')
        .select('st_estimate_id, job');

      const existingEstimateIds = new Set(
        (existing || [])
          .map((r: { st_estimate_id: number | null }) => r.st_estimate_id)
          .filter((id): id is number => id != null)
      );
      const existingJobs = new Set(
        (existing || [])
          .map((r: { job: string }) => String(r.job || '').trim())
          .filter(Boolean)
      );

      for (const row of reportRows) {
        try {
          // Dedup by estimate id (one row per estimate). A parent job can carry many
          // estimates, so only fall back to job-number dedup when there is no estimate id.
          if (row.estimateId != null) {
            if (existingEstimateIds.has(row.estimateId)) {
              skipped++;
              continue;
            }
          } else if (row.jobNumber && existingJobs.has(row.jobNumber)) {
            skipped++;
            continue;
          }

          // Everything needed comes straight from the report row — no per-row job
          // lookup (that made 60+ ST calls per sync and tripped rate limits). In this
          // tenant a job's number equals its id, so the deep link is built directly.
          const customer = row.customer || '';
          // Estimate title (e.g. "Blower wheel clean") is what we'll be doing —
          // it belongs in Part/Description, not WH Notes.
          const estimateTitle = row.note || row.part || '';
          const orderType =
            (isInstallBU(row.businessUnit) || hasInstallKeyword(estimateTitle)) ? 'install' : 'service';
          const subtype = classifyType(row.businessUnit, estimateTitle);
          // Auto-assign the ticket owner based on type. Regular (non-duct,
          // non-membership) service/install parts tickets start with the Parts
          // Coordinator at "Place Order".
          const owner =
            subtype === 'Membership' ? 'CXR Team'
            : subtype === 'Duct Cleaning' ? 'Install Dispatcher'
            : subtype === 'Plumbing' ? 'Plumbing Dispatcher'
            : 'Parts Coordinator';
          const soldDate = row.soldDate || today;
          const jobNumber = row.jobNumber || '';
          const jobIdNum = jobNumber ? parseInt(jobNumber, 10) : NaN;
          const stUrl = !isNaN(jobIdNum)
            ? `https://go.servicetitan.com/#/Job/Index/${jobIdNum}`
            : '';

          const { error } = await supabase.from('pe_orders').insert({
            st_estimate_id: row.estimateId,
            date: soldDate,
            job: jobNumber,
            customer,
            tech: row.tech,
            order_type: orderType,
            subtype,
            part: estimateTitle,
            estimate_cost: fmtMoney(row.estimateCost),
            // Install tab shows Job Cost; populate it with the sold estimate subtotal too.
            job_cost: orderType === 'install' ? fmtMoney(row.estimateCost) : '',
            note_wh: '',
            st_url: stUrl,
            status: 'open',
            needs_order: true,
            location: 'Place Order',
            owner,
          });

          if (error) {
            console.error(`Failed to insert report row (job ${jobNumber}):`, error.message);
          } else {
            created++;
            if (row.estimateId != null) existingEstimateIds.add(row.estimateId);
            if (jobNumber) existingJobs.add(jobNumber);
          }
        } catch (err) {
          console.error(`Error processing report row (job ${row.jobNumber}):`, err);
        }
      }
    }

    console.log(`Parts report sync: scanned=${reportRows.length} created=${created} skipped=${skipped} closed=${closed}`);
    return NextResponse.json({
      ok: true,
      source: 'report-54646792',
      from: fromDate,
      to: today,
      scanned: reportRows.length,
      created,
      skipped,
      closed,
    });
  } catch (err) {
    console.error('Parts report sync failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
