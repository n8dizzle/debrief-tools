import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// PUT /api/l10/issues/reorder
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { order } = await request.json() as {
      order: { id: string; sort_order: number }[];
    };

    if (!order?.length) {
      return NextResponse.json({ error: 'Order array is required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Update each issue's sort_order
    const updates = order.map(({ id, sort_order }) =>
      supabase
        .from('l10_issues')
        .update({ sort_order, updated_at: new Date().toISOString() })
        .eq('id', id)
    );

    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error('Error reordering issues:', failed.error);
      return NextResponse.json({ error: 'Failed to reorder issues' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in issues reorder:', error);
    return NextResponse.json({ error: 'Failed to reorder issues' }, { status: 500 });
  }
}
