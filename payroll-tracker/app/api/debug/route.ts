import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServiceTitanClient } from '@/lib/servicetitan';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'owner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const st = getServiceTitanClient();

  // Fetch 1 page of each timesheet type to see raw field names
  const [jobTs, nonJobTs, payItems] = await Promise.all([
    st.debugRawRequest(`payroll/v2/tenant/${process.env.SERVICETITAN_TENANT_ID || process.env.ST_TENANT_ID}/job-timesheets`, {
      dateOnOrAfter: '2026-03-01',
      dateOnOrBefore: '2026-04-06',
      pageSize: '3',
      page: '1',
    }),
    st.debugRawRequest(`payroll/v2/tenant/${process.env.SERVICETITAN_TENANT_ID || process.env.ST_TENANT_ID}/non-job-timesheets`, {
      dateOnOrAfter: '2026-03-01',
      dateOnOrBefore: '2026-04-06',
      pageSize: '3',
      page: '1',
    }),
    st.debugRawRequest(`payroll/v2/tenant/${process.env.SERVICETITAN_TENANT_ID || process.env.ST_TENANT_ID}/gross-pay-items/flat`, {
      dateOnOrAfter: '2026-03-01',
      dateOnOrBefore: '2026-04-06',
      pageSize: '3',
      page: '1',
    }),
  ]);

  return NextResponse.json({
    jobTimesheets: jobTs,
    nonJobTimesheets: nonJobTs,
    grossPayItems: payItems,
  });
}
