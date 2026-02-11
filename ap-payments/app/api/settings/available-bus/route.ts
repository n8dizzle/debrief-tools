import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServiceTitanClient } from '@/lib/servicetitan';

// GET - Fetch all active business units from ServiceTitan
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const st = getServiceTitanClient();
  if (!st.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }

  try {
    const businessUnits = await st.getBusinessUnits();
    const names = businessUnits
      .filter(bu => bu.active)
      .map(bu => bu.name)
      .sort();

    return NextResponse.json(names);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch BUs' },
      { status: 500 }
    );
  }
}
