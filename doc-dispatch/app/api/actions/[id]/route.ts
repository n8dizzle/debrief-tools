import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const allowedFields = ['status', 'priority', 'description', 'due_date', 'assignee_id'];
  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  // Auto-set completed_at/completed_by when marking done
  if (updates.status === 'done' || updates.status === 'dismissed') {
    updates.completed_at = new Date().toISOString();
    updates.completed_by = session.user.id;
  } else if (updates.status === 'pending' || updates.status === 'in_progress') {
    updates.completed_at = null;
    updates.completed_by = null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('dd_action_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Update error:', error);
    return NextResponse.json({ error: 'Failed to update action item' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  const { error } = await supabase
    .from('dd_action_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete action item' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
