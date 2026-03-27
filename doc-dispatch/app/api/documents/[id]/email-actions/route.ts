import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { sendEmail, generateDocumentEmail } from '@/lib/email';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { to, cc: ccInput, actionItemIds, message, includeImage, includeAnalysis, includeChat, includeNotes } = await req.json();

  // Accept string or array of strings
  const recipients: string[] = Array.isArray(to)
    ? to.map((e: string) => e.trim()).filter(Boolean)
    : typeof to === 'string' ? [to.trim()].filter(Boolean) : [];

  const ccRecipients: string[] = Array.isArray(ccInput)
    ? ccInput.map((e: string) => e.trim()).filter(Boolean)
    : typeof ccInput === 'string' ? [ccInput.trim()].filter(Boolean) : [];

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'At least one email address is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Get document
  const { data: doc, error: docError } = await supabase
    .from('dd_documents')
    .select('id, title, document_type, summary, extracted_data, image_path, notes')
    .eq('id', id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Get selected action items (optional)
  let actionItems: { description: string; priority: string; due_date: string | null; status: string }[] = [];
  if (actionItemIds?.length) {
    const { data } = await supabase
      .from('dd_action_items')
      .select('description, priority, due_date, status')
      .eq('document_id', id)
      .in('id', actionItemIds);
    actionItems = data || [];
  }

  // Get chat messages if requested
  let chatMessages: { role: string; content: string; created_at: string }[] = [];
  if (includeChat) {
    const { data: messages } = await supabase
      .from('dd_chat_messages')
      .select('role, content, created_at')
      .eq('document_id', id)
      .order('created_at', { ascending: true });
    chatMessages = messages || [];
  }

  const senderName = session.user.name || session.user.email || 'A team member';
  const documentTitle = doc.title || 'Untitled Document';

  // Download all page images if requested
  let attachments: { filename: string; content: Buffer; content_type?: string }[] = [];

  if (includeImage) {
    // Get all pages
    const { data: pages } = await supabase
      .from('dd_document_pages')
      .select('image_path, page_number')
      .eq('document_id', id)
      .order('page_number', { ascending: true });

    const imagePaths = pages && pages.length > 0
      ? pages
      : [{ image_path: doc.image_path, page_number: 1 }];

    for (const page of imagePaths) {
      const { data: imageData, error: imageError } = await supabase.storage
        .from('doc-dispatch')
        .download(page.image_path);

      if (!imageError && imageData) {
        const ext = page.image_path.split('.').pop() || 'jpg';
        const contentType = ext === 'png' ? 'image/png'
          : ext === 'webp' ? 'image/webp'
          : ext === 'gif' ? 'image/gif'
          : 'image/jpeg';

        const cleanTitle = documentTitle.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
        const filename = imagePaths.length > 1
          ? `${cleanTitle}_Page_${page.page_number}.${ext}`
          : `${cleanTitle}.${ext}`;

        const buffer = Buffer.from(await imageData.arrayBuffer());
        attachments.push({ filename, content: buffer, content_type: contentType });
      }
    }
  }

  const attachmentNotice = attachments.length > 1
    ? `${attachments.length} document pages attached`
    : attachments.length === 1
    ? attachments[0].filename
    : '';

  const html = generateDocumentEmail({
    documentTitle,
    documentType: doc.document_type,
    summary: includeAnalysis ? doc.summary : null,
    extractedData: includeAnalysis ? (doc.extracted_data || {}) : {},
    actionItems,
    senderName,
    personalMessage: message?.trim(),
    hasAttachment: attachments.length > 0,
    attachmentNotice,
    chatMessages,
    notes: includeNotes ? (doc.notes || null) : null,
  });

  const subject = `${documentTitle} — Doc Dispatch`;

  try {
    await sendEmail(recipients, subject, html, attachments.length > 0 ? attachments : undefined, ccRecipients.length > 0 ? ccRecipients : undefined);
    return NextResponse.json({ success: true, sent: recipients.length + ccRecipients.length });
  } catch (err: any) {
    console.error('Email send error:', err);
    return NextResponse.json({ error: err.message || 'Failed to send email' }, { status: 500 });
  }
}
