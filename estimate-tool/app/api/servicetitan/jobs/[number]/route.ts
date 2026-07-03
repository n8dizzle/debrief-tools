import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceTitanClient } from '@/lib/servicetitan';

export const dynamic = 'force-dynamic';

// GET /api/servicetitan/jobs/[number]
// Looks up a job by ST job number and returns job + customer + location details
export async function GET(
  request: Request,
  { params }: { params: { number: string } }
) {
  // Auth check disabled for MVP testing
  // const session = await getServerSession(authOptions);
  // if (!session) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  const jobNumber = params.number;
  if (!jobNumber) {
    return NextResponse.json({ error: 'Job number required' }, { status: 400 });
  }

  try {
    const st = new ServiceTitanClient();

    // Look up the job by number
    const job = await st.getJobByNumber(jobNumber);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Fetch customer and location in parallel
    const [customer, location] = await Promise.all([
      st.getCustomer(job.customerId),
      st.getLocation(job.locationId),
    ]);

    // Extract phone and email from customer contacts
    const phone = customer.contacts?.find(c => c.type === 'Phone' || c.type === 'MobilePhone')?.value || '';
    const email = customer.contacts?.find(c => c.type === 'Email')?.value || '';

    // Format address
    const addr = location.address || customer.address;
    const address = addr
      ? [addr.street, addr.unit, addr.city, addr.state, addr.zip].filter(Boolean).join(', ')
      : '';

    return NextResponse.json({
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
        businessUnitId: job.businessUnitId,
        businessUnitName: job.businessUnitName,
        jobStatus: job.jobStatus,
        summary: job.summary,
      },
      customer: {
        id: customer.id,
        name: customer.name,
        phone,
        email,
        address,
      },
      location: {
        id: location.id,
        address,
      },
    });
  } catch (err) {
    console.error('[Job Lookup] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to look up job' },
      { status: 500 }
    );
  }
}
