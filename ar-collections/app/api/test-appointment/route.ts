import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServiceTitanClient } from '@/lib/servicetitan';

/**
 * Test endpoint to explore job/booking structure from ServiceTitan
 * GET /api/test-appointment?jobNumber=123456
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['manager', 'owner'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobNumber = searchParams.get('jobNumber');

    if (!jobNumber) {
      return NextResponse.json({ error: 'jobNumber required' }, { status: 400 });
    }

    const stClient = getServiceTitanClient();

    if (!stClient.isConfigured()) {
      return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
    }

    // Get job by number
    const job = await stClient.getJobByNumber(jobNumber);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobAny = job as any;

    // Return all job fields for exploration
    return NextResponse.json({
      jobKeys: Object.keys(job),
      job: job,
      bookingId: jobAny.bookingId,
      customFields: jobAny.customFields,
      // Check common payment field names
      possiblePaymentFields: {
        paymentType: jobAny.paymentType,
        paymentMethod: jobAny.paymentMethod,
        howToPay: jobAny.howToPay,
        billingType: jobAny.billingType,
        expectedPayment: jobAny.expectedPayment,
      },
    });
  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json(
      { error: 'Failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
