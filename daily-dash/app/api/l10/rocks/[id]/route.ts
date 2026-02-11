import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// PATCH /api/l10/rocks/[id]
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

    if ('title' in body) updates.title = body.title;
    if ('owner_names' in body) updates.owner_names = body.owner_names;
    if ('owner_ids' in body) updates.owner_ids = body.owner_ids;
    if ('department' in body) updates.department = body.department || null;
    if ('status' in body) updates.status = body.status;
    if ('target_quarter' in body) updates.target_quarter = body.target_quarter;
    if ('notes' in body) updates.notes = body.notes || null;

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('l10_rocks')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating rock:', error);
      return NextResponse.json({ error: 'Failed to update rock' }, { status: 500 });
    }

    return NextResponse.json({ rock: data });
  } catch (error) {
    console.error('Error in rock PATCH:', error);
    return NextResponse.json({ error: 'Failed to update rock' }, { status: 500 });
  }
}

// DELETE /api/l10/rocks/[id]
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
      .from('l10_rocks')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting rock:', error);
      return NextResponse.json({ error: 'Failed to delete rock' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in rock DELETE:', error);
    return NextResponse.json({ error: 'Failed to delete rock' }, { status: 500 });
  }
}
