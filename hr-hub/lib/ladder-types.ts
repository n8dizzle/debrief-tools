// Shared types for the config-driven (DB-backed) career ladder, plus the derived
// helpers the assessment UI needs. Replaces the static lib/ladder.ts at runtime;
// lib/ladder.ts is now only used by the one-time seed script.

export type SkillStatus = 'not_started' | 'in_progress' | 'verified';

export interface LadderItem {
  id: string;
  bucket_id: string;
  text: string;
  is_gate: boolean;
  sort_order: number;
}
export interface LadderTier {
  id: string;
  pay_label: string | null;
  pay_value: number | null;
  pay_kind: string | null; // 'hourly' | 'commission' | 'other' | null
  gate_note: string | null;
  is_default: boolean;
  sort_order: number;
  items: LadderItem[];
}
export interface LadderLevel {
  id: string;
  name: string;
  subtitle: string | null;
  gate_note: string | null;
  timeframe: string | null;
  sort_order: number;
  tiers: LadderTier[];
}
export interface LadderBucket {
  id: string;
  name: string;
  is_gate: boolean;
  sort_order: number;
}
export interface LadderTree {
  id: string;
  name: string;
  description: string | null;
  st_business_units: string[];
  buckets: LadderBucket[];
  levels: LadderLevel[];
}

export interface LadderSummary {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

// ── derived helpers ──────────────────────────────────────────────────────────

export interface FlatTier extends LadderTier {
  levelId: string;
  levelName: string;
  order: number; // global 0-based across all tiers in ladder order
}

/** All tiers flattened in ladder order (level order, then tier order) with a global index. */
export function flatTiers(tree: LadderTree): FlatTier[] {
  const out: FlatTier[] = [];
  let order = 0;
  for (const level of [...tree.levels].sort((a, b) => a.sort_order - b.sort_order)) {
    for (const tier of [...level.tiers].sort((a, b) => a.sort_order - b.sort_order)) {
      out.push({ ...tier, levelId: level.id, levelName: level.name, order: order++ });
    }
  }
  return out;
}

/** Items on a tier, sorted (already grouped by bucket at render time). */
export function tierItems(tier: LadderTier): LadderItem[] {
  return [...tier.items].sort((a, b) => a.sort_order - b.sort_order);
}

/** Items on a tier for a given bucket, sorted. */
export function itemsForBucket(tier: LadderTier, bucketId: string): LadderItem[] {
  return tierItems(tier).filter((i) => i.bucket_id === bucketId);
}

/** Buckets that actually have at least one item somewhere on this tier, in bucket order. */
export function bucketsOnTier(tree: LadderTree, tier: LadderTier): LadderBucket[] {
  const present = new Set(tier.items.map((i) => i.bucket_id));
  return [...tree.buckets].filter((b) => present.has(b.id)).sort((a, b) => a.sort_order - b.sort_order);
}

/** Best-guess current tier from an hourly rate — hourly tiers only, capped at the top hourly tier. */
export function tierFromHourlyRate(tree: LadderTree, rate: number | null | undefined): string | null {
  if (!rate || rate <= 0) return null;
  const hourly = flatTiers(tree).filter((t) => t.pay_kind === 'hourly' && t.pay_value != null);
  if (hourly.length === 0) return null;
  const maxHourly = Math.max(...hourly.map((t) => t.pay_value as number));
  if (rate > maxHourly) return null; // beyond hourly band → place manually
  let best: FlatTier | null = null;
  for (const t of hourly) {
    if (rate >= (t.pay_value as number) && (!best || (t.pay_value as number) > (best.pay_value as number))) best = t;
  }
  return best?.id ?? null;
}

export function getTier(tree: LadderTree, id: string | null | undefined): FlatTier | undefined {
  if (!id) return undefined;
  return flatTiers(tree).find((t) => t.id === id);
}
