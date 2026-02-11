import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// POST /api/contribute/[slug]/upload - Public file upload (no auth)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = getServerSupabase();

  // Verify board is public and active
  const { data: board } = await supabase
    .from('cel_boards')
    .select('id, visibility, status')
    .eq('slug', slug)
    .eq('visibility', 'public')
    .eq('status', 'active')
    .single();

  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || 'bin';
  const random = Math.random().toString(36).slice(2, 10);
  const storagePath = `boards/${board.id}/${Date.now()}-${random}.${ext}`;

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

  return NextResponse.json({ url: urlData.publicUrl, storagePath });
}
