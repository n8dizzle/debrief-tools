import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/boards/[boardId] - Get board details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  const { data: board, error } = await supabase
    .from('cel_boards')
    .select('*, cel_posts(count)')
    .eq('id', boardId)
    .single();

  if (error || !board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  const transformed = {
    ...board,
    post_count: board.cel_posts?.[0]?.count ?? 0,
    cel_posts: undefined,
  };

  return NextResponse.json({ board: transformed });
}

// PATCH /api/boards/[boardId] - Update board
export async function PATCH(
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

  const body = await req.json();
  const allowedFields = [
    'title', 'description', 'board_type', 'visibility', 'status',
    'honoree_name', 'event_date', 'cover_image_url', 'allow_anonymous',
  ];

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  const supabase = getServerSupabase();

  const { data: board, error } = await supabase
    .from('cel_boards')
    .update(updates)
    .eq('id', boardId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await supabase.from('cel_activity_log').insert({
    board_id: boardId,
    action: 'board_updated',
    details: { fields: Object.keys(updates).filter(k => k !== 'updated_at') },
    performed_by: session.user.id,
  });

  return NextResponse.json({ board });
}

// DELETE /api/boards/[boardId] - Delete board
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can delete boards' }, { status: 403 });
  }

  const supabase = getServerSupabase();

  const { error } = await supabase
    .from('cel_boards')
    .delete()
    .eq('id', boardId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
