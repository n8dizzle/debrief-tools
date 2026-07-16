import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { countEstimate, type EquipItem } from '@/lib/equipment';

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
    .select('estimate_id, estimate_job_number, name, status, subtotal, sold_on, items')
    .eq('st_project_id', projectId)
    .eq('status', 'Sold')
    .order('sold_on', { ascending: true });

  // Classify each estimate the same way the deal totals do (systems + components).
  const estimates = (data ?? []).map((e) => {
    const { systems, components } = countEstimate((e.items as EquipItem[]) || []);
    return {
      estimate_id: e.estimate_id, estimate_job_number: e.estimate_job_number,
      name: e.name, sold_on: e.sold_on, subtotal: e.subtotal, systems, components,
    };
  });

  return NextResponse.json({ estimates });
}
