import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServiceTitanClient, STJob } from '@/lib/servicetitan';
import { hoursElapsed, formatLocalDateTime } from '@/lib/date-utils';

export interface OpenJobResult {
  id: number;
  jobNumber: string;
  jobStatus: string;
  businessUnitName: string;
  jobTypeName: string;
  customerId: number;
  createdOn: string;
  hoursOpen: number;
  severity: 'warning' | 'critical';
}

export interface OpenJobsAuditResponse {
  jobs: OpenJobResult[];
  summary: {
    total: number;
    warning: number;
    critical: number;
    byStatus: Record<string, number>;
    byBusinessUnit: Record<string, number>;
  };
  fetchedAt: string;
}

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

    // Fetch all open jobs (In Progress, Dispatched, Hold)
    const jobs = await client.getOpenJobs();

    // Also get business units for name mapping
    const businessUnits = await client.getBusinessUnits();
    const buMap = new Map(businessUnits.map(bu => [bu.id, bu.name]));

    // Filter to jobs older than 24 hours and map results
    const now = new Date();
    const results: OpenJobResult[] = [];

    for (const job of jobs) {
      if (!job.createdOn) continue;

      const hours = hoursElapsed(job.createdOn);
      if (hours < 24) continue;

      // Critical = over 72 hours, Warning = 24-72 hours
      const severity: 'warning' | 'critical' = hours >= 72 ? 'critical' : 'warning';

      results.push({
        id: job.id,
        jobNumber: job.jobNumber,
        jobStatus: job.jobStatus,
        businessUnitName: buMap.get(job.businessUnitId) || `BU ${job.businessUnitId}`,
        jobTypeName: job.jobTypeName || 'Unknown',
        customerId: job.customerId,
        createdOn: job.createdOn,
        hoursOpen: Math.round(hours * 10) / 10,
        severity,
      });
    }

    // Sort by hours open descending (oldest first)
    results.sort((a, b) => b.hoursOpen - a.hoursOpen);

    // Build summary
    const byStatus: Record<string, number> = {};
    const byBusinessUnit: Record<string, number> = {};
    let warning = 0;
    let critical = 0;

    for (const job of results) {
      byStatus[job.jobStatus] = (byStatus[job.jobStatus] || 0) + 1;
      byBusinessUnit[job.businessUnitName] = (byBusinessUnit[job.businessUnitName] || 0) + 1;
      if (job.severity === 'critical') critical++;
      else warning++;
    }

    const response: OpenJobsAuditResponse = {
      jobs: results,
      summary: {
        total: results.length,
        warning,
        critical,
        byStatus,
        byBusinessUnit,
      },
      fetchedAt: formatLocalDateTime(now),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Open jobs audit error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch open jobs' },
      { status: 500 }
    );
  }
}
