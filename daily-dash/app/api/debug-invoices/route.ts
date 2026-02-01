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

    // Also get what getTradeMetrics returns
    const lastDay = new Date(year, monthNum, 0).getDate();
    const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${lastDay}`;
    const tradeMetrics = await stClient.getTradeMetrics(startDate, endDate);

    // === DEEP ANALYSIS: Compare job.total vs invoice sums ===
    const allCompletedJobIds = new Set(jobs.map(j => j.id));
    const hvacBuNames = ['HVAC - Install', 'HVAC - Service', 'HVAC - Maintenance', 'HVAC - Commercial', 'HVAC - Sales', 'Mims - Service'];
    const businessUnits = await stClient.getBusinessUnits();
    const hvacBuIds = new Set(businessUnits.filter(bu => hvacBuNames.includes(bu.name)).map(bu => bu.id));

    // Sum job.total for HVAC jobs
    const hvacJobs = jobs.filter(j => hvacBuIds.has(j.businessUnitId));
    const jobTotalSum = hvacJobs.reduce((sum, j) => sum + (Number(j.total) || 0), 0);

    // Sum invoices for HVAC completed jobs (excluding adjustments)
    let invoiceSumForCompletedJobs = 0;
    let invoiceCountForCompletedJobs = 0;
    let jobsWithInvoices = new Set<number>();
    let jobsMissingInvoices: number[] = [];

    for (const inv of invoices) {
      if (!inv.job?.id) continue;
      if (!allCompletedJobIds.has(inv.job.id)) continue;

      // Get business unit
      const buId = inv.businessUnit?.id;
      if (!buId || !hvacBuIds.has(buId)) continue;

      // Skip adjustments (adjustmentToId set)
      if (inv.adjustmentToId != null) continue;

      invoiceSumForCompletedJobs += Number(inv.total) || 0;
      invoiceCountForCompletedJobs++;
      jobsWithInvoices.add(inv.job.id);
    }

    // Find HVAC jobs that have no invoices in our range
    const jobsMissingInvoicesDetails: { id: number; total: number; completedOn?: string }[] = [];
    for (const job of hvacJobs) {
      if (!jobsWithInvoices.has(job.id)) {
        jobsMissingInvoices.push(job.id);
        jobsMissingInvoicesDetails.push({
          id: job.id,
          total: Number(job.total) || 0,
          completedOn: job.completedOn,
        });
      }
    }
    const missingJobsTotal = jobsMissingInvoicesDetails.reduce((sum, j) => sum + j.total, 0);

    return NextResponse.json({
      params: { month, startDate, endDate, dayAfterEnd, fetchStartDate },
      completedJobsCount: jobs.length,
      analysis,
      tradeMetricsResult: {
        hvac: {
          revenue: tradeMetrics.hvac.revenue,
          completedRevenue: tradeMetrics.hvac.completedRevenue,
          nonJobRevenue: tradeMetrics.hvac.nonJobRevenue,
          adjRevenue: tradeMetrics.hvac.adjRevenue,
        },
        plumbing: {
          revenue: tradeMetrics.plumbing.revenue,
          completedRevenue: tradeMetrics.plumbing.completedRevenue,
          nonJobRevenue: tradeMetrics.plumbing.nonJobRevenue,
          adjRevenue: tradeMetrics.plumbing.adjRevenue,
        }
      },
      deepAnalysis: {
        hvacJobCount: hvacJobs.length,
        jobTotalSum: jobTotalSum,
        invoiceSumForCompletedJobs: invoiceSumForCompletedJobs,
        invoiceCountForCompletedJobs: invoiceCountForCompletedJobs,
        jobsWithInvoicesCount: jobsWithInvoices.size,
        jobsMissingInvoicesCount: jobsMissingInvoices.length,
        jobsMissingInvoicesDetails: jobsMissingInvoicesDetails,
        jobsMissingInvoicesTotal: missingJobsTotal,
        gap: {
          stCompleted: 426838,
          ourJobTotal: jobTotalSum,
          ourInvoiceSum: invoiceSumForCompletedJobs,
          jobTotalVsSTGap: 426838 - jobTotalSum,
          invoiceSumVsSTGap: 426838 - invoiceSumForCompletedJobs,
        }
      },
      expectedFromST: {
        hvacNonJobRevenue: 19782,
        hvacAdjRevenue: -8798,
        hvacTotal: 437822,
        hvacCompleted: 426838,
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
