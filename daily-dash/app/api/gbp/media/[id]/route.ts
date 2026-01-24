import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@supabase/supabase-js';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/gbp/media/[id]
 * Get a single media item
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role, permissions } = session.user as {
    role: 'employee' | 'manager' | 'owner';
    permissions: any;
  };

  if (!hasPermission(role, permissions, 'daily_dash', 'can_manage_gbp_posts')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('gbp_media')
    .select(`
      *,
      uploaded_by_user:portal_users!uploaded_by(id, name, email)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/gbp/media/[id]
 * Delete a media item from library and storage
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role, permissions } = session.user as {
    role: 'employee' | 'manager' | 'owner';
    permissions: any;
  };

  if (!hasPermission(role, permissions, 'daily_dash', 'can_manage_gbp_posts')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  // Get the media item first
  const { data: media, error: fetchError } = await supabase
    .from('gbp_media')
    .select('storage_path')
    .eq('id', id)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // Delete from storage if path exists
  if (media.storage_path) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const storageClient = createClient(supabaseUrl, supabaseServiceKey);

    const { error: storageError } = await storageClient.storage
      .from('gbp-media')
      .remove([media.storage_path]);

    if (storageError) {
      console.error('Failed to delete from storage:', storageError);
      // Continue with database deletion even if storage fails
    }
  }

  // Delete from database
  const { error: deleteError } = await supabase
    .from('gbp_media')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('Failed to delete media:', deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
