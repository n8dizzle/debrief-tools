import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('pr_workflow_steps')
    .select('*')
    .order('step_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { step_text } = await request.json();
  if (!step_text?.trim()) {
    return NextResponse.json({ error: 'Step text is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Get max order
  const { data: maxRow } = await supabase
    .from('pr_workflow_steps')
    .select('step_order')
    .order('step_order', { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (maxRow?.step_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('pr_workflow_steps')
    .insert({ step_text: step_text.trim(), step_order: nextOrder })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, step_text, is_completed, improvement_note, reorder } = body;

  const supabase = getServerSupabase();

  // Bulk reorder
  if (reorder && Array.isArray(reorder)) {
    for (let i = 0; i < reorder.length; i++) {
      await supabase
        .from('pr_workflow_steps')
        .update({ step_order: i, updated_at: new Date().toISOString() })
        .eq('id', reorder[i]);
    }
    return NextResponse.json({ success: true });
  }

  // Single update
  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (step_text !== undefined) updates.step_text = step_text.trim();
  if (is_completed !== undefined) updates.is_completed = is_completed;
  if (improvement_note !== undefined) updates.improvement_note = improvement_note?.trim() || null;

  const { data, error } = await supabase
    .from('pr_workflow_steps')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { error } = await supabase
    .from('pr_workflow_steps')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
