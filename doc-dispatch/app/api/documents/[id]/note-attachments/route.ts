import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  const { data: attachments, error } = await supabase
    .from('dd_note_attachments')
    .select('*')
    .eq('document_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Fetch note attachments error:', error);
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 });
  }

  // Generate signed URLs
  if (attachments && attachments.length > 0) {
    const urlPromises = attachments.map(a =>
      supabase.storage.from('doc-dispatch').createSignedUrl(a.image_path, 3600)
    );
    const results = await Promise.all(urlPromises);
    results.forEach((result, i) => {
      if (result.data?.signedUrl) {
        attachments[i].image_url = result.data.signedUrl;
      }
    });
  }

  return NextResponse.json(attachments || []);
}

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

  // Verify document exists
  const { data: doc } = await supabase
    .from('dd_documents')
    .select('id')
    .eq('id', id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const imagePath = `notes/${session.user.id}/${id}_${timestamp}.${ext}`;

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

    const { data: attachment, error: insertError } = await supabase
      .from('dd_note_attachments')
      .insert({
        document_id: id,
        image_path: imagePath,
        filename: file.name,
        uploaded_by: session.user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert note attachment error:', insertError);
      // Clean up uploaded file
      await supabase.storage.from('doc-dispatch').remove([imagePath]);
      return NextResponse.json({ error: 'Failed to save attachment' }, { status: 500 });
    }

    // Return with signed URL
    const { data: signedUrlData } = await supabase.storage
      .from('doc-dispatch')
      .createSignedUrl(imagePath, 3600);

    return NextResponse.json({
      ...attachment,
      image_url: signedUrlData?.signedUrl || null,
    });
  } catch (err) {
    console.error('Note attachment upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const attachmentId = searchParams.get('attachmentId');

  if (!attachmentId) {
    return NextResponse.json({ error: 'Missing attachmentId' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Get attachment to find storage path
  const { data: attachment } = await supabase
    .from('dd_note_attachments')
    .select('*')
    .eq('id', attachmentId)
    .eq('document_id', id)
    .single();

  if (!attachment) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  }

  // Delete from storage
  await supabase.storage.from('doc-dispatch').remove([attachment.image_path]);

  // Delete from database
  const { error } = await supabase
    .from('dd_note_attachments')
    .delete()
    .eq('id', attachmentId);

  if (error) {
    console.error('Delete note attachment error:', error);
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
