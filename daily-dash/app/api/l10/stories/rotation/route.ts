import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/l10/stories/rotation
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const { data: members, error } = await supabase
      .from('l10_story_rotation')
      .select('*')
      .order('display_order');

    if (error) {
      console.error('Error fetching rotation:', error);
      return NextResponse.json({ error: 'Failed to fetch rotation' }, { status: 500 });
    }

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Error in rotation GET:', error);
    return NextResponse.json({ error: 'Failed to fetch rotation' }, { status: 500 });
  }
}

// POST /api/l10/stories/rotation - Add a new rotation member
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { member_name, user_id } = body;

    if (!member_name) {
      return NextResponse.json({ error: 'member_name is required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Get max display_order
    const { data: maxOrder } = await supabase
      .from('l10_story_rotation')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrder?.display_order || 0) + 1;

    const { data, error } = await supabase
      .from('l10_story_rotation')
      .insert({
        member_name,
        user_id: user_id || null,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding rotation member:', error);
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
    }

    return NextResponse.json({ member: data });
  } catch (error) {
    console.error('Error in rotation POST:', error);
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }
}

// PUT /api/l10/stories/rotation - Reorder rotation members
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { order } = body; // Array of { id, display_order }

    if (!Array.isArray(order)) {
      return NextResponse.json({ error: 'order array is required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    for (const item of order) {
      const { error } = await supabase
        .from('l10_story_rotation')
        .update({ display_order: item.display_order, updated_at: new Date().toISOString() })
        .eq('id', item.id);

      if (error) {
        console.error('Error reordering:', error);
        return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in rotation PUT:', error);
    return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 });
  }
}
