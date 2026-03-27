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

interface CatalogService {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
  category: string | null;
}

interface UnmappedItem {
  id: string;
  part_number: string | null;
  description: string;
  category: string | null;
}

interface MappingSuggestion {
  item_id: string;
  service_id: string;
  confidence: number;
}

const BATCH_SIZE = 20;

// POST /api/pricebook/lists/[id]/map - Trigger AI-assisted catalog mapping
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

    // Verify the supplier list exists and belongs to this contractor
    const { data: list, error: listError } = await supabase
      .from('pricebook_supplier_lists')
      .select('id, contractor_id, parse_status')
      .eq('id', id)
      .eq('contractor_id', contractorId)
      .single();

    if (listError) {
      if (listError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Supplier list not found' }, { status: 404 });
      }
      console.error('POST /api/pricebook/lists/[id]/map find error:', listError);
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    if (list.parse_status !== 'completed') {
      return NextResponse.json({
        error: 'Supplier list must be fully parsed before mapping. Current status: ' + list.parse_status,
      }, { status: 400 });
    }

    // Fetch all catalog services
    const { data: catalogRaw, error: catalogError } = await supabase
      .from('catalog_services')
      .select(`
        id,
        name,
        description,
        catalog_categories (
          name,
          catalog_departments (name)
        )
      `)
      .eq('is_active', true);

    if (catalogError) {
      console.error('POST /api/pricebook/lists/[id]/map catalog error:', catalogError);
      return NextResponse.json({ error: catalogError.message }, { status: 500 });
    }

    // Flatten catalog services for the prompt
    const catalogServices: CatalogService[] = (catalogRaw || []).map(svc => {
      const cat = svc.catalog_categories as unknown as { name: string; catalog_departments: { name: string } } | null;
      return {
        id: svc.id,
        name: svc.name,
        description: svc.description,
        department: cat?.catalog_departments?.name || null,
        category: cat?.name || null,
      };
    });

    if (catalogServices.length === 0) {
      return NextResponse.json({ error: 'No catalog services available for mapping' }, { status: 400 });
    }

    // Fetch unmapped items in this list
    const { data: unmappedItems, error: itemsError } = await supabase
      .from('pricebook_items')
      .select('id, part_number, description, category')
      .eq('supplier_list_id', id)
      .eq('contractor_id', contractorId)
      .eq('mapping_status', 'unmapped');

    if (itemsError) {
      console.error('POST /api/pricebook/lists/[id]/map items error:', itemsError);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    if (!unmappedItems || unmappedItems.length === 0) {
      return NextResponse.json({
        message: 'No unmapped items to process',
        mapped_count: 0,
        skipped_count: 0,
      });
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });

    // Build a compact catalog reference for the prompt
    const catalogRef = catalogServices.map(s =>
      `${s.id} | ${s.name} | ${s.department || ''} > ${s.category || ''} | ${s.description || ''}`
    ).join('\n');

    let totalMapped = 0;
    let totalSkipped = 0;

    // Process in batches
    for (let i = 0; i < unmappedItems.length; i += BATCH_SIZE) {
      const batch: UnmappedItem[] = unmappedItems.slice(i, i + BATCH_SIZE);

      const itemsList = batch.map(item =>
        `${item.id} | ${item.part_number || 'N/A'} | ${item.description} | ${item.category || 'N/A'}`
      ).join('\n');

      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: `You are mapping supplier price list items to a master catalog of home services.

CATALOG SERVICES (id | name | department > category | description):
${catalogRef}

SUPPLIER ITEMS TO MAP (id | part_number | description | category):
${itemsList}

For each supplier item, find the most relevant catalog service. Return a JSON array of mappings:
[{"item_id": "uuid", "service_id": "uuid", "confidence": 0.85}]

Rules:
- confidence should be 0.0 to 1.0 (1.0 = perfect match, 0.5 = reasonable guess, below 0.3 = poor match)
- If no good match exists, still include the item but with confidence below 0.3
- Match based on the type of work/service the item relates to (e.g., an AC condenser maps to an HVAC installation service)
- Return ONLY the JSON array, no other text.`,
          }],
        });

        const textBlock = response.content.find(block => block.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          console.error('POST /api/pricebook/lists/[id]/map: No text response for batch', i);
          totalSkipped += batch.length;
          continue;
        }

        let jsonText = textBlock.text.trim();
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }

        let suggestions: MappingSuggestion[];
        try {
          suggestions = JSON.parse(jsonText);
        } catch {
          console.error('POST /api/pricebook/lists/[id]/map: Failed to parse batch response', i);
          totalSkipped += batch.length;
          continue;
        }

        if (!Array.isArray(suggestions)) {
          totalSkipped += batch.length;
          continue;
        }

        // Apply mappings
        for (const suggestion of suggestions) {
          // Validate that the service_id exists in our catalog
          const validService = catalogServices.find(s => s.id === suggestion.service_id);
          if (!validService) {
            totalSkipped += 1;
            continue;
          }

          // Validate that this item is in the current batch
          const validItem = batch.find(item => item.id === suggestion.item_id);
          if (!validItem) {
            totalSkipped += 1;
            continue;
          }

          const confidence = Math.max(0, Math.min(1, suggestion.confidence));

          const { error: updateError } = await supabase
            .from('pricebook_items')
            .update({
              mapped_service_id: suggestion.service_id,
              mapping_confidence: confidence,
              mapping_status: 'suggested',
            })
            .eq('id', suggestion.item_id)
            .eq('contractor_id', contractorId);

          if (updateError) {
            console.error('POST /api/pricebook/lists/[id]/map update error:', updateError);
            totalSkipped += 1;
          } else {
            totalMapped += 1;
          }
        }

        // Count items in batch that weren't in the suggestions
        const suggestedItemIds = new Set(suggestions.map(s => s.item_id));
        const missedItems = batch.filter(item => !suggestedItemIds.has(item.id));
        totalSkipped += missedItems.length;
      } catch (batchError) {
        console.error('POST /api/pricebook/lists/[id]/map batch error:', batchError);
        totalSkipped += batch.length;
      }
    }

    return NextResponse.json({
      message: `Mapping complete. ${totalMapped} items mapped, ${totalSkipped} skipped.`,
      mapped_count: totalMapped,
      skipped_count: totalSkipped,
      total_unmapped: unmappedItems.length,
    });
  } catch (err) {
    console.error('POST /api/pricebook/lists/[id]/map error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
