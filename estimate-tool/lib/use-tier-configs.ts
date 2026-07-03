'use client';

import { useState, useEffect } from 'react';
import { TierConfig } from './tiers';

// Tailwind class mappings by color hex
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

export interface UseTierConfigsResult {
  tiers: TierConfig[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTierConfigs(): UseTierConfigsResult {
  const [tiers, setTiers] = useState<TierConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTiers() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/tiers');
      if (!res.ok) throw new Error('Failed to load tier configs');
      const data = await res.json();
      setTiers(data.tiers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      // Fallback to hardcoded tiers
      const { TIERS } = await import('./tiers');
      setTiers(TIERS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTiers(); }, []);

  return { tiers, loading, error, refetch: fetchTiers };
}

// Convert Supabase row to TierConfig
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
  };
}
