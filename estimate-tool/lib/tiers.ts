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
  },
];

// Build up to 5 bullet points for a tier card, escalating value
export function getTierBullets(tier: TierConfig): string[] {
  const bullets: string[] = [];

  // Energy savings
  bullets.push(`${tier.coolingSavings} Savings on Cooling`);

  // Compressor stage
  if (tier.compressorStage === 'Variable') {
    bullets.push('Variable-Speed Technology for Ultimate Comfort');
  } else if (tier.compressorStage === 'Multi-Stage') {
    bullets.push('Multi-Stage Comfort with Variable-Speed Blower');
  } else if (tier.compressorStage === 'Two-Stage') {
    bullets.push('Two-Stage Cooling for Better Comfort');
  }

  // Warranty
  bullets.push(`${tier.laborWarranty} Labor Warranty`);

  // Top guarantee
  if (tier.guarantees.includes('$500 No-Frustration')) {
    bullets.push('$500 No-Frustration Guarantee');
  }

  // Tech features
  if (tier.techFeatures.includes('Wi-Fi Thermostat')) {
    bullets.push('Wi-Fi Thermostat with Smartphone Control');
  } else if (tier.techFeatures.includes('Programmable Thermostat')) {
    bullets.push('Programmable Thermostat Included');
  }

  return bullets.slice(0, 5);
}
