import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  // Get counts by status
  const [
    { count: totalCount },
    { count: newCount },
    { count: inProgressCount },
    { count: highPriorityCount },
  ] = await Promise.all([
    supabase.from('dd_documents').select('*', { count: 'exact', head: true }),
    supabase.from('dd_documents').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('dd_documents').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabase.from('dd_documents').select('*', { count: 'exact', head: true }).eq('priority', 'high').in('status', ['new', 'in_progress']),
  ]);

  // Get pending action items count
  const { count: pendingActionsCount } = await supabase
    .from('dd_action_items')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'in_progress']);

  // Get recent documents
  const { data: recentDocs } = await supabase
    .from('dd_documents')
    .select(`
      *,
      uploader:portal_users!dd_documents_uploaded_by_fkey(name, email),
      action_items:dd_action_items(id, status)
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  return NextResponse.json({
    stats: {
      total: totalCount || 0,
      new: newCount || 0,
      in_progress: inProgressCount || 0,
      high_priority: highPriorityCount || 0,
      pending_actions: pendingActionsCount || 0,
    },
    recent_documents: recentDocs || [],
  });
}
