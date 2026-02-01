import { NextRequest, NextResponse } from 'next/server';
import { getServiceTitanClient } from '@/lib/servicetitan';

/**
 * Debug endpoint to analyze invoice data for Non-Job and Adj Revenue
 * GET /api/debug-invoices?month=2026-01
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const month = searchParams.get('month') || '2026-01';

  const [year, monthNum] = month.split('-').map(Number);
  const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
  const dayAfterEnd = new Date(year, monthNum, 1).toISOString().split('T')[0];

  const stClient = getServiceTitanClient();

  if (!stClient.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }

  try {
    // Fetch invoices from 60 days before to catch all
    const fetchStart = new Date(year, monthNum - 1, 1);
    fetchStart.setDate(fetchStart.getDate() - 60);
    const fetchStartDate = fetchStart.toISOString().split('T')[0];

    // Get all invoices
    const invoices = await stClient.getInvoicesDateRange(fetchStartDate, dayAfterEnd);

    // Get completed jobs for the month
    const jobs = await stClient.getCompletedJobs(startDate, dayAfterEnd);
    const completedJobIds = new Set(jobs.map(j => j.id));

    // Analyze invoices
    const analysis = {
      totalFetched: invoices.length,
      withInvoiceDate: 0,
      withoutInvoiceDate: 0,
      invoiceDateInRange: 0,
      invoiceDateOutOfRange: 0,
      nonJobInvoices: [] as any[],
      adjInvoices: [] as any[],
      nonJobTotal: 0,
      adjTotal: 0,
    };

    for (const inv of invoices) {
      const total = Number(inv.total) || 0;
      const invDate = inv.invoiceDate?.split('T')[0];

      if (invDate) {
        analysis.withInvoiceDate++;
        if (invDate >= startDate && invDate < dayAfterEnd) {
          analysis.invoiceDateInRange++;
        } else {
          analysis.invoiceDateOutOfRange++;
          continue; // Skip invoices outside date range
        }
      } else {
        analysis.withoutInvoiceDate++;
      }

      const hasJob = inv.job?.id != null;
      const isAdjustment = inv.adjustmentToId != null || total < 0;

      if (!hasJob) {
        analysis.nonJobTotal += total;
        if (analysis.nonJobInvoices.length < 20) {
          analysis.nonJobInvoices.push({
            id: inv.id,
            total,
            invoiceDate: inv.invoiceDate,
            createdOn: inv.createdOn,
            businessUnit: inv.businessUnit,
            summary: inv.summary?.substring(0, 50),
          });
        }
      } else if (isAdjustment) {
        analysis.adjTotal += total;
        if (analysis.adjInvoices.length < 20) {
          analysis.adjInvoices.push({
            id: inv.id,
            total,
            invoiceDate: inv.invoiceDate,
            createdOn: inv.createdOn,
            jobId: inv.job?.id,
            adjustmentToId: inv.adjustmentToId,
            businessUnit: inv.businessUnit,
          });
        }
      }
    }

    return NextResponse.json({
      params: { month, startDate, dayAfterEnd, fetchStartDate },
      completedJobsCount: jobs.length,
      analysis,
      expectedFromST: {
        nonJobRevenue: 19782,
        adjRevenue: -8798,
        note: 'HVAC MTD values from ServiceTitan dashboard'
      }
    });
  } catch (error) {
    console.error('Debug invoices error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Debug failed'
    }, { status: 500 });
  }
}
