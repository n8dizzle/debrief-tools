import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, generateSlug } from '@/lib/supabase';

// GET /api/boards - List boards
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'active';

  const supabase = getServerSupabase();

  const { data: boards, error } = await supabase
    .from('cel_boards')
    .select('*, cel_posts(count)')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform count
  const transformed = (boards || []).map((b: any) => ({
    ...b,
    post_count: b.cel_posts?.[0]?.count ?? 0,
    cel_posts: undefined,
  }));

  return NextResponse.json({ boards: transformed });
}

// POST /api/boards - Create board
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, board_type, visibility, honoree_name, event_date, cover_image_url, allow_anonymous } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Generate unique slug
  let slug = generateSlug(title);
  const { data: existing } = await supabase
    .from('cel_boards')
    .select('id')
    .eq('slug', slug)
    .single();

  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const { data: board, error } = await supabase
    .from('cel_boards')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      board_type: board_type || 'custom',
      slug,
      visibility: visibility || 'internal',
      honoree_name: honoree_name?.trim() || null,
      event_date: event_date || null,
      cover_image_url: cover_image_url || null,
      allow_anonymous: allow_anonymous ?? false,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await supabase.from('cel_activity_log').insert({
    board_id: board.id,
    action: 'board_created',
    details: { title: board.title, board_type: board.board_type },
    performed_by: session.user.id,
  });

  return NextResponse.json({ board }, { status: 201 });
}
