import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/boards/[boardId]/posts - List posts
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status') || 'approved';

  const supabase = getServerSupabase();

  const { data: posts, error } = await supabase
    .from('cel_posts')
    .select('*, cel_reactions(*)')
    .eq('board_id', boardId)
    .eq('status', statusFilter)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform reactions
  const transformed = (posts || []).map((p: any) => ({
    ...p,
    reactions: p.cel_reactions || [],
    cel_reactions: undefined,
  }));

  // Get pending count for managers
  let pending_count = 0;
  const role = session.user.role;
  if (role === 'owner' || role === 'manager') {
    const { count } = await supabase
      .from('cel_posts')
      .select('*', { count: 'exact', head: true })
      .eq('board_id', boardId)
      .eq('status', 'pending');
    pending_count = count || 0;
  }

  return NextResponse.json({ posts: transformed, pending_count });
}

// POST /api/boards/[boardId]/posts - Create post
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    content_type, text_content, media_url, media_storage_path,
    media_thumbnail_url, media_width, media_height, background_color,
  } = body;

  if (!content_type) {
    return NextResponse.json({ error: 'content_type is required' }, { status: 400 });
  }

  if (content_type === 'text' && !text_content?.trim()) {
    return NextResponse.json({ error: 'Text content is required for text posts' }, { status: 400 });
  }

  if (['photo', 'gif', 'video'].includes(content_type) && !media_url) {
    return NextResponse.json({ error: 'Media URL is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Verify board exists and is active
  const { data: board } = await supabase
    .from('cel_boards')
    .select('id, status')
    .eq('id', boardId)
    .single();

  if (!board || board.status !== 'active') {
    return NextResponse.json({ error: 'Board not found or archived' }, { status: 404 });
  }

  const { data: post, error } = await supabase
    .from('cel_posts')
    .insert({
      board_id: boardId,
      content_type,
      text_content: text_content?.trim() || null,
      media_url: media_url || null,
      media_storage_path: media_storage_path || null,
      media_thumbnail_url: media_thumbnail_url || null,
      media_width: media_width || null,
      media_height: media_height || null,
      background_color: background_color || null,
      author_name: session.user.name || 'Anonymous',
      author_email: session.user.email,
      author_avatar_url: session.user.image || null,
      author_user_id: session.user.id,
      source: 'web',
      status: 'approved',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post }, { status: 201 });
}
