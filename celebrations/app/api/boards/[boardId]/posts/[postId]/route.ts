import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// PATCH /api/boards/[boardId]/posts/[postId] - Update post
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string; postId: string }> }
) {
  const { boardId, postId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  // Check if user is the author or a manager/owner
  const { data: post } = await supabase
    .from('cel_posts')
    .select('author_user_id')
    .eq('id', postId)
    .eq('board_id', boardId)
    .single();

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const isAuthor = post.author_user_id === session.user.id;
  const isManagerOrOwner = session.user.role === 'owner' || session.user.role === 'manager';

  if (!isAuthor && !isManagerOrOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ('text_content' in body) updates.text_content = body.text_content;
  if ('background_color' in body) updates.background_color = body.background_color;
  if ('is_pinned' in body && isManagerOrOwner) updates.is_pinned = body.is_pinned;

  const { data: updated, error } = await supabase
    .from('cel_posts')
    .update(updates)
    .eq('id', postId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: updated });
}

// DELETE /api/boards/[boardId]/posts/[postId] - Delete post
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string; postId: string }> }
) {
  const { boardId, postId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  const { data: post } = await supabase
    .from('cel_posts')
    .select('author_user_id, media_storage_path')
    .eq('id', postId)
    .eq('board_id', boardId)
    .single();

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const isAuthor = post.author_user_id === session.user.id;
  const isManagerOrOwner = session.user.role === 'owner' || session.user.role === 'manager';

  if (!isAuthor && !isManagerOrOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delete media from storage if exists
  if (post.media_storage_path) {
    await supabase.storage
      .from('celebrations-media')
      .remove([post.media_storage_path]);
  }

  const { error } = await supabase
    .from('cel_posts')
    .delete()
    .eq('id', postId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
