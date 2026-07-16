// Classify HVAC equipment line items and count Components vs. Systems.
//
// Jon's definitions:
//   Component = one real unit piece (condenser, heat pump, furnace, air handler, coil,
//               packaged unit). Accessories (thermostats, heat strips, UV, controls,
//               sensors) are NOT components.
//   System    = a COMPLETE set. Either a packaged unit on its own, OR an outdoor unit
//               (condenser/heat pump) + an indoor unit (furnace + coil, OR an air
//               handler which includes its own coil). Partials count as 0 systems.
//
// Validated against real estimate line names — see the category counts in chat.

export type EquipCategory =
  | 'condenser' | 'heat_pump' | 'furnace' | 'air_handler' | 'coil'
  | 'packaged' | 'mini_split' | 'accessory' | 'other';

export function classifyEquip(name: string | null | undefined): EquipCategory {
  const n = (name || '').toLowerCase();
  // Accessories first — heat strips, thermostats, controls, UV, sensors (not system parts).
  if (/heat.?strip|bayhtr|thermostat|\bstat\b|communicating control|link .*control|smart control|\buv\b|oxi|sensor|zsens|accucomfort|breaker/.test(n)) return 'accessory';
  if (/package|gas.?pack|rooftop|\brtu\b|self.?contained/.test(n)) return 'packaged';
  if (/mini.?split|ductless|wind.?free|multi.?zone|\bmxz\b|cassette/.test(n)) return 'mini_split';
  if (/heat.?pump|\bhp\b/.test(n)) return 'heat_pump';
  if (/air.?handler|\bahu?\b|fan.?coil/.test(n)) return 'air_handler';
  if (/furnace|\bafue\b|\d\d%|modulating|upflow|downflow/.test(n)) return 'furnace';
  if (/coil|evaporator|\bevap\b|cased/.test(n)) return 'coil';
  if (/condenser|condensing|air.?conditioner|\ba\/?c\b|\bseer\b|\bcond\b/.test(n)) return 'condenser';
  return 'other';
}

export interface EquipItem { type?: string; name?: string; qty?: number }

// Count components + systems for ONE estimate's line items.
export function countEstimate(items: EquipItem[] | null | undefined): { components: number; systems: number } {
  const cat: Record<EquipCategory, number> = {
    condenser: 0, heat_pump: 0, furnace: 0, air_handler: 0, coil: 0,
    packaged: 0, mini_split: 0, accessory: 0, other: 0,
  };
  for (const it of items || []) {
    if ((it.type || '').toLowerCase() !== 'equipment') continue;
    const c = classifyEquip(it.name);
    const q = Math.max(1, Math.round(it.qty ?? 1));
    cat[c] += q;
  }
  // Components = real unit pieces (exclude accessories + unrecognized "other").
  const components = cat.condenser + cat.heat_pump + cat.furnace + cat.air_handler + cat.coil + cat.packaged + cat.mini_split;

  // Systems = complete sets.
  const outdoor = cat.condenser + cat.heat_pump;
  const completeIndoor = cat.air_handler + Math.min(cat.furnace, cat.coil); // air handler is self-contained; furnace needs a coil
  const splitSystems = Math.min(outdoor, completeIndoor);
  const systems = cat.packaged + cat.mini_split + splitSystems; // mini-split outdoor ≈ 1 system (rare; revisit)

  return { components, systems };
}

// Sum across a deal's sold estimates (each estimate counted on its own so pieces
// don't falsely pair across estimates).
export function countDeal(estimatesItems: (EquipItem[] | null)[]): { components: number; systems: number } {
  let components = 0, systems = 0;
  for (const items of estimatesItems) {
    const r = countEstimate(items);
    components += r.components; systems += r.systems;
  }
  return { components, systems };
}
