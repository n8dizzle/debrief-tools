import type { getServerSupabase } from '@/lib/supabase';
import type { LadderTree } from '@/lib/ladder-types';

type SB = ReturnType<typeof getServerSupabase>;

/** Assemble the full ladder tree (buckets + levels → tiers → items) or null if not found. */
export async function getLadderTree(supabase: SB, id: string): Promise<LadderTree | null> {
  const [ladderRes, bucketsRes, levelsRes] = await Promise.all([
    supabase.from('hr_ladders').select('id, name, description, st_business_units').eq('id', id).maybeSingle(),
    supabase.from('hr_ladder_buckets').select('id, name, is_gate, sort_order').eq('ladder_id', id).order('sort_order'),
    supabase.from('hr_ladder_levels').select('id, name, subtitle, gate_note, timeframe, sort_order').eq('ladder_id', id).order('sort_order'),
  ]);
  if (ladderRes.error || !ladderRes.data) return null;

  const levelIds = (levelsRes.data || []).map((l) => l.id);
  const tiersRes = levelIds.length
    ? await supabase.from('hr_ladder_tiers').select('id, level_id, pay_label, pay_value, pay_kind, gate_note, is_default, sort_order').in('level_id', levelIds).order('sort_order')
    : { data: [] as any[] };
  const tierIds = (tiersRes.data || []).map((t: any) => t.id);
  const itemsRes = tierIds.length
    ? await supabase.from('hr_ladder_items').select('id, tier_id, bucket_id, text, is_gate, sort_order').in('tier_id', tierIds).order('sort_order')
    : { data: [] as any[] };

  const itemsByTier = new Map<string, any[]>();
  for (const it of itemsRes.data || []) {
    const arr = itemsByTier.get(it.tier_id) || [];
    arr.push({ id: it.id, bucket_id: it.bucket_id, text: it.text, is_gate: it.is_gate, sort_order: it.sort_order });
    itemsByTier.set(it.tier_id, arr);
  }
  const tiersByLevel = new Map<string, any[]>();
  for (const t of tiersRes.data || []) {
    const arr = tiersByLevel.get(t.level_id) || [];
    arr.push({
      id: t.id, pay_label: t.pay_label, pay_value: t.pay_value != null ? Number(t.pay_value) : null,
      pay_kind: t.pay_kind, gate_note: t.gate_note, is_default: t.is_default, sort_order: t.sort_order,
      items: itemsByTier.get(t.id) || [],
    });
    tiersByLevel.set(t.level_id, arr);
  }

  return {
    id: ladderRes.data.id,
    name: ladderRes.data.name,
    description: ladderRes.data.description,
    st_business_units: ladderRes.data.st_business_units || [],
    buckets: bucketsRes.data || [],
    levels: (levelsRes.data || []).map((l) => ({ ...l, tiers: tiersByLevel.get(l.id) || [] })),
  };
}

/** Which ladder is this tech assessed on? Explicit placement first, else business-unit match. */
export async function resolveTechLadderId(supabase: SB, stId: number, businessUnitName: string | null): Promise<string | null> {
  const { data: placement } = await supabase.from('hr_tech_ladder').select('ladder_id').eq('st_technician_id', stId).maybeSingle();
  if (placement?.ladder_id) return placement.ladder_id;
  if (businessUnitName) {
    const { data: ladders } = await supabase.from('hr_ladders').select('id, st_business_units').eq('is_active', true);
    const match = (ladders || []).find((l: any) => (l.st_business_units || []).includes(businessUnitName));
    if (match) return match.id;
  }
  return null;
}
