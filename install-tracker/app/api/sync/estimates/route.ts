import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getEstimatesByProject, toEstimateRow, stConfigured } from '@/lib/servicetitan';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true;
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  return role === 'owner' || role === 'manager';
}

// Pull all ServiceTitan estimates for install-job projects into install_estimates.
// Query params: projectId=<one project> | limit=<max projects> (default 40).
async function handle(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!stConfigured()) return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 503 });
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const url = new URL(req.url);
  const oneProject = url.searchParams.get('projectId');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 40, 1000);

  // Which projects to sync
  let projectIds: number[];
  if (oneProject) {
    projectIds = [Number(oneProject)];
  } else {
    const { data } = await supabase
      .from('ap_install_jobs')
      .select('st_project_id')
      .eq('business_unit_name', 'HVAC - Install')
      .eq('is_ignored', false)
      .not('st_project_id', 'is', null)
      .order('synced_at', { ascending: false });
    projectIds = Array.from(new Set((data || []).map((r: { st_project_id: number }) => r.st_project_id))).slice(0, limit);
  }

  let projectsDone = 0;
  let estimatesUpserted = 0;
  const errors: string[] = [];

  const CONCURRENCY = 6;
  let idx = 0;
  async function worker() {
    while (idx < projectIds.length) {
      const pid = projectIds[idx++];
      try {
        const ests = await getEstimatesByProject(pid);
        const rows = ests.map((e) => toEstimateRow(e, pid));
        if (rows.length) {
          const { error } = await supabase!.from('install_estimates').upsert(rows, { onConflict: 'estimate_id' });
          if (error) errors.push(`project ${pid}: ${error.message}`);
          else estimatesUpserted += rows.length;
        }
        projectsDone++;
      } catch (err) {
        errors.push(`project ${pid}: ${(err as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, projectIds.length) }, () => worker()));

  return NextResponse.json({
    projectsRequested: projectIds.length,
    projectsDone,
    estimatesUpserted,
    errorCount: errors.length,
    errors: errors.slice(0, 10),
  });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
