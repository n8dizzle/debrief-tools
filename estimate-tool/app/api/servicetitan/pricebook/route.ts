import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceTitanClient } from '@/lib/servicetitan';

export const dynamic = 'force-dynamic';

// GET /api/servicetitan/pricebook?type=equipment|materials|services|categories
export async function GET(request: Request) {
  // Auth check disabled for MVP testing
  // const session = await getServerSession(authOptions);
  // if (!session) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'equipment';

  try {
    const st = new ServiceTitanClient();

    switch (type) {
      case 'equipment': {
        const items = await st.getEquipment();
        return NextResponse.json({ data: items, count: items.length });
      }
      case 'materials': {
        const items = await st.getMaterials();
        return NextResponse.json({ data: items, count: items.length });
      }
      case 'services': {
        const items = await st.getServices();
        return NextResponse.json({ data: items, count: items.length });
      }
      case 'categories': {
        const items = await st.getCategories();
        return NextResponse.json({ data: items, count: items.length });
      }
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (err) {
    console.error('[Pricebook] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch pricebook' },
      { status: 500 }
    );
  }
}
