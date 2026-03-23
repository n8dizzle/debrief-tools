import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

const ALLOWED_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov from iPhone
];

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Accepted: MP4, WebM, MOV` },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 100MB.` },
        { status: 400 }
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const randomStr = Math.random().toString(36).substring(2, 10);
    const storagePath = `recordings/${session.user.id}/${Date.now()}-${randomStr}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = getServerSupabase();
    const { error: uploadError } = await supabase.storage
      .from('video-studio-media')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from('video-studio-media')
      .getPublicUrl(storagePath);

    return NextResponse.json({
      url: urlData.publicUrl,
      storagePath,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (err) {
    console.error('Upload route error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
