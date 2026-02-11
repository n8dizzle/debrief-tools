import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// PATCH /api/l10/todos/[id]
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
    if ('owner_name' in body) updates.owner_name = body.owner_name;
    if ('owner_id' in body) updates.owner_id = body.owner_id || null;
    if ('due_date' in body) updates.due_date = body.due_date || null;
    if ('notes' in body) updates.notes = body.notes || null;
    if ('is_done' in body) {
      updates.is_done = body.is_done;
      updates.done_at = body.is_done ? new Date().toISOString() : null;
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('l10_todos')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating todo:', error);
      return NextResponse.json({ error: 'Failed to update todo' }, { status: 500 });
    }

    return NextResponse.json({ todo: data });
  } catch (error) {
    console.error('Error in todo PATCH:', error);
    return NextResponse.json({ error: 'Failed to update todo' }, { status: 500 });
  }
}

// DELETE /api/l10/todos/[id]
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
      .from('l10_todos')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting todo:', error);
      return NextResponse.json({ error: 'Failed to delete todo' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in todo DELETE:', error);
    return NextResponse.json({ error: 'Failed to delete todo' }, { status: 500 });
  }
}
