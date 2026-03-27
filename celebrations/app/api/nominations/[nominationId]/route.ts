import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// DELETE /api/nominations/[nominationId] - Delete a nomination
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ nominationId: string }> }
) {
  const { nominationId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  // Fetch the nomination to check ownership
  const { data: nomination, error: fetchError } = await supabase
    .from('cel_nominations')
    .select('id, nominator_user_id')
    .eq('id', nominationId)
    .single();

  if (fetchError || !nomination) {
    return NextResponse.json({ error: 'Nomination not found' }, { status: 404 });
  }

  const role = session.user.role;
  const isManager = role === 'owner' || role === 'manager';
  const isOwnerOfNom = nomination.nominator_user_id === session.user.id;

  if (!isManager && !isOwnerOfNom) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase
    .from('cel_nominations')
    .delete()
    .eq('id', nominationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
