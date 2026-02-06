import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServiceTitanClient } from '@/lib/servicetitan';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['manager', 'owner'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const locationId = request.nextUrl.searchParams.get('locationId');
    const jobNumber = request.nextUrl.searchParams.get('jobNumber');
    const invoiceId = request.nextUrl.searchParams.get('invoiceId');

    const stClient = getServiceTitanClient();

    if (!stClient.isConfigured()) {
      return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
    }

    let result: any = {};

    // If invoice ID provided, fetch raw invoice details
    if (invoiceId) {
      try {
        // Try by ID first
        const invoice = await stClient.getInvoice(parseInt(invoiceId));
        result.invoiceById = invoice;
      } catch (err: any) {
        result.invoiceByIdError = err?.message || String(err);
      }

      try {
        // Also try by number (invoice number = invoice ID in ST sometimes)
        const invoiceByNumber = await stClient.getInvoiceByNumber(invoiceId);
        result.invoiceByNumber = invoiceByNumber;
      } catch (err: any) {
        result.invoiceByNumberError = err?.message || String(err);
      }

      return NextResponse.json(result);
    }

    // If job number provided, look up the job first to get locationId
    if (jobNumber) {
      const job = await stClient.getJobByNumber(jobNumber);
      result.job = job;
      if (job?.locationId) {
        const location = await stClient.getLocation(job.locationId);
        result.location = location;
        result.hasMembershipTag = stClient.locationHasMembershipTag(location);
        result.hasMembershipId = job.membershipId != null && job.membershipId > 0;
      }
      // Also check for invoiceId on the job and fetch invoice
      const jobAny = job as any;
      if (jobAny?.invoiceId) {
        const invoice = await stClient.getInvoice(jobAny.invoiceId);
        result.invoice = invoice;
      }
    } else if (locationId) {
      const location = await stClient.getLocation(parseInt(locationId));
      result.location = location;
      result.hasMembershipTag = stClient.locationHasMembershipTag(location);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Test location error:', error);
    return NextResponse.json(
      { error: 'Failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
