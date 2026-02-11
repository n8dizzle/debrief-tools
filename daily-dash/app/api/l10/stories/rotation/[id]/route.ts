import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// PATCH /api/l10/stories/rotation/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if ('member_name' in body) updates.member_name = body.member_name;
    if ('user_id' in body) updates.user_id = body.user_id || null;
    if ('is_active' in body) updates.is_active = body.is_active;
    if ('display_order' in body) updates.display_order = body.display_order;

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('l10_story_rotation')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating rotation member:', error);
      return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
    }

    return NextResponse.json({ member: data });
  } catch (error) {
    console.error('Error in rotation PATCH:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}

// DELETE /api/l10/stories/rotation/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const { error } = await supabase
      .from('l10_story_rotation')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting rotation member:', error);
      return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in rotation DELETE:', error);
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 });
  }
}
