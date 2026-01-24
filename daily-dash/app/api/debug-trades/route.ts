import { NextRequest, NextResponse } from 'next/server';
import { getServiceTitanClient } from '@/lib/servicetitan';

/**
 * Debug endpoint to trace trade metrics calculation
 * GET /api/debug-trades?month=2025-12
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const month = searchParams.get('month') || '2025-12';

  const [year, monthNum] = month.split('-').map(Number);
  const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${lastDay}`;

  const stClient = getServiceTitanClient();

  if (!stClient.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }

  try {
    // Get business units
    const businessUnits = await stClient.getBusinessUnits();
    const hvacBuNames = ['HVAC - Install', 'HVAC - Service', 'HVAC - Maintenance', 'HVAC - Commercial', 'Mims - Service'];
    const plumbingBuNames = ['Plumbing - Install', 'Plumbing - Service', 'Plumbing - Maintenance', 'Plumbing - Sales', 'Plumbing - Commercial'];

    const hvacBuIds = businessUnits.filter(bu => hvacBuNames.includes(bu.name)).map(bu => bu.id);
    const plumbingBuIds = businessUnits.filter(bu => plumbingBuNames.includes(bu.name)).map(bu => bu.id);

    // Get completed jobs for the month
    const dayAfterEnd = new Date(year, monthNum, 1).toISOString().split('T')[0];
    const jobs = await stClient.getCompletedJobs(startDate, dayAfterEnd);

    // Separate by trade
    const hvacJobs = jobs.filter(j => hvacBuIds.includes(j.businessUnitId));
    const plumbingJobs = jobs.filter(j => plumbingBuIds.includes(j.businessUnitId));
    const otherJobs = jobs.filter(j => !hvacBuIds.includes(j.businessUnitId) && !plumbingBuIds.includes(j.businessUnitId));

    // Calculate totals
    const hvacTotal = hvacJobs.reduce((sum, j) => sum + (Number(j.total) || 0), 0);
    const plumbingTotal = plumbingJobs.reduce((sum, j) => sum + (Number(j.total) || 0), 0);
    const otherTotal = otherJobs.reduce((sum, j) => sum + (Number(j.total) || 0), 0);

    // Get metrics the normal way too
    const metrics = await stClient.getTradeMetrics(startDate, endDate);

    return NextResponse.json({
      params: { month, startDate, endDate, dayAfterEnd },
      businessUnits: {
        all: businessUnits.map(bu => ({ id: bu.id, name: bu.name })),
        hvacIds: hvacBuIds,
        plumbingIds: plumbingBuIds,
      },
      jobs: {
        total: jobs.length,
        hvacCount: hvacJobs.length,
        plumbingCount: plumbingJobs.length,
        otherCount: otherJobs.length,
        otherBusinessUnits: [...new Set(otherJobs.map(j => j.businessUnitId))],
      },
      rawTotals: {
        hvac: hvacTotal,
        plumbing: plumbingTotal,
        other: otherTotal,
        combined: hvacTotal + plumbingTotal + otherTotal,
      },
      metricsResult: {
        hvacRevenue: metrics.hvac.revenue,
        hvacCompleted: metrics.hvac.completedRevenue,
        plumbingRevenue: metrics.plumbing.revenue,
        plumbingCompleted: metrics.plumbing.completedRevenue,
      },
      // Sample jobs to verify data
      sampleJobs: {
        hvac: hvacJobs.slice(0, 3).map(j => ({
          id: j.id,
          total: j.total,
          completedOn: j.completedOn,
          businessUnitId: j.businessUnitId,
        })),
        plumbing: plumbingJobs.slice(0, 3).map(j => ({
          id: j.id,
          total: j.total,
          completedOn: j.completedOn,
          businessUnitId: j.businessUnitId,
        })),
      },
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Debug failed'
    }, { status: 500 });
  }
}
