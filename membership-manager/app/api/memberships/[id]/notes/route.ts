import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { content } = body;

  if (!content || !content.trim()) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Verify membership exists
  const { data: membership } = await supabase
    .from('mm_memberships')
    .select('id')
    .eq('id', id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
  }

  const { data: note, error } = await supabase
    .from('mm_staff_notes')
    .insert({
      membership_id: id,
      author_id: session.user.id,
      author_name: session.user.name || session.user.email || 'Unknown',
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(note);
}
