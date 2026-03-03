import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { uploadToGoogleDrive } from '@/lib/google-drive';

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

  // Get the document
  const { data: doc, error: docError } = await supabase
    .from('dd_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (doc.drive_file_id) {
    return NextResponse.json({ error: 'Already uploaded to Google Drive', drive_file_id: doc.drive_file_id }, { status: 409 });
  }

  // Get the primary image path (first page or single image)
  const { data: pages } = await supabase
    .from('dd_document_pages')
    .select('image_path, page_number')
    .eq('document_id', id)
    .order('page_number', { ascending: true });

  const imagePath = pages && pages.length > 0 ? pages[0].image_path : doc.image_path;

  // Download the image from storage
  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from('doc-dispatch')
    .createSignedUrl(imagePath, 300);

  if (urlError || !signedUrlData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to access document image' }, { status: 500 });
  }

  const imageResponse = await fetch(signedUrlData.signedUrl);
  const imageBuffer = await imageResponse.arrayBuffer();

  try {
    const driveFileId = await uploadToGoogleDrive({
      documentId: id,
      imageBuffer,
      imagePath,
      documentType: doc.document_type || null,
      title: doc.title || null,
    });

    return NextResponse.json({ drive_file_id: driveFileId });
  } catch (err: any) {
    console.error('Drive upload error:', err);
    // Surface detailed Google API errors
    const detail = err?.response?.data?.error?.message || err?.errors?.[0]?.message || err.message || 'Google Drive upload failed';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
