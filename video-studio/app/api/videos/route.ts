import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/videos - List user's videos
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const user = session.user as any;
    const isOwner = user.role === 'owner';
    const canViewAll = isOwner || user.permissions?.video_studio?.can_view_all_videos;

    let query = supabase
      .from('vs_videos')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!canViewAll) {
      query = query.eq('creator_id', session.user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching videos:', error);
      return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Videos GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/videos - Create a new video project
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, template, templateProps, videoSource, sourceVideoUrl, durationSeconds } = body;

    if (!title || !template) {
      return NextResponse.json({ error: 'Title and template are required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from('vs_videos')
      .insert({
        creator_id: session.user.id,
        creator_name: session.user.name,
        title,
        template,
        template_props: templateProps || {},
        video_source: videoSource || 'text',
        source_video_url: sourceVideoUrl || null,
        duration_seconds: durationSeconds || null,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating video:', error);
      return NextResponse.json({ error: 'Failed to create video' }, { status: 500 });
    }

    // Log activity
    await supabase.from('vs_activity_log').insert({
      video_id: data.id,
      user_id: session.user.id,
      action: 'created',
      details: { template, videoSource },
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error('Videos POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
