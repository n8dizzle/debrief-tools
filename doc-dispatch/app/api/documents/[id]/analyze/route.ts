import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { uploadToGoogleDrive } from '@/lib/google-drive';
import { sendUploadNotification } from '@/lib/notifications';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const ANALYSIS_PROMPT = `You are a document analysis assistant for Christmas Air Conditioning & Plumbing, an HVAC and plumbing company in Texas.

Analyze this document image and extract the following information. Respond with valid JSON only, no other text.

If this is a multi-page document, analyze ALL pages together as a single document. The pages are provided in order.

{
  "document_type": "invoice | permit | contract | lien_waiver | warranty | estimate | purchase_order | work_order | insurance | inspection | letter | receipt | other",
  "title": "Brief descriptive title for this document",
  "summary": "2-3 sentence summary of what this document is about and its key details",
  "priority": "high | medium | low",
  "extracted_data": {
    "vendor_or_from": "Company/person the document is from, if identifiable",
    "customer_or_to": "Company/person the document is addressed to, if identifiable",
    "date": "Document date in YYYY-MM-DD format, if visible",
    "due_date": "Due date in YYYY-MM-DD format, if applicable",
    "amount": "Dollar amount if applicable (as number, no $ sign)",
    "reference_number": "Invoice #, permit #, contract #, PO #, etc.",
    "address": "Property or job site address, if visible",
    "key_terms": "Any notable terms, conditions, or deadlines mentioned",
    "notes": "Any other relevant details not captured above"
  },
  "action_items": [
    {
      "description": "Specific action that needs to be taken",
      "priority": "high | medium | low",
      "due_date": "YYYY-MM-DD if a deadline is apparent, otherwise null"
    }
  ]
}

Priority guidelines:
- HIGH: Past due invoices, expiring permits/warranties, documents requiring immediate signature, urgent deadlines within 7 days
- MEDIUM: Standard invoices, contracts needing review, permits with upcoming deadlines
- LOW: Informational documents, warranties with distant expiry, general correspondence

For action_items, suggest practical next steps like:
- "Pay invoice #XXX - $X,XXX due by [date]"
- "File permit with city of [location]"
- "Review and sign contract by [date]"
- "Schedule warranty registration"
- "Forward to [department] for processing"
- "File for records"

Always provide at least one action item. Do NOT pad the list — if only one action is genuinely needed, return only one. Only include additional actions when the document actually calls for them.

If you cannot determine a field, use null for that field.`;

function getMediaType(path: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export const maxDuration = 60;

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

  try {
    // Get all pages for this document
    const { data: pages } = await supabase
      .from('dd_document_pages')
      .select('image_path, page_number')
      .eq('document_id', id)
      .order('page_number', { ascending: true });

    // Fall back to single image_path if no pages found
    const imagePaths = pages && pages.length > 0
      ? pages.map(p => p.image_path)
      : [doc.image_path];

    // Download all images and encode as base64
    const imageBlocks: Anthropic.ImageBlockParam[] = [];
    let firstImageBuffer: ArrayBuffer | null = null;
    for (const path of imagePaths) {
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('doc-dispatch')
        .createSignedUrl(path, 300);

      if (urlError || !signedUrlData?.signedUrl) {
        console.error('Signed URL error for page:', urlError);
        continue;
      }

      const imageResponse = await fetch(signedUrlData.signedUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      if (!firstImageBuffer) firstImageBuffer = imageBuffer;
      const base64Image = Buffer.from(imageBuffer).toString('base64');

      imageBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: getMediaType(path),
          data: base64Image,
        },
      });
    }

    if (imageBlocks.length === 0) {
      return NextResponse.json({ error: 'Failed to access document images' }, { status: 500 });
    }

    // Build content: all images + prompt
    const content: Anthropic.ContentBlockParam[] = [
      ...imageBlocks,
      { type: 'text', text: ANALYSIS_PROMPT },
    ];

    // Call Claude Haiku 4.5
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    });

    // Parse the response
    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('');

    let analysis;
    try {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, responseText];
      analysis = JSON.parse(jsonMatch[1]!.trim());
    } catch (parseErr) {
      console.error('Failed to parse Claude response:', responseText);
      await supabase
        .from('dd_documents')
        .update({
          analysis_error: 'Failed to parse AI response',
          analysis_model: 'claude-haiku-4-5-20251001',
        })
        .eq('id', id);
      return NextResponse.json({ error: 'Failed to parse analysis' }, { status: 500 });
    }

    // Update the document with analysis results
    const { error: updateError } = await supabase
      .from('dd_documents')
      .update({
        document_type: analysis.document_type || null,
        title: analysis.title || null,
        summary: analysis.summary || null,
        extracted_data: analysis.extracted_data || {},
        priority: analysis.priority || 'medium',
        analyzed_at: new Date().toISOString(),
        analysis_model: 'claude-haiku-4-5-20251001',
        analysis_error: null,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 });
    }

    // Create action items from AI suggestions
    if (analysis.action_items?.length > 0) {
      const actionItems = analysis.action_items.map((item: any) => ({
        document_id: id,
        description: item.description,
        priority: item.priority || 'medium',
        due_date: item.due_date || null,
        source: 'ai',
        status: 'pending',
      }));

      const { error: actionsError } = await supabase
        .from('dd_action_items')
        .insert(actionItems);

      if (actionsError) {
        console.error('Action items insert error:', actionsError);
      }
    }

    // Auto-upload to Google Drive (non-blocking)
    if (firstImageBuffer && !doc.drive_file_id) {
      uploadToGoogleDrive({
        documentId: id,
        imageBuffer: firstImageBuffer,
        imagePath: imagePaths[0],
        documentType: analysis.document_type || null,
        title: analysis.title || null,
      }).catch(err => {
        console.error('Auto Drive upload failed:', err.message);
      });
    }

    // Send upload notification with document title (non-blocking)
    sendUploadNotification({
      documentId: id,
      documentTitle: analysis.title || '',
      uploaderName: session.user.name || '',
      uploaderEmail: session.user.email || '',
      pageCount: imagePaths.length,
      source: doc.source || 'web',
    }).catch(err => {
      console.error('Upload notification failed:', err.message);
    });

    // Return the updated document
    const { data: updatedDoc } = await supabase
      .from('dd_documents')
      .select(`
        *,
        uploader:portal_users!dd_documents_uploaded_by_fkey(name, email),
        action_items:dd_action_items(*)
      `)
      .eq('id', id)
      .single();

    return NextResponse.json(updatedDoc);
  } catch (err: any) {
    console.error('Analysis error:', err);

    await supabase
      .from('dd_documents')
      .update({
        analysis_error: err.message || 'Unknown error',
        analysis_model: 'claude-haiku-4-5-20251001',
      })
      .eq('id', id);

    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
