import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
);

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const BATCH_SIZE = 50;
const GEOCODE_DELAY_MS = 50; // avoid rate limits

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * POST /api/customers/geocode
 * Batch geocode customers that don't have lat/lng yet
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: 'GOOGLE_MAPS_API_KEY not configured' }, { status: 500 });
  }

  // Get customers without geocoded coordinates
  const { data: customers, error } = await supabase
    .from('new_customers')
    .select('id, full_address')
    .is('lat', null)
    .not('full_address', 'is', null)
    .limit(BATCH_SIZE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!customers || customers.length === 0) {
    return NextResponse.json({ message: 'All customers geocoded', geocoded: 0, remaining: 0 });
  }

  let geocoded = 0;
  let failed = 0;

  for (const customer of customers) {
    try {
      const encoded = encodeURIComponent(customer.full_address);
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const json = await res.json();

      if (json.status === 'OK' && json.results.length > 0) {
        const { lat, lng } = json.results[0].geometry.location;
        await supabase
          .from('new_customers')
          .update({ lat, lng, geocoded_at: new Date().toISOString() })
          .eq('id', customer.id);
        geocoded++;
      } else {
        // Mark as attempted with 0,0 so we don't retry
        await supabase
          .from('new_customers')
          .update({ lat: 0, lng: 0, geocoded_at: new Date().toISOString() })
          .eq('id', customer.id);
        failed++;
      }

      await delay(GEOCODE_DELAY_MS);
    } catch (err) {
      console.error(`[Geocode] Failed for ${customer.id}:`, err);
      failed++;
    }
  }

  // Count remaining
  const { count } = await supabase
    .from('new_customers')
    .select('id', { count: 'exact', head: true })
    .is('lat', null)
    .not('full_address', 'is', null);

  return NextResponse.json({
    geocoded,
    failed,
    remaining: count || 0,
  });
}
