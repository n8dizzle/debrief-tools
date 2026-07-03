'use client';

import { useState, useEffect } from 'react';
import { TierConfig, dbRowToTierConfig } from './tiers';

// Re-export for backward compatibility
export { dbRowToTierConfig };

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

