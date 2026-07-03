'use client';

import { useState, useEffect } from 'react';

export interface SystemOption {
  id: number;
  code: string;
  displayName: string;
  description: string;
  price: number;
  memberPrice: number;
  seer: number;
  type: 'AC' | 'HP';
  stage: 'Single-Stage' | 'Two-Stage' | 'Variable';
  tonnage: number;
  fuelType: 'Gas' | 'Electric' | 'Dual Fuel';
  brand: string;
  categoryName: string;
  equipmentRefs: Array<{ skuId: number; quantity: number }>;
  ahriNumber?: string;
  components?: string;
}

export type TierName = 'Builder' | 'Silver' | 'Gold' | 'Platinum' | 'Platinum+';

export interface TierGroup {
  tier: TierName;
  seer: number;
  stage: string;
  systems: SystemOption[];
  defaultSystem: SystemOption | null;
}

// Tier mapping rules:
// Builder = Comfort Maker (entry brand), single-stage
// Silver = American Standard, single-stage (14-16 SEER)
// Gold = American Standard, two-stage (17 SEER)
// Platinum = American Standard, variable/inverter (18 SEER)
// Platinum+ = American Standard, variable/inverter (20 SEER)
function seerToTier(seer: number, brand: string, stage: string): TierName {
  const lower = brand.toLowerCase();
  const isBuilderBrand = lower.includes('comfort m') || lower.includes('comfortm') || lower.includes('ameristar');
  if (isBuilderBrand) return 'Builder';

  // American Standard / other brands: tier by stage + SEER
  if (stage === 'Variable') {
    return seer >= 20 ? 'Platinum+' : 'Platinum';
  }
  if (stage === 'Two-Stage') {
    return 'Gold';
  }
  // Single-stage: lowest SEER (14) = Builder, higher = Silver
  if (seer <= 14) return 'Builder';
  return 'Silver';
}

function parseBrand(name: string, code: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('comfort m') || lower.includes('comfortm')) return 'Comfort Maker';
  if (lower.includes('ameristar')) return 'Ameristar';
  if (lower.includes('american standard')) return 'American Standard';
  if (lower.includes('carrier')) return 'Carrier';
  if (lower.includes('bryant')) return 'Bryant';
  if (lower.includes('solace')) return 'Solace Air';
  // AHRI-code systems (5AC14-, etc.) are American Standard
  if (code.match(/^\d+[A-Z]{2}\d{2}-/)) return 'American Standard';
  return 'Unknown';
}

function parseStage(name: string): 'Single-Stage' | 'Two-Stage' | 'Variable' {
  if (name.includes('Variable')) return 'Variable';
  if (name.includes('Two-Stage') || name.includes('2-Stage') || name.includes('Double Stage') || name.includes('2 Stage')) return 'Two-Stage';
  return 'Single-Stage';
}

function parseTonnage(name: string, categoryName: string): number {
  const match = (name + ' ' + categoryName).match(/([\d.]+)\s*Ton/i);
  return match ? parseFloat(match[1]) : 0;
}

function parseSeer(code: string, name: string): number {
  // Try code first: 5AC14-xxxx → 14
  const codeMatch = code.match(/^\d+[A-Z]{2}(\d{2})-/);
  if (codeMatch) return parseInt(codeMatch[1]);
  // Fallback to name
  const nameMatch = name.match(/(\d{2})\s*SEER/i);
  return nameMatch ? parseInt(nameMatch[1]) : 0;
}

function parseType(code: string): 'AC' | 'HP' {
  if (code.match(/HP/i)) return 'HP';
  return 'AC';
}

function parseFuelType(categoryName: string, name: string): 'Gas' | 'Electric' | 'Dual Fuel' {
  const combined = (categoryName + ' ' + name).toLowerCase();
  if (combined.includes('dual fuel')) return 'Dual Fuel';
  if (combined.includes('gas')) return 'Gas';
  return 'Electric';
}

function parseAhriNumber(description: string): string | undefined {
  const match = description.match(/AHRI\s*(?:Certified\s*)?(?:Reference\s*)?#?:?\s*(\d+)/i);
  return match ? match[1] : undefined;
}

function parseComponents(description: string): string | undefined {
  const match = description.match(/Factory-matched components?:\s*([^.]+)/i);
  return match ? match[1].trim() : undefined;
}

export interface UseSystemsResult {
  allSystems: SystemOption[];
  tiers: TierGroup[];
  loading: boolean;
  error: string | null;
  filterByTonnageAndFuel: (tonnage: number, fuel: 'Gas' | 'Electric' | 'Dual Fuel') => TierGroup[];
}

export function useSystems(): UseSystemsResult {
  const [allSystems, setAllSystems] = useState<SystemOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSystems() {
      try {
        const res = await fetch('/api/servicetitan/pricebook?type=services');
        if (!res.ok) throw new Error('Failed to fetch pricebook services');
        const data = await res.json();

        const services = (data.data || []) as Array<{
          id: number;
          code: string;
          displayName?: string;
          description?: string;
          price: number;
          memberPrice?: number;
          categories?: Array<{ id: number; name: string }>;
          serviceEquipment?: Array<{ skuId: number; quantity: number }>;
        }>;

        // Filter to AHRI system codes (NACnn- or NHPnn- pattern)
        const systemServices = services.filter(s =>
          (s.code || '').match(/^\d+[A-Z]{2}\d{2}-/)
        );

        const parsed: SystemOption[] = systemServices.map(s => {
          const code = s.code || '';
          const name = s.displayName || '';
          const desc = s.description || '';
          const catName = s.categories?.[0]?.name || '';

          return {
            id: s.id,
            code,
            displayName: name,
            description: desc,
            price: s.price || 0,
            memberPrice: s.memberPrice || 0,
            seer: parseSeer(code, name),
            type: parseType(code),
            stage: parseStage(name),
            tonnage: parseTonnage(name, catName),
            fuelType: parseFuelType(catName, name),
            brand: parseBrand(name, code),
            categoryName: catName,
            equipmentRefs: s.serviceEquipment || [],
            ahriNumber: parseAhriNumber(desc),
            components: parseComponents(desc),
          };
        }).filter(s => s.seer > 0 && s.tonnage > 0 && s.price > 0);

        setAllSystems(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load systems');
      } finally {
        setLoading(false);
      }
    }

    fetchSystems();
  }, []);

  function filterByTonnageAndFuel(tonnage: number, fuel: 'Gas' | 'Electric' | 'Dual Fuel'): TierGroup[] {
    const filtered = allSystems.filter(s => s.tonnage === tonnage && s.fuelType === fuel);

    // Group by tier (brand + stage + SEER)
    const tierMap = new Map<TierName, SystemOption[]>();
    for (const s of filtered) {
      const tier = seerToTier(s.seer, s.brand, s.stage);
      if (!tierMap.has(tier)) tierMap.set(tier, []);
      tierMap.get(tier)!.push(s);
    }

    // Build tier groups in order, pick cheapest as default
    const tierOrder: TierName[] = ['Builder', 'Silver', 'Gold', 'Platinum', 'Platinum+'];
    const groups: TierGroup[] = [];

    for (const tierName of tierOrder) {
      const systems = tierMap.get(tierName) || [];
      if (systems.length === 0) continue;

      systems.sort((a, b) => a.price - b.price);
      const seer = systems[0].seer;
      const stage = systems[0].stage;

      groups.push({
        tier: tierName,
        seer,
        stage,
        systems,
        defaultSystem: systems[0], // cheapest in tier
      });
    }

    return groups;
  }

  const tiers = filterByTonnageAndFuel(3, 'Gas'); // default view

  return { allSystems, tiers, loading, error, filterByTonnageAndFuel };
}
