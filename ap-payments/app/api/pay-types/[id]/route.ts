import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/** DELETE /api/pay-types/[id] — remove a pay type (only if no technician uses it). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_contractors')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const supabase = getServerSupabase();

  const { count } = await supabase
    .from('ap_technician_pay_types')
    .select('id', { count: 'exact', head: true })
    .eq('pay_type_id', id);
  if ((count || 0) > 0) {
    return NextResponse.json({ error: `In use by ${count} technician${count === 1 ? '' : 's'} — remove those first.` }, { status: 409 });
  }

  const { error } = await supabase.from('ap_pay_types').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
