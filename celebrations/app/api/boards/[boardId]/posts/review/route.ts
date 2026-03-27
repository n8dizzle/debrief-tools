import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// POST /api/boards/[boardId]/posts/review - Bulk approve/reject posts
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { post_ids, action } = await req.json();

  if (!post_ids?.length || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'post_ids and action (approve|reject) required' }, { status: 400 });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('cel_posts')
    .update({ status: newStatus })
    .eq('board_id', boardId)
    .in('id', post_ids)
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: data?.length || 0 });
}
