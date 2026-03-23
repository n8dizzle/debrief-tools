import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/videos/[id]
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from('vs_videos')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Video GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/videos/[id] - Update video project
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const supabase = getServerSupabase();

    // Only allow updating certain fields
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (body.title !== undefined) updates.title = body.title;
    if (body.templateProps !== undefined) updates.template_props = body.templateProps;
    if (body.sourceVideoUrl !== undefined) updates.source_video_url = body.sourceVideoUrl;
    if (body.renderedUrl !== undefined) updates.rendered_url = body.renderedUrl;
    if (body.renderedStoragePath !== undefined) updates.rendered_storage_path = body.renderedStoragePath;
    if (body.status !== undefined) updates.status = body.status;
    if (body.durationSeconds !== undefined) updates.duration_seconds = body.durationSeconds;

    const { data, error } = await supabase
      .from('vs_videos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating video:', error);
      return NextResponse.json({ error: 'Failed to update video' }, { status: 500 });
    }

    // Log activity
    const action = body.status === 'completed' ? 'rendered' : 'edited';
    await supabase.from('vs_activity_log').insert({
      video_id: id,
      user_id: session.user.id,
      action,
      details: { fields: Object.keys(updates).filter(k => k !== 'updated_at') },
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error('Video PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/videos/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getServerSupabase();

    const { error } = await supabase
      .from('vs_videos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting video:', error);
      return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Video DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
