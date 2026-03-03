import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

function getMediaType(path: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

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

  const { data: messages, error } = await supabase
    .from('dd_chat_messages')
    .select('*')
    .eq('document_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }

  return NextResponse.json(messages || []);
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
  const { message } = await req.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Get the document for context
  const { data: doc, error: docError } = await supabase
    .from('dd_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Get prior chat messages
  const { data: priorMessages } = await supabase
    .from('dd_chat_messages')
    .select('role, content')
    .eq('document_id', id)
    .order('created_at', { ascending: true });

  // Get all pages for this document
  const { data: pages } = await supabase
    .from('dd_document_pages')
    .select('image_path, page_number')
    .eq('document_id', id)
    .order('page_number', { ascending: true });

  const imagePaths = pages && pages.length > 0
    ? pages.map(p => p.image_path)
    : [doc.image_path];

  // Download all document images as base64
  const imageBlocks: Anthropic.ImageBlockParam[] = [];
  try {
    for (const path of imagePaths) {
      const { data: signedUrlData } = await supabase.storage
        .from('doc-dispatch')
        .createSignedUrl(path, 300);

      if (signedUrlData?.signedUrl) {
        const imageResponse = await fetch(signedUrlData.signedUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
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
    }
  } catch (err) {
    console.error('Failed to load document images for chat:', err);
  }

  const pageContext = imagePaths.length > 1
    ? `\n\nThis is a ${imagePaths.length}-page document. All pages are included as images.`
    : '';

  // Build system prompt with document context
  const systemPrompt = `You are a helpful assistant for Christmas Air Conditioning & Plumbing. You're answering questions about a scanned document.

Document type: ${doc.document_type || 'Unknown'}
Title: ${doc.title || 'Untitled'}
Summary: ${doc.summary || 'No summary available'}
Extracted data: ${JSON.stringify(doc.extracted_data || {}, null, 2)}${pageContext}

The user can see the document image. Answer questions about the document concisely and accurately. If you can see details in the image that aren't in the extracted data, mention them.

You have access to web search. Use it when the user asks about something that requires external information — for example, looking up a company's phone number, verifying an address, finding current tax rates, checking permit requirements, or researching a vendor. Do NOT search for things already visible in the document.`;

  // Build conversation messages
  const conversationMessages: Anthropic.MessageParam[] = [];

  // First message includes the images
  if (imageBlocks.length > 0 && (!priorMessages || priorMessages.length === 0)) {
    // No prior messages - include images with the user's message
    conversationMessages.push({
      role: 'user',
      content: [...imageBlocks, { type: 'text', text: message.trim() }],
    });
  } else {
    // Has prior messages - include images in first user message, then history
    const firstUserContent: Anthropic.ContentBlockParam[] = [...imageBlocks];

    // Add prior messages as conversation history
    if (priorMessages && priorMessages.length > 0) {
      firstUserContent.push({ type: 'text', text: priorMessages[0].content });
      conversationMessages.push({ role: 'user', content: firstUserContent });

      for (let i = 1; i < priorMessages.length; i++) {
        conversationMessages.push({
          role: priorMessages[i].role as 'user' | 'assistant',
          content: priorMessages[i].content,
        });
      }
    }

    // Add the new user message
    conversationMessages.push({ role: 'user', content: message.trim() });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversationMessages,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 3,
      }],
    });

    // Extract text and citations from response
    const textParts: string[] = [];
    const sources: { url: string; title: string }[] = [];
    const seenUrls = new Set<string>();

    for (const block of response.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
        const citations = (block as any).citations;
        if (Array.isArray(citations)) {
          for (const cite of citations) {
            if (cite.url && !seenUrls.has(cite.url)) {
              seenUrls.add(cite.url);
              sources.push({ url: cite.url, title: cite.title || cite.url });
            }
          }
        }
      }
    }

    let assistantContent = textParts.join('');

    if (sources.length > 0) {
      assistantContent += '\n\nSources:';
      for (const src of sources) {
        assistantContent += `\n- ${src.title}: ${src.url}`;
      }
    }

    // Save both messages to database
    const { error: insertError } = await supabase
      .from('dd_chat_messages')
      .insert([
        {
          document_id: id,
          role: 'user',
          content: message.trim(),
          user_id: session.user.id,
        },
        {
          document_id: id,
          role: 'assistant',
          content: assistantContent,
          user_id: null,
        },
      ]);

    if (insertError) {
      console.error('Failed to save chat messages:', insertError);
    }

    return NextResponse.json({ content: assistantContent });
  } catch (err: any) {
    console.error('Chat error:', err);
    return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 });
  }
}
