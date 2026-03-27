import { createServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const getSupabaseServerClient = createServerClient;

type SupabaseClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;

async function getContractorId(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .single();

  return contractor?.id || null;
}

interface ParsedItem {
  part_number: string;
  description: string;
  category: string;
  cost: number;
  unit: string;
}

// POST /api/pricebook/lists/[id]/parse - Trigger AI parsing of the uploaded PDF
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);
    const { id } = await params;

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    // Verify the supplier list exists, belongs to this contractor, and has a file
    const { data: list, error: listError } = await supabase
      .from('pricebook_supplier_lists')
      .select('id, contractor_id, file_url, file_name, parse_status')
      .eq('id', id)
      .eq('contractor_id', contractorId)
      .single();

    if (listError) {
      if (listError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Supplier list not found' }, { status: 404 });
      }
      console.error('POST /api/pricebook/lists/[id]/parse find error:', listError);
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    if (!list.file_url || !list.file_name) {
      return NextResponse.json({ error: 'No file uploaded for this supplier list. Upload a PDF first.' }, { status: 400 });
    }

    if (list.parse_status === 'processing') {
      return NextResponse.json({ error: 'This list is already being processed' }, { status: 409 });
    }

    // Set status to processing
    await supabase
      .from('pricebook_supplier_lists')
      .update({ parse_status: 'processing', error_message: null })
      .eq('id', id)
      .eq('contractor_id', contractorId);

    try {
      // Download the PDF from Supabase Storage
      const storagePath = `${contractorId}/${id}/${list.file_name}`;
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('pricebook-uploads')
        .download(storagePath);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download PDF: ${downloadError?.message || 'No data returned'}`);
      }

      // Convert to base64
      const arrayBuffer = await fileData.arrayBuffer();
      const base64PdfData = Buffer.from(arrayBuffer).toString('base64');

      // Call Claude API to parse the PDF
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY || '',
      });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64PdfData,
              },
            },
            {
              type: 'text',
              text: `Parse this supplier price list PDF and extract all items. Return a JSON array of items with these fields:
- part_number: string (the supplier's part/model number)
- description: string (item description)
- category: string (item category, e.g., "Equipment", "Parts", "Supplies")
- cost: number (supplier cost in dollars, e.g., 1234.56)
- unit: string (unit of measure, default "each")

Return ONLY the JSON array, no other text. Example:
[{"part_number": "24ACC636A003", "description": "Carrier 3-Ton 16 SEER2 AC Condenser", "category": "Equipment", "cost": 2145.00, "unit": "each"}]`,
            },
          ],
        }],
      });

      // Extract text response from Claude
      const textBlock = response.content.find(block => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text response from Claude');
      }

      const responseText = textBlock.text.trim();

      // Parse the JSON response - handle potential markdown code blocks
      let jsonText = responseText;
      if (jsonText.startsWith('```')) {
        // Remove markdown code block wrapper
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      let parsedItems: ParsedItem[];
      try {
        parsedItems = JSON.parse(jsonText);
      } catch (parseErr) {
        throw new Error(`Failed to parse Claude response as JSON: ${parseErr instanceof Error ? parseErr.message : 'Unknown parse error'}`);
      }

      if (!Array.isArray(parsedItems)) {
        throw new Error('Claude response is not a JSON array');
      }

      // Delete any existing items for this list (in case of re-parse)
      await supabase
        .from('pricebook_items')
        .delete()
        .eq('supplier_list_id', id)
        .eq('contractor_id', contractorId);

      // Insert parsed items into pricebook_items
      const itemsToInsert = parsedItems.map(item => ({
        supplier_list_id: id,
        contractor_id: contractorId,
        part_number: item.part_number || null,
        description: item.description || 'Unknown item',
        category: item.category || null,
        supplier_cost: typeof item.cost === 'number' ? Math.round(item.cost * 100) : null, // Convert dollars to cents
        unit: item.unit || 'each',
        mapping_status: 'unmapped',
      }));

      const { data: insertedItems, error: insertError } = await supabase
        .from('pricebook_items')
        .insert(itemsToInsert)
        .select();

      if (insertError) {
        throw new Error(`Failed to insert parsed items: ${insertError.message}`);
      }

      // Update supplier list with success status
      const { data: updatedList, error: updateError } = await supabase
        .from('pricebook_supplier_lists')
        .update({
          parse_status: 'completed',
          item_count: insertedItems.length,
          parsed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('contractor_id', contractorId)
        .select()
        .single();

      if (updateError) {
        console.error('POST /api/pricebook/lists/[id]/parse update error:', updateError);
      }

      return NextResponse.json({
        list: updatedList,
        items: insertedItems,
        item_count: insertedItems.length,
      });
    } catch (parseError) {
      // Set status to failed with error message
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
      console.error('POST /api/pricebook/lists/[id]/parse processing error:', errorMessage);

      await supabase
        .from('pricebook_supplier_lists')
        .update({
          parse_status: 'failed',
          error_message: errorMessage,
        })
        .eq('id', id)
        .eq('contractor_id', contractorId);

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (err) {
    console.error('POST /api/pricebook/lists/[id]/parse error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
