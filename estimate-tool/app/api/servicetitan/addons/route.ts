import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { ServiceTitanClient } from '@/lib/servicetitan';

export const dynamic = 'force-dynamic';

// Category keywords to detect add-on items in ST pricebook
const ADDON_CATEGORY_KEYWORDS = [
  'air quality', 'iaq', 'purification', 'purifier', 'uv', 'germicidal',
  'air scrubber', 'media filter', 'filtration', 'dehumidifier', 'humidifier',
  'thermostat', 'ecobee', 'nest', 'honeywell',
  'surge protector', 'surge protection',
  'duct seal', 'aeroseal', 'zoning', 'zone',
  'maintenance plan', 'tune-up', 'tune up',
  'smart vent',
];

function categorizeAddon(name: string, description?: string): string {
  const text = `${name} ${description || ''}`.toLowerCase();
  if (text.includes('uv') || text.includes('purif') || text.includes('scrubber') || text.includes('filter') || text.includes('iaq')) return 'indoor-air-quality';
  if (text.includes('dehumid') || text.includes('humidif') || text.includes('zone') || text.includes('duct') || text.includes('aeroseal')) return 'comfort';
  if (text.includes('surge') || text.includes('maintenance') || text.includes('tune')) return 'protection';
  if (text.includes('thermostat') || text.includes('smart') || text.includes('ecobee') || text.includes('nest')) return 'smart-home';
  return 'other';
}

function isLikelyAddon(name: string, categoryNames: string[]): boolean {
  const text = `${name} ${categoryNames.join(' ')}`.toLowerCase();
  return ADDON_CATEGORY_KEYWORDS.some(kw => text.includes(kw));
}

// GET /api/servicetitan/addons -- sync add-ons from ST pricebook to Supabase
export async function GET() {
  try {
    const st = new ServiceTitanClient();

    // Fetch services and materials from pricebook -- add-ons could be either
    const [services, materials] = await Promise.all([
      st.getServices(),
      st.getMaterials(),
    ]);

    // Filter to likely add-on items
    const addonServices = services
      .filter(s => s.active && isLikelyAddon(s.displayName || s.name || '', (s.categories || []).map(c => c.name || '')))
      .map(s => ({
        st_sku_id: s.id,
        st_code: s.code,
        st_type: 'Service' as const,
        name: s.displayName || s.name || s.code,
        description: s.description || '',
        price: s.price,
        category: categorizeAddon(s.displayName || s.name || '', s.description),
        popular: false,
      }));

    const addonMaterials = materials
      .filter(m => m.active && isLikelyAddon(m.displayName || m.name || '', (m.categories || []).map(c => c.name || '')))
      .map(m => ({
        st_sku_id: m.id,
        st_code: m.code,
        st_type: 'Material' as const,
        name: m.displayName || m.name || m.code,
        description: m.description || '',
        price: m.price,
        category: categorizeAddon(m.displayName || m.name || '', m.description),
        popular: false,
      }));

    const allAddons = [...addonServices, ...addonMaterials];

    // Upsert into Supabase
    const supabase = getServerSupabase();
    let synced = 0;

    for (const addon of allAddons) {
      const { error } = await supabase
        .from('estimate_addons')
        .upsert(
          {
            source: 'servicetitan',
            st_sku_id: addon.st_sku_id,
            st_code: addon.st_code,
            st_type: addon.st_type,
            name: addon.name,
            description: addon.description,
            price: addon.price,
            category: addon.category,
            popular: addon.popular,
            active: true,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'st_sku_id', ignoreDuplicates: false }
        );

      if (!error) synced++;
    }

    return NextResponse.json({
      synced,
      total: allAddons.length,
      services: addonServices.length,
      materials: addonMaterials.length,
    });
  } catch (err) {
    console.error('[ST Addons Sync] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to sync add-ons from ServiceTitan' },
      { status: 500 }
    );
  }
}
