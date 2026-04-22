import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/dashboard/snapshots?days=90
// Returns per-day AR snapshots + per-day-per-group snapshots + group labels.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get('days') || '90', 10)));

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    const supabase = getServerSupabase();

    const [snapsRes, groupSnapsRes, groupsRes] = await Promise.all([
      supabase
        .from('ar_daily_snapshots')
        .select('*')
        .gte('snapshot_date', sinceStr)
        .order('snapshot_date', { ascending: true }),
      supabase
        .from('ar_daily_group_snapshots')
        .select('*')
        .gte('snapshot_date', sinceStr)
        .order('snapshot_date', { ascending: true }),
      supabase
        .from('shared_business_unit_groups')
        .select('id, label, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ]);

    if (snapsRes.error) throw snapsRes.error;
    if (groupSnapsRes.error) throw groupSnapsRes.error;
    if (groupsRes.error) throw groupsRes.error;

    return NextResponse.json({
      snapshots: snapsRes.data || [],
      groupSnapshots: groupSnapsRes.data || [],
      groups: groupsRes.data || [],
    });
  } catch (error) {
    console.error('Snapshots GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 },
    );
  }
}
