import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Sold estimates for one project — powers the deal-row drill-down popup.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const projectId = Number(new URL(req.url).searchParams.get('projectId'));
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const { data } = await supabase
    .from('install_estimates')
    .select('estimate_id, estimate_job_number, name, status, subtotal, equipment_count')
    .eq('st_project_id', projectId)
    .eq('status', 'Sold')
    .order('subtotal', { ascending: false });

  return NextResponse.json({ estimates: data ?? [] });
}
