import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const boardId = formData.get('boardId') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!boardId) {
    return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
  }

  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    return NextResponse.json({
      error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF, MP4, WebM'
    }, { status: 400 });
  }

  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
  if (file.size > maxSize) {
    return NextResponse.json({
      error: `File too large. Max: ${isImage ? '10MB' : '50MB'}`
    }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Generate storage path
  const ext = file.name.split('.').pop() || 'bin';
  const random = Math.random().toString(36).slice(2, 10);
  const storagePath = `boards/${boardId}/${Date.now()}-${random}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('celebrations-media')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from('celebrations-media')
    .getPublicUrl(storagePath);

  return NextResponse.json({
    url: urlData.publicUrl,
    storagePath,
    contentType: file.type,
  });
}
