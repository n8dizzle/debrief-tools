/**
 * One-time seed: write the hardcoded HVAC Install ladder (lib/ladder.ts) into the
 * config-driven tables, and migrate the existing string-keyed checkoffs to item ids.
 *
 * Run:  SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-hvac-ladder.ts
 */
import { createClient } from '@supabase/supabase-js';
import { LADDER } from '../lib/ladder';

const URL = 'https://dgnsvheokdubqmdlanua.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY env required');
const sb = createClient(URL, KEY);

const BUCKETS = [
  { key: 'skill', name: 'Skills & Knowledge', is_gate: false },
  { key: 'responsibility', name: 'Core Responsibilities', is_gate: false },
  { key: 'equipment', name: 'Equipment Cleared to Install', is_gate: true },
];

async function main() {
  // Idempotency guard.
  const { data: existing } = await sb.from('hr_ladders').select('id').eq('name', 'HVAC Install').maybeSingle();
  if (existing) {
    console.log('HVAC Install ladder already seeded (id ' + existing.id + '). Aborting to avoid duplicates.');
    return;
  }

  // 1) Ladder
  const { data: ladder, error: le } = await sb
    .from('hr_ladders')
    .insert({ name: 'HVAC Install', description: 'HVAC install progression & skill map.', st_business_units: ['HVAC - Install'], sort_order: 0 })
    .select('id').single();
  if (le) throw le;
  const ladderId = ladder.id;

  // 2) Buckets → map category key → bucket id
  const bucketRows = BUCKETS.map((b, i) => ({ ladder_id: ladderId, name: b.name, is_gate: b.is_gate, sort_order: i }));
  const { data: buckets, error: be } = await sb.from('hr_ladder_buckets').insert(bucketRows).select('id, name');
  if (be) throw be;
  const bucketByKey: Record<string, string> = {};
  BUCKETS.forEach((b) => { bucketByKey[b.key] = buckets!.find((x) => x.name === b.name)!.id; });

  // 3) Levels, tiers, items
  const skillIdToItemId: Record<string, string> = {};
  for (let li = 0; li < LADDER.length; li++) {
    const step = LADDER[li];
    const { data: level, error: lve } = await sb
      .from('hr_ladder_levels')
      .insert({ ladder_id: ladderId, name: step.name, subtitle: step.subtitle, gate_note: step.gate, sort_order: li })
      .select('id').single();
    if (lve) throw lve;

    for (let ti = 0; ti < step.rungs.length; ti++) {
      const rung = step.rungs[ti];
      const { data: tier, error: te } = await sb
        .from('hr_ladder_tiers')
        .insert({ level_id: level.id, pay_label: rung.payLabel, pay_value: rung.payValue, pay_kind: step.payKind, sort_order: ti })
        .select('id').single();
      if (te) throw te;

      // items, grouped by bucket, preserving the old category+index ordering
      const groups: { key: string; items: { id: string; text: string }[] }[] = [
        { key: 'skill', items: rung.skills },
        { key: 'responsibility', items: rung.responsibilities },
        { key: 'equipment', items: rung.equipment },
      ];
      for (const g of groups) {
        if (g.items.length === 0) continue;
        const rows = g.items.map((it, idx) => ({
          tier_id: tier.id,
          bucket_id: bucketByKey[g.key],
          text: it.text,
          is_gate: g.key === 'equipment',
          sort_order: idx,
        }));
        const { data: inserted, error: ie } = await sb.from('hr_ladder_items').insert(rows).select('id');
        if (ie) throw ie;
        // PostgREST preserves input order on bulk insert → map old skill id → new item id
        g.items.forEach((it, idx) => { skillIdToItemId[it.id] = inserted![idx].id; });
      }
    }
  }

  const itemCount = Object.keys(skillIdToItemId).length;
  console.log(`Seeded ladder ${ladderId}: ${LADDER.length} levels, ${itemCount} items.`);

  // 4) Migrate existing checkoffs (skill_id string → item_id uuid)
  const { data: statuses, error: se } = await sb
    .from('hr_tech_skill_status')
    .select('id, skill_id, item_id')
    .is('item_id', null);
  if (se) throw se;
  let migrated = 0, orphaned = 0;
  for (const row of statuses || []) {
    const itemId = skillIdToItemId[row.skill_id];
    if (!itemId) { orphaned++; continue; }
    const { error: ue } = await sb.from('hr_tech_skill_status').update({ item_id: itemId }).eq('id', row.id);
    if (ue) throw ue;
    migrated++;
  }
  console.log(`Checkoffs migrated: ${migrated}, orphaned (no matching item): ${orphaned}.`);
}

main().then(() => { console.log('done'); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
