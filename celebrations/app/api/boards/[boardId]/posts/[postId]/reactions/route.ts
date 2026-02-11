import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// POST /api/boards/[boardId]/posts/[postId]/reactions - Add reaction
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string; postId: string }> }
) {
  const { postId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { emoji } = await req.json();
  if (!emoji) {
    return NextResponse.json({ error: 'Emoji is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Check if already reacted with this emoji
  const { data: existing } = await supabase
    .from('cel_reactions')
    .select('id')
    .eq('post_id', postId)
    .eq('emoji', emoji)
    .eq('reactor_user_id', session.user.id)
    .single();

  if (existing) {
    // Toggle off - remove the reaction
    await supabase.from('cel_reactions').delete().eq('id', existing.id);
    return NextResponse.json({ removed: true });
  }

  const { data: reaction, error } = await supabase
    .from('cel_reactions')
    .insert({
      post_id: postId,
      emoji,
      reactor_name: session.user.name || 'Anonymous',
      reactor_user_id: session.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reaction }, { status: 201 });
}
