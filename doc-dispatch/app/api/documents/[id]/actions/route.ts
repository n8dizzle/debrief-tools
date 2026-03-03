import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  if (!body.description?.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Verify document exists
  const { data: doc } = await supabase
    .from('dd_documents')
    .select('id')
    .eq('id', id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('dd_action_items')
    .insert({
      document_id: id,
      description: body.description.trim(),
      priority: body.priority || 'medium',
      due_date: body.due_date || null,
      source: 'manual',
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Insert error:', error);
    return NextResponse.json({ error: 'Failed to create action item' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
