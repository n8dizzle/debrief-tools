import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getServerSupabase } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
}

const ANALYSIS_PROMPT = `You are a document analysis assistant for Christmas Air Conditioning & Plumbing, an HVAC and plumbing company in Texas.

Analyze this document image and extract the following information. Respond with valid JSON only, no other text.

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

If you cannot determine a field, use null for that field. Always provide at least one action item.`;

// Image content types we can process
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

function extractEmailAddress(from: string): string {
  // "John Smith <john@christmasair.com>" → "john@christmasair.com"
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from.trim();
}

export async function POST(req: NextRequest) {
  try {
    // Verify webhook signature
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      const svixId = req.headers.get('svix-id') || '';
      const svixTimestamp = req.headers.get('svix-timestamp') || '';
      const svixSignature = req.headers.get('svix-signature') || '';

      const body = await req.text();

      try {
        getResend().webhooks.verify({
          payload: body,
          headers: {
            id: svixId,
            timestamp: svixTimestamp,
            signature: svixSignature,
          },
          webhookSecret,
        });
      } catch {
        console.error('Webhook signature verification failed');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      // Parse the verified body
      var event = JSON.parse(body);
    } else {
      // No webhook secret configured - parse body directly (dev mode)
      var event = await req.json();
    }

    // Only process email.received events
    if (event.type !== 'email.received') {
      return NextResponse.json({ message: 'Ignored event type' }, { status: 200 });
    }

    const { email_id, from, subject, attachments } = event.data;
    const senderEmail = extractEmailAddress(from);

    const supabase = getServerSupabase();

    // Match sender to a portal user
    const { data: user } = await supabase
      .from('portal_users')
      .select('id, name, email')
      .ilike('email', senderEmail)
      .eq('is_active', true)
      .single();

    if (!user) {
      console.log(`Inbound email from unknown sender: ${senderEmail}`);
      // Optionally reject non-staff. For now, log and skip.
      return NextResponse.json({ message: 'Unknown sender, ignored' }, { status: 200 });
    }

    // Get the full email content (for body text → notes)
    const { data: emailData } = await getResend().emails.receiving.get(email_id);
    const emailBody = emailData?.text?.trim() || null;

    // Filter to image attachments only
    const imageAttachments = (attachments || []).filter(
      (att: any) => IMAGE_TYPES.includes(att.content_type)
    );

    if (imageAttachments.length === 0) {
      console.log(`Inbound email from ${senderEmail} has no image attachments`);
      return NextResponse.json({ message: 'No image attachments found' }, { status: 200 });
    }

    const results: string[] = [];

    // Process each image attachment as a separate document
    for (const attachment of imageAttachments) {
      try {
        const docId = crypto.randomUUID();

        // Get attachment download URL
        const { data: attData, error: attError } = await getResend().emails.receiving.attachments.get({
          emailId: email_id,
          id: attachment.id,
        });

        if (attError || !attData?.download_url) {
          console.error(`Failed to get attachment ${attachment.id}:`, attError);
          continue;
        }

        // Download the image
        const imageResponse = await fetch(attData.download_url);
        const imageBuffer = await imageResponse.arrayBuffer();

        // Determine file extension
        const ext = attachment.filename?.split('.').pop()?.toLowerCase() || 'jpg';
        const imagePath = `${user.id}/${docId}.${ext}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('doc-dispatch')
          .upload(imagePath, imageBuffer, {
            contentType: attachment.content_type,
            upsert: false,
          });

        if (uploadError) {
          console.error(`Storage upload error for ${attachment.filename}:`, uploadError);
          continue;
        }

        // Build notes from email subject + body
        const notes = [
          subject ? `Email subject: ${subject}` : null,
          emailBody ? `Email body: ${emailBody}` : null,
        ].filter(Boolean).join('\n\n') || null;

        // Create document record
        const { data: doc, error: dbError } = await supabase
          .from('dd_documents')
          .insert({
            id: docId,
            uploaded_by: user.id,
            image_path: imagePath,
            status: 'new',
            priority: 'medium',
            notes,
          })
          .select()
          .single();

        if (dbError) {
          console.error(`Database insert error:`, dbError);
          await supabase.storage.from('doc-dispatch').remove([imagePath]);
          continue;
        }

        // Run AI analysis
        try {
          // Download the image as base64 for Claude
          const base64Image = Buffer.from(imageBuffer).toString('base64');
          let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg';
          if (ext === 'png') mediaType = 'image/png';
          else if (ext === 'webp') mediaType = 'image/webp';
          else if (ext === 'gif') mediaType = 'image/gif';

          const message = await getAnthropic().messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2048,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: mediaType,
                      data: base64Image,
                    },
                  },
                  {
                    type: 'text',
                    text: ANALYSIS_PROMPT,
                  },
                ],
              },
            ],
          });

          const responseText = message.content
            .filter(block => block.type === 'text')
            .map(block => (block as any).text)
            .join('');

          const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, responseText];
          const analysis = JSON.parse(jsonMatch[1]!.trim());

          // Update document with analysis
          await supabase
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
            .eq('id', docId);

          // Create action items
          if (analysis.action_items?.length > 0) {
            const actionItems = analysis.action_items.map((item: any) => ({
              document_id: docId,
              description: item.description,
              priority: item.priority || 'medium',
              due_date: item.due_date || null,
              source: 'ai',
              status: 'pending',
            }));

            await supabase.from('dd_action_items').insert(actionItems);
          }
        } catch (analysisErr: any) {
          console.error(`Analysis failed for doc ${docId}:`, analysisErr);
          await supabase
            .from('dd_documents')
            .update({
              analysis_error: analysisErr.message || 'Analysis failed',
              analysis_model: 'claude-haiku-4-5-20251001',
            })
            .eq('id', docId);
        }

        results.push(docId);
      } catch (err) {
        console.error(`Failed to process attachment ${attachment.filename}:`, err);
      }
    }

    console.log(`Inbound email from ${senderEmail}: processed ${results.length}/${imageAttachments.length} attachments`);

    return NextResponse.json({
      message: `Processed ${results.length} document(s)`,
      document_ids: results,
    }, { status: 200 });
  } catch (err) {
    console.error('Inbound webhook error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
