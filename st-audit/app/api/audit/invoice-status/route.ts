import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServiceTitanClient, STInvoice } from '@/lib/servicetitan';
import { hoursElapsed, formatLocalDateTime, formatLocalDate } from '@/lib/date-utils';
import { getServerSupabase } from '@/lib/supabase';

export interface InvoiceStatusItem {
  id: number;
  invoiceNumber: string;
  status: string;
  customerName: string;
  businessUnitName: string;
  total: number;
  balance: number;
  createdOn: string;
  invoiceDate: string;
  ageHours: number;
  jobId: number | null;
  jobNumber: string | null;
}

export interface InvoiceStatusSummary {
  pending: { count: number; total: number; avgAgeHours: number; estimated?: boolean };
  posted: { count: number; total: number; avgAgeHours: number; estimated?: boolean };
}

export interface InvoiceSnapshotRow {
  snapshot_date: string;
  pending_count: number;
  pending_total: number;
  posted_count: number;
  posted_total: number;
  avg_pending_age_hours: number;
  avg_posted_age_hours: number;
}

export interface InvoiceStatusResponse {
  invoices: InvoiceStatusItem[];
  summary: InvoiceStatusSummary;
  history: InvoiceSnapshotRow[];
  fetchedAt: string;
}

function buildSummaryFromSample(
  totalCount: number,
  sampleInvoices: STInvoice[]
): { count: number; total: number; avgAgeHours: number; estimated: boolean } {
  const withMoney = sampleInvoices.filter(inv => Math.abs(inv.total) > 0);
  if (withMoney.length === 0) {
    return { count: totalCount, total: 0, avgAgeHours: 0, estimated: totalCount > sampleInvoices.length };
  }

  const sampleTotal = withMoney.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
  const ages = withMoney.filter(inv => inv.createdOn).map(inv => hoursElapsed(inv.createdOn!));
  const avgAgeHours = ages.length > 0
    ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10
    : 0;

  // If we have all invoices, use exact numbers. Otherwise estimate total $ from sample.
  const isEstimated = totalCount > sampleInvoices.length;
  const estimatedTotal = isEstimated
    ? Math.round(sampleTotal * (totalCount / sampleInvoices.length))
    : sampleTotal;

  return { count: totalCount, total: estimatedTotal, avgAgeHours, estimated: isEstimated };
}

const mapInvoice = (inv: STInvoice, status: string): InvoiceStatusItem => ({
  id: inv.id,
  invoiceNumber: inv.invoiceNumber || String(inv.id),
  status,
  customerName: inv.customer?.name || 'Unknown',
  businessUnitName: inv.businessUnit?.name || 'Unknown',
  total: Number(inv.total) || 0,
  balance: Number(inv.balance) || 0,
  createdOn: inv.createdOn || '',
  invoiceDate: inv.invoiceDate || inv.createdOn || '',
  ageHours: inv.createdOn ? Math.round(hoursElapsed(inv.createdOn) * 10) / 10 : 0,
  jobId: inv.job?.id || null,
  jobNumber: inv.job?.number || null,
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = getServiceTitanClient();
    if (!client.isConfigured()) {
      return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
    }

    // Fast path: get totalCount + first page sample for summary stats (2 API calls)
    const [pendingSummary, postedSummary] = await Promise.all([
      client.getInvoiceSummaryByStatus('Pending'),
      client.getInvoiceSummaryByStatus('Posted'),
    ]);

    const summary: InvoiceStatusSummary = {
      pending: buildSummaryFromSample(pendingSummary.totalCount, pendingSummary.firstPage),
      posted: buildSummaryFromSample(postedSummary.totalCount, postedSummary.firstPage),
    };

    // For the detail table, only fetch invoices from last 90 days (manageable volume)
    const ninetyDaysAgo = formatLocalDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
    const [recentPending, recentPosted] = await Promise.all([
      client.getInvoicesByStatus('Pending', { createdOnOrAfter: ninetyDaysAgo, maxPages: 20 }),
      client.getInvoicesByStatus('Posted', { createdOnOrAfter: ninetyDaysAgo, maxPages: 20 }),
    ]);

    // Deduplicate by invoice ID (same invoice can appear in both API calls)
    const invoiceMap = new Map<number, InvoiceStatusItem>();
    for (const inv of [...recentPending, ...recentPosted]) {
      if (Math.abs(inv.total) > 0 && !invoiceMap.has(inv.id)) {
        invoiceMap.set(inv.id, mapInvoice(inv, inv.status || 'Unknown'));
      }
    }
    const invoices = Array.from(invoiceMap.values()).sort((a, b) => b.ageHours - a.ageHours);

    // Fetch historical snapshots (last 90 days)
    const supabase = getServerSupabase();
    const { data: history } = await supabase
      .from('audit_invoice_snapshots')
      .select('snapshot_date, pending_count, pending_total, posted_count, posted_total, avg_pending_age_hours, avg_posted_age_hours')
      .gte('snapshot_date', ninetyDaysAgo)
      .order('snapshot_date', { ascending: true });

    const response: InvoiceStatusResponse = {
      invoices,
      summary,
      history: (history || []) as InvoiceSnapshotRow[],
      fetchedAt: formatLocalDateTime(new Date()),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Invoice status audit error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch invoice data' },
      { status: 500 }
    );
  }
}
