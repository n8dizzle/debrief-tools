import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type SessionUser = { role?: string; permissions?: Record<string, Record<string, boolean>> | null };
function canEdit(user: SessionUser | undefined): boolean {
  return !!user && (user.role === 'owner' || !!user.permissions?.hr_hub?.can_manage_templates);
}

// GET /api/business-units — distinct active business unit names (for the roster picker).
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEdit(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('ap_technicians')
    .select('business_unit_name')
    .eq('is_active', true)
    .not('business_unit_name', 'is', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const units = Array.from(new Set((data || []).map((r: any) => r.business_unit_name).filter(Boolean))).sort();
  return NextResponse.json({ units });
}
