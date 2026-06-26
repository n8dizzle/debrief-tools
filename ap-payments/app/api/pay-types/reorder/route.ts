import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * POST /api/pay-types/reorder — persist pay type order.
 * Body: { ids: string[] } in the desired order. Renumbers sort_order = index.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_contractors')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { ids } = await request.json();
  if (!Array.isArray(ids)) return NextResponse.json({ error: 'ids array required' }, { status: 400 });

  const supabase = getServerSupabase();
  for (let i = 0; i < ids.length; i++) {
    await supabase.from('ap_pay_types').update({ sort_order: i }).eq('id', ids[i]);
  }
  return NextResponse.json({ success: true });
}
