import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/contribute/[slug] - Get board info (public, no auth)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = getServerSupabase();

  const { data: board, error } = await supabase
    .from('cel_boards')
    .select('id, title, description, board_type, slug, visibility, status, honoree_name, event_date, allow_anonymous')
    .eq('slug', slug)
    .eq('visibility', 'public')
    .eq('status', 'active')
    .single();

  if (!board || error) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  return NextResponse.json({ board });
}

// POST /api/contribute/[slug] - Create public contribution (no auth)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = getServerSupabase();

  // Find the board
  const { data: board } = await supabase
    .from('cel_boards')
    .select('id, visibility, status, allow_anonymous')
    .eq('slug', slug)
    .single();

  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  if (board.visibility !== 'public') {
    return NextResponse.json({ error: 'Board is not public' }, { status: 403 });
  }

  if (board.status !== 'active') {
    return NextResponse.json({ error: 'Board is archived' }, { status: 403 });
  }

  const body = await req.json();
  const { author_name, content_type, text_content, media_url, background_color } = body;

  if (!board.allow_anonymous && !author_name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  if (!text_content?.trim() && !media_url) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }

  const { data: post, error } = await supabase
    .from('cel_posts')
    .insert({
      board_id: board.id,
      content_type: content_type || 'text',
      text_content: text_content?.trim() || null,
      media_url: media_url || null,
      background_color: background_color || null,
      author_name: author_name?.trim() || 'Anonymous',
      source: 'web',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post }, { status: 201 });
}
