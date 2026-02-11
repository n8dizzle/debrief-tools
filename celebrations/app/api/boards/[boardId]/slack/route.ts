import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/boards/[boardId]/slack - List linked channels
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

  const { data: configs, error } = await supabase
    .from('cel_slack_config')
    .select('*')
    .eq('board_id', boardId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ configs: configs || [] });
}

// POST /api/boards/[boardId]/slack - Link channel
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

  const { slack_channel_id, slack_channel_name } = await req.json();

  if (!slack_channel_id) {
    return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Check if channel is already linked to another board
  const { data: existingLink } = await supabase
    .from('cel_slack_config')
    .select('id, board_id')
    .eq('slack_channel_id', slack_channel_id)
    .single();

  if (existingLink && existingLink.board_id !== boardId) {
    return NextResponse.json({ error: 'Channel is already linked to another board' }, { status: 409 });
  }

  const { data: config, error } = await supabase
    .from('cel_slack_config')
    .upsert({
      board_id: boardId,
      slack_channel_id,
      slack_channel_name: slack_channel_name || null,
      is_active: true,
    }, { onConflict: 'board_id,slack_channel_id' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config }, { status: 201 });
}

// DELETE /api/boards/[boardId]/slack - Unlink channel
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
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const configId = searchParams.get('id');

  if (!configId) {
    return NextResponse.json({ error: 'Config ID required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  const { error } = await supabase
    .from('cel_slack_config')
    .delete()
    .eq('id', configId)
    .eq('board_id', boardId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
