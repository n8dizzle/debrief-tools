import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceTitanClient } from '@/lib/servicetitan';

export const dynamic = 'force-dynamic';

// POST /api/servicetitan/estimates
// Creates an estimate in ServiceTitan and optionally marks it as sold
export async function POST(request: Request) {
  // Auth check disabled for MVP testing
  // const session = await getServerSession(authOptions);
  // if (!session) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  try {
    const body = await request.json();
    const { jobId, name, summary, items, sold } = body;

    if (!jobId || !items?.length) {
      return NextResponse.json(
        { error: 'jobId and items are required' },
        { status: 400 }
      );
    }

    const st = new ServiceTitanClient();

    // Create the estimate
    const estimate = await st.createEstimate({
      jobId,
      name: name || 'HVAC Estimate',
      summary,
      items,
    });

    // If the customer accepted, mark it as sold
    if (sold && estimate.id) {
      await st.sellEstimate(estimate.id);
    }

    return NextResponse.json({
      success: true,
      estimateId: estimate.id,
      total: estimate.total,
    });
  } catch (err) {
    console.error('[Create Estimate] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create estimate' },
      { status: 500 }
    );
  }
}
