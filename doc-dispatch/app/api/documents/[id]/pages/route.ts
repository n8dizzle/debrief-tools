import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  // Verify document exists and belongs to user
  const { data: doc } = await supabase
    .from('dd_documents')
    .select('id, uploaded_by')
    .eq('id', id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const pageNumber = parseInt(formData.get('page_number') as string || '1');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const imagePath = `${session.user.id}/${id}_p${pageNumber}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('doc-dispatch')
      .upload(imagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    const { error: pageError } = await supabase
      .from('dd_document_pages')
      .insert({
        document_id: id,
        image_path: imagePath,
        page_number: pageNumber,
      });

    if (pageError) {
      console.error('Page insert error:', pageError);
    }

    return NextResponse.json({ success: true, page_number: pageNumber });
  } catch (err) {
    console.error('Page upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
