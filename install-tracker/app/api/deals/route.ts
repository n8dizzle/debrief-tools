import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const VALID = ['untriaged', 'full_system', 'partial', 'warranty', 'archived'];

// Triage deals. Body: { projectIds: number[], status }. Owner/manager only.
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'owner' && user.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const projectIds: number[] = Array.isArray(body.projectIds) ? body.projectIds.map(Number).filter(Boolean) : [];
  const status: string = body.status;
  if (!projectIds.length) return NextResponse.json({ error: 'projectIds required' }, { status: 400 });
  if (!VALID.includes(status)) return NextResponse.json({ error: `status must be one of ${VALID.join(', ')}` }, { status: 400 });

  // Chunk to keep the .in() list well under any URL-length limit.
  const patch = { triage_status: status, triaged_by: user.id ?? null, triaged_at: new Date().toISOString() };
  let updated = 0;
  for (let i = 0; i < projectIds.length; i += 100) {
    const chunk = projectIds.slice(i, i + 100);
    const { error, count } = await supabase
      .from('install_deals').update(patch, { count: 'exact' }).in('st_project_id', chunk);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    updated += count ?? chunk.length;
  }
  return NextResponse.json({ updated, status });
}
