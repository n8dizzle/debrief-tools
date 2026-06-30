/**
 * Classify a ServiceTitan estimate equipment line into an HVAC component type, so we can
 * count the major units per job (condenser, coil, furnace, air handler) and exclude
 * accessories (heat strips, communicating thermostats, etc.) that ST sometimes types as
 * "Equipment". Counts drive a standard per-component labor figure for commission.
 *
 * Tuned to Christmas Air's American Standard SKU scheme (validated against real estimates);
 * falls back to description keywords. If other brands appear, extend the patterns.
 */

export type ComponentType = 'condenser' | 'coil' | 'air_handler' | 'furnace' | 'accessory';

export function classifyEquipment(sku: string | null | undefined, name?: string | null): ComponentType {
  const s = (sku || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const n = (name || '').toLowerCase();

  // SKU patterns (American Standard 454B etc.)
  if (/TXC/.test(s)) return 'coil';                 // 5TXC, 4TXC cased coils
  if (/(TEM|TEE|TAM|GAM)/.test(s)) return 'air_handler'; // 5TEM, 4TEE, TAM, GAM
  if (/^S\d/.test(s)) return 'furnace';             // S8X1, S8V2, S9...
  if (/^[45]A/.test(s)) return 'condenser';         // 5A7A AC, 5A6H/4A6H heat pump, 5A7V variable

  // Description fallback (other brands / odd SKUs)
  if (/\bcoil\b/.test(n)) return 'coil';
  if (/air handler/.test(n)) return 'air_handler';
  if (/furnace/.test(n)) return 'furnace';
  if (/heat pump|condens|\bac\b|seer/.test(n) && !/strip|heater kit|thermostat|control/.test(n)) return 'condenser';

  return 'accessory';
}

const COMPONENT_TYPES: ComponentType[] = ['condenser', 'coil', 'air_handler', 'furnace'];

/** Count major components (excludes accessories), honoring qty. */
export function countComponents(items: { sku: string | null; name?: string | null; qty?: number | null }[]): number {
  let n = 0;
  for (const it of items) {
    if (COMPONENT_TYPES.includes(classifyEquipment(it.sku, it.name))) n += Math.max(1, Math.round(Number(it.qty || 1)));
  }
  return n;
}

/** Count systems = outdoor condensing units (condenser/heat pump), honoring qty. */
export function countSystems(items: { sku: string | null; name?: string | null; qty?: number | null }[]): number {
  let n = 0;
  for (const it of items) {
    if (classifyEquipment(it.sku, it.name) === 'condenser') n += Math.max(1, Math.round(Number(it.qty || 1)));
  }
  return n;
}
