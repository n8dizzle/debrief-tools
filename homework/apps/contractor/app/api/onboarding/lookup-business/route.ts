import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import Anthropic from '@anthropic-ai/sdk';

// POST /api/onboarding/lookup-business
// Phase 1: Google Places API lookup
// Phase 2: AI enrichment from website (if found)
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { businessName, city } = await request.json();
    if (!businessName) {
      return NextResponse.json({ error: 'businessName is required' }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
    }

    // Phase 1: Google Places — Find Place from Text
    const query = city ? `${businessName} ${city} TX` : `${businessName} Dallas TX`;
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address&key=${apiKey}`;

    const findRes = await fetch(findUrl);
    const findData = await findRes.json();

    if (!findData.candidates || findData.candidates.length === 0) {
      return NextResponse.json({ found: false, message: 'No business found. You can enter details manually.' });
    }

    const placeId = findData.candidates[0].place_id;

    // Get Place Details
    const detailFields = 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,photos,address_components';
    const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${detailFields}&key=${apiKey}`;

    const detailRes = await fetch(detailUrl);
    const detailData = await detailRes.json();
    const place = detailData.result;

    if (!place) {
      return NextResponse.json({ found: false, message: 'Could not retrieve business details.' });
    }

    // Parse address components
    const addressComponents = place.address_components || [];
    const getComponent = (type: string) =>
      addressComponents.find((c: { types: string[] }) => c.types.includes(type))?.long_name || '';

    // Get photo URL if available
    let photoUrl = '';
    if (place.photos && place.photos.length > 0) {
      photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`;
    }

    const result: Record<string, unknown> = {
      found: true,
      business_name: place.name || businessName,
      phone: place.formatted_phone_number || '',
      website: place.website || '',
      rating: place.rating || null,
      review_count: place.user_ratings_total || 0,
      photo_url: photoUrl,
      address_line1: `${getComponent('street_number')} ${getComponent('route')}`.trim(),
      city: getComponent('locality') || getComponent('sublocality'),
      state: getComponent('administrative_area_level_1'),
      zip_code: getComponent('postal_code'),
    };

    // Phase 2: AI Enrichment from website (if website exists)
    if (place.website) {
      try {
        const enrichment = await enrichFromWebsite(place.website, place.name || businessName);
        if (enrichment) {
          result.ai_enrichment = enrichment;
        }
      } catch (err) {
        // Graceful degradation — still return Places data
        console.error('AI enrichment failed:', err);
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/onboarding/lookup-business error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function enrichFromWebsite(websiteUrl: string, businessName: string) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return null;

  // Fetch website content (text only, limit size)
  let pageText = '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HomeworkBot/1.0)' },
    });
    clearTimeout(timeout);

    const html = await res.text();
    // Strip HTML tags, keep text
    pageText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000); // Limit to ~8K chars
  } catch {
    return null;
  }

  if (!pageText || pageText.length < 100) return null;

  const client = new Anthropic({ apiKey: anthropicKey });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Extract business info from this website text for "${businessName}". Return ONLY a JSON object with these fields (use null if not found):
{
  "description": "1-2 sentence business description",
  "specialties": ["list of services/specialties"],
  "years_in_business": number or null,
  "team_size": number or null,
  "service_area": "geographic area served or null"
}

Website text:
${pageText}`,
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  return JSON.parse(jsonMatch[0]);
}
