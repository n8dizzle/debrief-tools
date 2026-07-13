import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPEPermission } from '@/lib/pe-utils';

/**
 * Deletes all pe_orders rows. Session + can_manage gated.
 * Intended for re-seeding after a sync mapping change (the every-15-min cron
 * repopulates from ST report 54646792). Manual edits are lost, so use with care.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getServerSupabase();
  const { error, count } = await supabase
    .from('pe_orders')
    .delete({ count: 'exact' })
    .gte('id', 0); // delete all rows

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: count });
}
