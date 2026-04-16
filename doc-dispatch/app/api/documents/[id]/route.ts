import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

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
      pages:dd_document_pages(id, document_id, image_path, page_number, rotation, created_at),
      note_attachments:dd_note_attachments(id, document_id, image_path, filename, uploaded_by, created_at)
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

  // Generate signed URLs for note attachments
  const noteAttachments = doc.note_attachments || [];
  if (noteAttachments.length > 0) {
    const noteUrlPromises = noteAttachments.map((a: any) =>
      supabase.storage.from('doc-dispatch').createSignedUrl(a.image_path, 3600)
    );
    const noteResults = await Promise.all(noteUrlPromises);
    noteResults.forEach((result, i) => {
      if (result.data?.signedUrl) {
        noteAttachments[i].image_url = result.data.signedUrl;
      }
    });
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

  const supabase = getServerSupabase();

  // Handle page rotation updates
  if (body.pageRotations) {
    for (const [pageId, rotation] of Object.entries(body.pageRotations)) {
      await supabase
        .from('dd_document_pages')
        .update({ rotation: rotation as number })
        .eq('id', pageId)
        .eq('document_id', id);
    }
    if (Object.keys(body).length === 1) {
      return NextResponse.json({ success: true });
    }
  }

  // Only allow updating specific fields
  const allowedFields = ['status', 'priority', 'notes', 'title', 'assigned_to', 'rotation'];
  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Get current doc before update (for owner change detection)
  let previousAssignedTo: string | null = null;
  if (updates.assigned_to !== undefined) {
    const { data: current } = await supabase
      .from('dd_documents')
      .select('assigned_to, title')
      .eq('id', id)
      .single();
    previousAssignedTo = current?.assigned_to || null;
  }

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

  // Send notification to new owner if requested
  if (body.notify_owner && updates.assigned_to && updates.assigned_to !== previousAssignedTo) {
    const { data: newOwner } = await supabase
      .from('portal_users')
      .select('name, email')
      .eq('id', updates.assigned_to)
      .single();

    if (newOwner?.email) {
      const assignerName = session.user.name || session.user.email || 'Someone';
      const docTitle = data.title || 'Untitled Document';

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #1C231E; border-radius: 12px 12px 0 0; padding: 24px;">
          <tr>
            <td>
              <h1 style="margin: 0; font-size: 18px; color: #F5F0E1;">Christmas Air</h1>
              <p style="margin: 4px 0 0; font-size: 13px; color: #6B9B75;">Doc Dispatch — Document Assigned to You</p>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; padding: 24px; border-radius: 0 0 12px 12px;">
          <tr>
            <td>
              <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
                <strong>${assignerName}</strong> assigned you a document: <strong>${docTitle}</strong>
              </p>
              <a href="https://docs.christmasair.com/documents/${id}" style="display: inline-block; padding: 10px 20px; background: #5D8A66; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
                View Document
              </a>
              <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">
                You're receiving this because a document was assigned to you in Doc Dispatch.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      sendEmail(newOwner.email, `Document Assigned: ${docTitle}`, html).catch(err => {
        console.error('Owner notification email error:', err);
      });
    }
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

  const { data: noteAttachments } = await supabase
    .from('dd_note_attachments')
    .select('image_path')
    .eq('document_id', id);

  // Delete related rows (chat messages, action items, note attachments, pages)
  await supabase.from('dd_chat_messages').delete().eq('document_id', id);
  await supabase.from('dd_action_items').delete().eq('document_id', id);
  await supabase.from('dd_note_attachments').delete().eq('document_id', id);
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
    ...(noteAttachments || []).map(a => a.image_path),
  ].filter(Boolean);

  if (storagePaths.length > 0) {
    await supabase.storage.from('doc-dispatch').remove(storagePaths);
  }

  return NextResponse.json({ success: true });
}
