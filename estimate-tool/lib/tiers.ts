export interface TierPerk {
  label: string;
  included: boolean;
}

export interface TierConfig {
  id: string;
  name: string;
  color: string;       // accent color hex
  bgColor: string;     // tailwind bg class
  borderColor: string; // tailwind border class
  textColor: string;   // tailwind text class
  brand: string;       // default brand for this tier
  laborWarranty: string;
  partsWarranty: string;
  heatExchangerWarranty: string;
  comfortGuaranteeYears: number;
  compressorStage: string;    // 'Single-Stage' | 'Two-Stage' | 'Variable' | 'Variable+'
  noiseLevel: string;         // relative: 'Standard' | 'Quiet' | 'Quieter' | 'Quietest'
  coolingSavings: string;     // 'Up to 10%' etc.
  heatingSavings: string;
  thermostat: string;
  financing: string[];
  perks: TierPerk[];
  guarantees: string[];
  techFeatures: string[];     // filtration, UV, etc.
  // New fields from 002 migration
  defaultAddonIds: string[];
  featuredFinancingPlanId?: string;
  warrantyExtensionPrice?: number;
  scopeIncluded: string[];
  scopeExcluded: string[];
  scopeAssumptions: string[];
}

export const TIERS: TierConfig[] = [
  {
    id: 'builder',
    name: 'Builder',
    color: '#6B7280',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
    textColor: 'text-gray-700',
    laborWarranty: '1 Year',
    partsWarranty: '10 Year',
    heatExchangerWarranty: '20 Year',
    comfortGuaranteeYears: 1,
    brand: 'Comfort Maker',
    compressorStage: 'Single-Stage',
    noiseLevel: 'Standard',
    coolingSavings: 'Up to 10%',
    heatingSavings: 'Up to 5%',
    thermostat: 'Basic Thermostat',
    financing: ['18 Month 0% Interest'],
    perks: [
      { label: 'Property Protection Guarantee', included: true },
      { label: 'All Materials & Labor Included', included: true },
      { label: 'Minimum Energy Efficiency', included: true },
    ],
    guarantees: ['Property Protection'],
    techFeatures: ['Basic Thermostat'],
    defaultAddonIds: [],
    scopeIncluded: ['All materials and labor', 'City permit and inspection', 'Equipment disposal and recycling', 'Floor savers and drop cloths', 'Complete cleanup when we leave', 'Post-install quality inspection'],
    scopeExcluded: ['Ductwork modification or replacement', 'Electrical panel upgrades', 'Attic or crawl space access modifications', 'Concrete or structural work'],
    scopeAssumptions: ['Standard residential system (5 tons or under)', 'Equipment accessible without modification', 'Existing electrical service is adequate', 'Standard refrigerant line lengths (up to 50ft)'],
  },
  {
    id: 'silver',
    name: 'Silver',
    color: '#2563EB',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-700',
    laborWarranty: '2 Year',
    partsWarranty: '10 Year',
    heatExchangerWarranty: '20 Year',
    comfortGuaranteeYears: 2,
    brand: 'American Standard',
    compressorStage: 'Single-Stage',
    noiseLevel: 'Quiet',
    coolingSavings: 'Up to 15%',
    heatingSavings: 'Up to 16%',
    thermostat: 'Programmable Thermostat',
    financing: ['18 Month 0% Interest'],
    perks: [
      { label: '$500 No-Frustration Guarantee', included: true },
      { label: 'Property Protection Guarantee', included: true },
      { label: 'No-Lemon Guarantee', included: true },
      { label: '2-Year 100% Satisfaction Guarantee', included: true },
      { label: 'Upgraded Filtration', included: true },
    ],
    guarantees: ['$500 No-Frustration', 'Property Protection', 'No-Lemon', '2-Year Satisfaction'],
    techFeatures: ['Programmable Thermostat', 'Upgraded Filtration', 'Noise Reduction'],
    defaultAddonIds: [],
    scopeIncluded: ['All materials and labor', 'City permit and inspection', 'Equipment disposal and recycling', 'Floor savers and drop cloths', 'Complete cleanup when we leave', 'Post-install quality inspection'],
    scopeExcluded: ['Ductwork modification or replacement', 'Electrical panel upgrades', 'Attic or crawl space access modifications', 'Concrete or structural work'],
    scopeAssumptions: ['Standard residential system (5 tons or under)', 'Equipment accessible without modification', 'Existing electrical service is adequate', 'Standard refrigerant line lengths (up to 50ft)'],
  },
  {
    id: 'gold',
    name: 'Gold',
    color: '#B8956B',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-400',
    textColor: 'text-amber-800',
    laborWarranty: '5 Year',
    partsWarranty: '10 Year',
    heatExchangerWarranty: '20 Year',
    comfortGuaranteeYears: 3,
    brand: 'American Standard',
    compressorStage: 'Two-Stage',
    noiseLevel: 'Quieter',
    coolingSavings: 'Up to 25%',
    heatingSavings: 'Up to 15%',
    thermostat: 'Wi-Fi Thermostat',
    financing: ['18 Month 0% Interest'],
    perks: [
      { label: '$500 No-Frustration Guarantee', included: true },
      { label: 'Property Protection Guarantee', included: true },
      { label: 'No-Lemon Guarantee', included: true },
      { label: '1-Year Comfort Club Membership', included: true },
      { label: '2-Year 100% Satisfaction Guarantee', included: true },
    ],
    guarantees: ['$500 No-Frustration', 'Property Protection', 'No-Lemon', '1-Year Club', '2-Year Satisfaction'],
    techFeatures: [
      'Wi-Fi Thermostat',
      'Smartphone Control',
      'Upgraded Filtration',
      'UV Germicidal Light',
      'Variable-Speed Blower',
    ],
    defaultAddonIds: [],
    scopeIncluded: ['All materials and labor', 'City permit and inspection', 'Equipment disposal and recycling', 'Floor savers and drop cloths', 'Complete cleanup when we leave', 'Post-install quality inspection'],
    scopeExcluded: ['Ductwork modification or replacement', 'Electrical panel upgrades', 'Attic or crawl space access modifications', 'Concrete or structural work'],
    scopeAssumptions: ['Standard residential system (5 tons or under)', 'Equipment accessible without modification', 'Existing electrical service is adequate', 'Standard refrigerant line lengths (up to 50ft)'],
  },
  {
    id: 'platinum',
    name: 'Platinum',
    color: '#7C3AED',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-400',
    textColor: 'text-purple-700',
    laborWarranty: '10 Year',
    partsWarranty: '10 Year',
    heatExchangerWarranty: '20 Year',
    comfortGuaranteeYears: 5,
    brand: 'American Standard',
    compressorStage: 'Variable',
    noiseLevel: 'Quietest',
    coolingSavings: 'Up to 35%',
    heatingSavings: 'Up to 18%',
    thermostat: 'Wi-Fi Thermostat',
    financing: ['18 Month 0% Interest', '60 Month 0% Interest'],
    perks: [
      { label: '$500 No-Frustration Guarantee', included: true },
      { label: 'Property Protection Guarantee', included: true },
      { label: 'No-Lemon Guarantee', included: true },
      { label: '1-Year Comfort Club Membership', included: true },
      { label: '2-Year 100% Satisfaction Guarantee', included: true },
    ],
    guarantees: ['$500 No-Frustration', 'Property Protection', 'No-Lemon', '1-Year Club', '2-Year Satisfaction'],
    techFeatures: [
      'Wi-Fi Thermostat',
      'Increased Humidity Control',
      'Smartphone Control',
      'Top-of-the-Line Filtration',
      'UV Germicidal Light',
      'Variable-Speed Technology',
    ],
    defaultAddonIds: [],
    scopeIncluded: ['All materials and labor', 'City permit and inspection', 'Equipment disposal and recycling', 'Floor savers and drop cloths', 'Complete cleanup when we leave', 'Post-install quality inspection'],
    scopeExcluded: ['Ductwork modification or replacement', 'Electrical panel upgrades', 'Attic or crawl space access modifications', 'Concrete or structural work'],
    scopeAssumptions: ['Standard residential system (5 tons or under)', 'Equipment accessible without modification', 'Existing electrical service is adequate', 'Standard refrigerant line lengths (up to 50ft)'],
  },
  {
    id: 'platinum_plus',
    name: 'Platinum+',
    color: '#4F46E5',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-400',
    textColor: 'text-indigo-700',
    laborWarranty: '10 Year',
    partsWarranty: '10 Year',
    heatExchangerWarranty: '20 Year',
    comfortGuaranteeYears: 5,
    brand: 'American Standard',
    compressorStage: 'Variable',
    noiseLevel: 'Quietest',
    coolingSavings: 'Up to 35%',
    heatingSavings: 'Up to 18%',
    thermostat: 'Wi-Fi Thermostat',
    financing: ['18 Month 0% Interest', '60 Month 0% Interest'],
    perks: [
      { label: '$500 No-Frustration Guarantee', included: true },
      { label: 'Property Protection Guarantee', included: true },
      { label: 'No-Lemon Guarantee', included: true },
      { label: '1-Year Comfort Club Membership', included: true },
      { label: '2-Year 100% Satisfaction Guarantee', included: true },
    ],
    guarantees: ['$500 No-Frustration', 'Property Protection', 'No-Lemon', '1-Year Club', '2-Year Satisfaction'],
    techFeatures: [
      'Wi-Fi Thermostat',
      'Increased Humidity Control',
      'Smartphone Control',
      'Top-of-the-Line Filtration',
      'UV Germicidal Light',
      'Variable-Speed Technology',
      '750-Speed Inverter Compressor',
    ],
    defaultAddonIds: [],
    scopeIncluded: ['All materials and labor', 'City permit and inspection', 'Equipment disposal and recycling', 'Floor savers and drop cloths', 'Complete cleanup when we leave', 'Post-install quality inspection', 'Extended commissioning and system optimization'],
    scopeExcluded: ['Ductwork modification or replacement', 'Electrical panel upgrades', 'Attic or crawl space access modifications', 'Concrete or structural work'],
    scopeAssumptions: ['Standard residential system (5 tons or under)', 'Equipment accessible without modification', 'Existing electrical service is adequate', 'Standard refrigerant line lengths (up to 50ft)'],
  },
];

// Build progressively more bullet points for higher tiers
// Builder: 2-3 bullets, Silver: 4, Gold: 5-6, Platinum: 7-8
export function getTierBullets(tier: TierConfig): string[] {
  const bullets: string[] = [];

  // Energy savings (all tiers)
  bullets.push(`${tier.coolingSavings} Savings on Cooling`);

  // Warranty (all tiers)
  bullets.push(`${tier.laborWarranty} Labor Warranty`);

  // Compressor stage (Silver+)
  if (tier.compressorStage === 'Variable') {
    bullets.push('Variable-Speed for Whisper-Quiet Comfort');
    bullets.push('Precise Temperature Control in Every Room');
  } else if (tier.compressorStage === 'Two-Stage') {
    bullets.push('Two-Stage Cooling for Better Comfort');
  }

  // Guarantees (Silver+)
  if (tier.guarantees.includes('$500 No-Frustration')) {
    bullets.push('$500 No-Frustration Guarantee');
  }
  if (tier.guarantees.includes('No-Lemon')) {
    bullets.push('No-Lemon Guarantee');
  }
  if (tier.guarantees.includes('2-Year Satisfaction')) {
    bullets.push('2-Year 100% Satisfaction Guarantee');
  }

  // Tech features (Gold+)
  if (tier.techFeatures.includes('Wi-Fi Thermostat')) {
    bullets.push('Wi-Fi Thermostat with Smartphone Control');
  } else if (tier.techFeatures.includes('Programmable Thermostat')) {
    bullets.push('Programmable Thermostat Included');
  }
  if (tier.techFeatures.includes('UV Germicidal Light')) {
    bullets.push('UV Germicidal Light for Cleaner Air');
  }
  if (tier.techFeatures.includes('Upgraded Filtration') || tier.techFeatures.includes('Top-of-the-Line Filtration')) {
    bullets.push('Advanced Air Filtration System');
  }

  // Premium extras (Platinum+)
  if (tier.techFeatures.includes('Increased Humidity Control')) {
    bullets.push('Whole-Home Humidity Control');
  }
  if (tier.techFeatures.includes('Variable-Speed Technology')) {
    bullets.push('Inverter-Driven Maximum Efficiency');
  }
  if (tier.guarantees.includes('1-Year Club')) {
    bullets.push('1-Year Comfort Club Membership Included');
  }
  if (tier.comfortGuaranteeYears >= 5) {
    bullets.push(`${tier.comfortGuaranteeYears}-Year Comfort Guarantee`);
  }
  if (tier.techFeatures.includes('750-Speed Inverter Compressor')) {
    bullets.push('750-Speed Inverter Compressor');
    bullets.push('Best-in-Class 20 SEER2 Efficiency');
  }

  // "+" variants get an extra efficiency bullet to be slightly taller
  if (tier.name.includes('+')) {
    bullets.push('Higher SEER2 Rating for Extra Savings');
  }

  return bullets;
}

// ── Color mapping for DB rows ─────────────────────────────────────
const COLOR_MAP: Record<string, { bgColor: string; borderColor: string; textColor: string }> = {
  '#6B7280': { bgColor: 'bg-gray-50', borderColor: 'border-gray-300', textColor: 'text-gray-700' },
  '#2563EB': { bgColor: 'bg-blue-50', borderColor: 'border-blue-300', textColor: 'text-blue-700' },
  '#B8956B': { bgColor: 'bg-amber-50', borderColor: 'border-amber-400', textColor: 'text-amber-800' },
  '#7C3AED': { bgColor: 'bg-purple-50', borderColor: 'border-purple-400', textColor: 'text-purple-700' },
  '#4F46E5': { bgColor: 'bg-indigo-50', borderColor: 'border-indigo-400', textColor: 'text-indigo-700' },
};

function getColorClasses(hex: string) {
  return COLOR_MAP[hex] || COLOR_MAP['#6B7280'];
}

// Convert Supabase row to TierConfig (shared between server API and client hook)
export function dbRowToTierConfig(row: {
  id: string;
  display_name: string;
  sort_order: number;
  color: string;
  default_brand: string;
  labor_warranty_years: number;
  parts_warranty_years: number;
  heat_exchanger_warranty_years: number;
  comfort_guarantee_years: number;
  compressor_stage: string;
  noise_level: string;
  cooling_savings: string;
  heating_savings: string;
  thermostat: string;
  financing_options: string[];
  guarantees: string[];
  tech_features: string[];
  default_addon_ids?: string[];
  featured_financing_plan_id?: string;
  warranty_extension_price?: number;
  scope_included?: string[];
  scope_excluded?: string[];
  scope_assumptions?: string[];
}): TierConfig {
  const colors = getColorClasses(row.color);
  return {
    id: row.id,
    name: row.display_name,
    color: row.color,
    bgColor: colors.bgColor,
    borderColor: colors.borderColor,
    textColor: colors.textColor,
    brand: row.default_brand,
    laborWarranty: `${row.labor_warranty_years} Year`,
    partsWarranty: `${row.parts_warranty_years} Year`,
    heatExchangerWarranty: `${row.heat_exchanger_warranty_years} Year`,
    comfortGuaranteeYears: row.comfort_guarantee_years,
    compressorStage: row.compressor_stage,
    noiseLevel: row.noise_level,
    coolingSavings: row.cooling_savings,
    heatingSavings: row.heating_savings,
    thermostat: row.thermostat,
    financing: row.financing_options,
    perks: row.guarantees.map(g => ({ label: g, included: true })),
    guarantees: row.guarantees,
    techFeatures: row.tech_features,
    defaultAddonIds: row.default_addon_ids || [],
    featuredFinancingPlanId: row.featured_financing_plan_id || undefined,
    warrantyExtensionPrice: row.warranty_extension_price ?? undefined,
    scopeIncluded: row.scope_included || [],
    scopeExcluded: row.scope_excluded || [],
    scopeAssumptions: row.scope_assumptions || [],
  };
}

// Look up tier config, falling back "+" to base tier
export function findTierConfig(name: string): TierConfig {
  // Direct match
  const direct = TIERS.find(t => t.name.toLowerCase() === name.toLowerCase());
  if (direct) return direct;
  // Strip "+" and try base
  const baseName = name.replace(/\+$/, '').trim();
  const base = TIERS.find(t => t.name.toLowerCase() === baseName.toLowerCase());
  if (base) {
    // Return a copy with the "+" name and slightly adjusted display
    return { ...base, name, id: base.id + '_plus' };
  }
  return TIERS[0];
}
