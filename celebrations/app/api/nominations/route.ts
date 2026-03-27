import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/nominations - List nominations
// Employees: only their own; Managers: all (optionally filtered by period_id)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const periodId = searchParams.get('period_id');

  const supabase = getServerSupabase();
  const role = session.user.role;
  const isManager = role === 'owner' || role === 'manager';

  let query = supabase
    .from('cel_nominations')
    .select('*')
    .order('created_at', { ascending: false });

  if (periodId) {
    query = query.eq('period_id', periodId);
  }

  if (!isManager) {
    query = query.eq('nominator_user_id', session.user.id);
  }

  const { data: nominations, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ nominations: nominations || [] });
}
