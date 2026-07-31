import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import type { LadderTree } from '@/lib/ladder-types';

export const dynamic = 'force-dynamic';

type SessionUser = { role?: string; permissions?: Record<string, Record<string, boolean>> | null };
function canView(user: SessionUser | undefined): boolean {
  return !!user && (user.role === 'owner' || !!user.permissions?.hr_hub?.can_access);
}

// GET /api/ladders/[id] — the full ladder tree (buckets + levels → tiers → items).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canView(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const supabase = getServerSupabase();

  const [ladderRes, bucketsRes, levelsRes] = await Promise.all([
    supabase.from('hr_ladders').select('id, name, description, st_business_units').eq('id', id).single(),
    supabase.from('hr_ladder_buckets').select('id, name, is_gate, sort_order').eq('ladder_id', id).order('sort_order'),
    supabase.from('hr_ladder_levels').select('id, name, subtitle, gate_note, timeframe, sort_order').eq('ladder_id', id).order('sort_order'),
  ]);
  if (ladderRes.error) return NextResponse.json({ error: ladderRes.error.message }, { status: ladderRes.error.code === 'PGRST116' ? 404 : 500 });
  for (const r of [bucketsRes, levelsRes]) {
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
  }

  const levelIds = (levelsRes.data || []).map((l) => l.id);
  const tiersRes = levelIds.length
    ? await supabase.from('hr_ladder_tiers').select('id, level_id, pay_label, pay_value, pay_kind, gate_note, is_default, sort_order').in('level_id', levelIds).order('sort_order')
    : { data: [], error: null };
  if (tiersRes.error) return NextResponse.json({ error: tiersRes.error.message }, { status: 500 });

  const tierIds = (tiersRes.data || []).map((t) => t.id);
  const itemsRes = tierIds.length
    ? await supabase.from('hr_ladder_items').select('id, tier_id, bucket_id, text, is_gate, sort_order').in('tier_id', tierIds).order('sort_order')
    : { data: [], error: null };
  if (itemsRes.error) return NextResponse.json({ error: itemsRes.error.message }, { status: 500 });

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

  const tree: LadderTree = {
    id: ladderRes.data.id,
    name: ladderRes.data.name,
    description: ladderRes.data.description,
    st_business_units: ladderRes.data.st_business_units || [],
    buckets: bucketsRes.data || [],
    levels: (levelsRes.data || []).map((l) => ({ ...l, tiers: tiersByLevel.get(l.id) || [] })),
  };

  return NextResponse.json({ ladder: tree });
}
