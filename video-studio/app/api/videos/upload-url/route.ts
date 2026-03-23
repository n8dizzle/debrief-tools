import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// Returns a signed upload URL so the client can upload directly to Supabase Storage
// This bypasses Vercel's 4.5MB body size limit
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileName, contentType } = await req.json();

    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'fileName and contentType required' }, { status: 400 });
    }

    const ext = fileName.split('.').pop()?.toLowerCase() || 'mp4';
    const randomStr = Math.random().toString(36).substring(2, 10);
    const storagePath = `recordings/${session.user.id}/${Date.now()}-${randomStr}.${ext}`;

    const supabase = getServerSupabase();

    const { data, error } = await supabase.storage
      .from('video-studio-media')
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error('Signed URL error:', error);
      return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
    }

    // Also get the public URL for after upload
    const { data: publicUrlData } = supabase.storage
      .from('video-studio-media')
      .getPublicUrl(storagePath);

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
      publicUrl: publicUrlData.publicUrl,
    });
  } catch (err) {
    console.error('Upload URL error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
