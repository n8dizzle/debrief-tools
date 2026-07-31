import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type SessionUser = { role?: string; permissions?: Record<string, Record<string, boolean>> | null };
function canView(user: SessionUser | undefined): boolean {
  return !!user && (user.role === 'owner' || !!user.permissions?.hr_hub?.can_access);
}
function canEdit(user: SessionUser | undefined): boolean {
  return !!user && (user.role === 'owner' || !!user.permissions?.hr_hub?.can_manage_templates);
}

// GET /api/ladders            — active ladders (for the assessment picker)
// GET /api/ladders?all=1      — include inactive (editor only; requires edit permission)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canView(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const all = new URL(req.url).searchParams.get('all') === '1' && canEdit(user);
  const supabase = getServerSupabase();
  let q = supabase.from('hr_ladders').select('id, name, description, is_active, sort_order');
  if (!all) q = q.eq('is_active', true);
  const { data, error } = await q.order('sort_order').order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ladders: data || [] });
}
