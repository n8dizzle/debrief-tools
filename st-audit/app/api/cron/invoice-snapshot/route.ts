import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { hoursElapsed, formatLocalDate } from '@/lib/date-utils';
import { getServerSupabase } from '@/lib/supabase';

function avgAge(invoices: { createdOn?: string }[]): number {
  const ages = invoices
    .filter(i => i.createdOn)
    .map(i => hoursElapsed(i.createdOn!));
  if (ages.length === 0) return 0;
  return Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10;
}

function estimateTotal(totalCount: number, sample: { total: number }[]): number {
  if (sample.length === 0) return 0;
  const sampleWithMoney = sample.filter(i => Math.abs(i.total) > 0);
  const sampleTotal = sampleWithMoney.reduce((s, i) => s + (Number(i.total) || 0), 0);
  if (totalCount <= sample.length) return sampleTotal;
  return Math.round(sampleTotal * (totalCount / sample.length));
}

async function runSnapshot() {
  const client = getServiceTitanClient();
  if (!client.isConfigured()) {
    throw new Error('ServiceTitan not configured');
  }

  // Fast: only fetch first page per status (2 API calls instead of 170+)
  const [pendingSummary, postedSummary] = await Promise.all([
    client.getInvoiceSummaryByStatus('Pending'),
    client.getInvoiceSummaryByStatus('Posted'),
  ]);

  const today = formatLocalDate(new Date());

  const supabase = getServerSupabase();
  const { error } = await supabase
    .from('audit_invoice_snapshots')
    .upsert({
      snapshot_date: today,
      pending_count: pendingSummary.totalCount,
      pending_total: estimateTotal(pendingSummary.totalCount, pendingSummary.firstPage),
      posted_count: postedSummary.totalCount,
      posted_total: estimateTotal(postedSummary.totalCount, postedSummary.firstPage),
      exported_count: 0,
      exported_total: 0,
      avg_pending_age_hours: avgAge(pendingSummary.firstPage),
      avg_posted_age_hours: avgAge(postedSummary.firstPage),
    }, { onConflict: 'snapshot_date' });

  if (error) {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }

  return {
    date: today,
    pending: pendingSummary.totalCount,
    posted: postedSummary.totalCount,
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (authHeader === `Bearer ${cronSecret}` && cronSecret) {
    // Cron auth
  } else {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await runSnapshot();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Invoice snapshot error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Snapshot failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
