import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type SessionUser = { role?: string; permissions?: Record<string, Record<string, boolean>> | null };
function canView(user: SessionUser | undefined): boolean {
  return !!user && (user.role === 'owner' || !!user.permissions?.hr_hub?.can_access);
}

// GET /api/ladders — list of ladders for the picker.
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canView(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('hr_ladders')
    .select('id, name, description, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ladders: data || [] });
}
