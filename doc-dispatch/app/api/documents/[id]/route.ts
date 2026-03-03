import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

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

  const { data: doc, error } = await supabase
    .from('dd_documents')
    .select(`
      *,
      uploader:portal_users!dd_documents_uploaded_by_fkey(name, email),
      owner:portal_users!dd_documents_assigned_to_fkey(id, name, email),
      action_items:dd_action_items(
        *,
        assignee:portal_users!dd_action_items_assignee_id_fkey(id, name, email)
      ),
      pages:dd_document_pages(id, document_id, image_path, page_number, created_at)
    `)
    .eq('id', id)
    .single();

  if (error || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Sort pages by page_number
  if (doc.pages) {
    doc.pages.sort((a: any, b: any) => a.page_number - b.page_number);
  }

  // Generate signed URLs for all pages in parallel
  const pages = doc.pages || [];
  if (pages.length > 0) {
    const signedUrlPromises = pages.map((page: any) =>
      supabase.storage.from('doc-dispatch').createSignedUrl(page.image_path, 3600)
    );
    const results = await Promise.all(signedUrlPromises);
    results.forEach((result, i) => {
      if (result.data?.signedUrl) {
        pages[i].image_url = result.data.signedUrl;
      }
    });

    // Set root image_url to page 1 for backward compat
    if (pages[0]?.image_url) {
      doc.image_url = pages[0].image_url;
    }
  } else {
    // Fallback for docs without pages rows (shouldn't happen after migration)
    const { data: signedUrlData } = await supabase.storage
      .from('doc-dispatch')
      .createSignedUrl(doc.image_path, 3600);

    if (signedUrlData?.signedUrl) {
      doc.image_url = signedUrlData.signedUrl;
    }
  }

  return NextResponse.json(doc);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  // Only allow updating specific fields
  const allowedFields = ['status', 'priority', 'notes', 'title', 'assigned_to'];
  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('dd_documents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Update error:', error);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }

  return NextResponse.json(data);
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
  const supabase = getServerSupabase();

  // Get document and pages to find storage paths
  const { data: doc } = await supabase
    .from('dd_documents')
    .select('image_path')
    .eq('id', id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const { data: pages } = await supabase
    .from('dd_document_pages')
    .select('image_path')
    .eq('document_id', id);

  // Delete related rows (chat messages, action items, pages)
  await supabase.from('dd_chat_messages').delete().eq('document_id', id);
  await supabase.from('dd_action_items').delete().eq('document_id', id);
  await supabase.from('dd_document_pages').delete().eq('document_id', id);

  // Delete the document
  const { error } = await supabase.from('dd_documents').delete().eq('id', id);

  if (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }

  // Clean up storage files
  const storagePaths = [
    doc.image_path,
    ...(pages || []).map(p => p.image_path),
  ].filter(Boolean);

  if (storagePaths.length > 0) {
    await supabase.storage.from('doc-dispatch').remove(storagePaths);
  }

  return NextResponse.json({ success: true });
}
