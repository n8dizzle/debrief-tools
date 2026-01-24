import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * GET /api/gbp/media
 * List all media in the library
 */
export async function GET(request: NextRequest) {
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

  const supabase = getServerSupabase();
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const { data, error, count } = await supabase
    .from('gbp_media')
    .select(`
      *,
      uploaded_by_user:portal_users!uploaded_by(id, name, email)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Failed to fetch media:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    media: data || [],
    total: count,
    limit,
    offset,
  });
}

/**
 * POST /api/gbp/media
 * Upload a new image to the media library
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: userId, role, permissions } = session.user as {
    id: string;
    role: 'employee' | 'manager' | 'owner';
    permissions: any;
  };

  if (!hasPermission(role, permissions, 'daily_dash', 'can_manage_gbp_posts')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.type.split('/')[1];
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const storagePath = `posts/${timestamp}-${randomStr}.${ext}`;

    // Get Supabase client with service role for storage
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const storageClient = createClient(supabaseUrl, supabaseServiceKey);

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await storageClient.storage
      .from('gbp-media')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = storageClient.storage
      .from('gbp-media')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // Save to database
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('gbp_media')
      .insert({
        name: name || file.name,
        url: publicUrl,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: userId,
      })
      .select(`
        *,
        uploaded_by_user:portal_users!uploaded_by(id, name, email)
      `)
      .single();

    if (error) {
      console.error('Database insert error:', error);
      // Try to clean up the uploaded file
      await storageClient.storage.from('gbp-media').remove([storagePath]);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
